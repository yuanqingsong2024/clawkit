#!/usr/bin/env bash
# clawkit 烟雾测试脚本
# 用途：部署后快速验证关键服务是否可用

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
  echo -e "${BLUE}[信息]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[通过]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
  echo -e "${RED}[失败]${NC} $1"
}

show_help() {
  cat <<'EOF'
clawkit 烟雾测试脚本

用法：
  ./scripts/smoke-test.sh [选项]

选项：
  --controller-url <url>  Controller 地址（默认：http://127.0.0.1:8787）
  -h, --help              显示此帮助信息

说明：
  - 此脚本用于部署后快速验证关键服务是否可用
  - 检查项：Controller 健康状态、Worker 注册状态、Web Console 可访问性
  - 输出格式：通过/警告/失败 + 总结

EOF
}

CONTROLLER_URL="${CONTROLLER_URL:-http://127.0.0.1:8787}"

while [[ $# -gt 0 ]]; do
  case $1 in
    --controller-url)
      CONTROLLER_URL="$2"
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      log_error "未知参数：$1"
      show_help
      exit 1
      ;;
  esac
done

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}clawkit 烟雾测试${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

log_info "Controller 地址：$CONTROLLER_URL"
echo ""

if ! command -v curl &> /dev/null; then
  log_error "未找到 curl 命令，无法执行烟雾测试"
  exit 1
fi

log_info "开始执行烟雾测试..."
echo ""

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CONTROLLER_URL/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  log_success "Controller 健康检查通过"
  ((PASS_COUNT++))
elif [ "$HTTP_CODE" = "000" ]; then
  log_error "Controller 无法连接（可能未启动或地址错误）"
  ((FAIL_COUNT++))
else
  log_warn "Controller 健康检查返回异常状态码：$HTTP_CODE"
  ((WARN_COUNT++))
fi

WORKERS_RESPONSE=$(curl -s "$CONTROLLER_URL/api/workers" 2>/dev/null || echo "")

if [ -n "$WORKERS_RESPONSE" ]; then
  WORKER_COUNT=$(echo "$WORKERS_RESPONSE" | grep -o '"id"' | wc -l | tr -d ' ')
  
  if [ "$WORKER_COUNT" -gt 0 ]; then
    log_success "Worker 已注册（数量：$WORKER_COUNT）"
    ((PASS_COUNT++))
  else
    log_warn "未发现已注册的 Worker"
    ((WARN_COUNT++))
  fi
else
  log_error "无法获取 Worker 列表"
  ((FAIL_COUNT++))
fi

WEB_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CONTROLLER_URL/" 2>/dev/null || echo "000")

if [ "$WEB_HTTP_CODE" = "200" ]; then
  log_success "Web Console 可访问"
  ((PASS_COUNT++))
elif [ "$WEB_HTTP_CODE" = "000" ]; then
  log_error "Web Console 无法连接"
  ((FAIL_COUNT++))
else
  log_warn "Web Console 返回异常状态码：$WEB_HTTP_CODE"
  ((WARN_COUNT++))
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}烟雾测试结果摘要${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${GREEN}通过：${NC}$PASS_COUNT 项"
echo -e "${YELLOW}警告：${NC}$WARN_COUNT 项"
echo -e "${RED}失败：${NC}$FAIL_COUNT 项"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  log_error "烟雾测试失败，请检查服务状态"
  echo ""
  log_info "排查建议："
  log_info "  1. 检查服务是否已启动：ps aux | grep clawkit"
  log_info "  2. 查看日志：tail -f .clawkit/logs/controller.log"
  log_info "  3. 检查端口占用：lsof -i :8787"
  exit 1
elif [ "$WARN_COUNT" -gt 0 ]; then
  log_warn "烟雾测试存在警告项，建议检查"
  exit 0
else
  log_success "烟雾测试全部通过！"
  exit 0
fi
