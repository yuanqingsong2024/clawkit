#!/usr/bin/env bash
# clawkit 开发环境快速启动脚本
# 用途：本地开发调试，尽量快速启动
# 适合：频繁调试，不适合生产部署

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
  echo -e "${GREEN}[成功]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[警告]${NC} $1"
}

log_error() {
  echo -e "${RED}[错误]${NC} $1"
}

write_controller_config() {
  local manifest_path="$1"
  local resolved_manifest_path
  resolved_manifest_path="$(node -e "console.log(require('node:path').resolve(process.argv[1]))" "$manifest_path")"

  mkdir -p data packages/controller/data
  cat > data/controller-config.json <<EOF
{
  "manifestPath": "${resolved_manifest_path}"
}
EOF

  cat > packages/controller/data/controller-config.json <<EOF
{
  "manifestPath": "${resolved_manifest_path}"
}
EOF

  log_info "已同步 controller manifestPath：${resolved_manifest_path}"
}

show_help() {
  cat <<'EOF'
clawkit 开发环境快速启动脚本

用法：
  ./scripts/quick-start-dev.sh [选项]

选项：
  -h, --help           显示此帮助信息

说明：
  - 此脚本适合本地开发调试，不适合生产部署
  - 会快速安装依赖并启动开发模式服务
  - 服务将在前台运行，按 Ctrl+C 停止

EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
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

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}clawkit 开发环境快速启动${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

if ! command -v node &> /dev/null; then
  log_error "未找到 Node.js，请先安装 Node.js >= 20.0.0"
  exit 1
fi

if ! command -v pnpm &> /dev/null; then
  log_error "未找到 pnpm，请先安装 pnpm >= 8.0.0"
  exit 1
fi

if ! command -v curl &> /dev/null; then
  log_error "未找到 curl，请先安装 curl 用于健康检查"
  exit 1
fi

if [ ! -f "package.json" ]; then
  log_error "当前目录不是项目根目录，请在项目根目录执行此脚本"
  exit 1
fi

log_info "正在安装依赖..."
pnpm install

log_info "正在构建项目..."
pnpm build

echo ""
log_success "准备启动开发服务..."
echo ""
log_info "本地访问地址："
log_info "  Controller API: http://127.0.0.1:8787/api"
log_info "  Web Console:    http://127.0.0.1:8787"
echo ""
log_warn "注意：此脚本适合开发调试，不适合生产部署"
log_warn "生产部署请使用：./scripts/quick-start.sh"
echo ""
log_info "按 Ctrl+C 停止服务"
echo ""

export CLAWKIT_MANIFEST_PATH="${CLAWKIT_MANIFEST_PATH:-$(pwd)/examples/simple.yaml}"
export CLAWKIT_MANIFEST_PATH="$(node -e "console.log(require('node:path').resolve(process.argv[1]))" "$CLAWKIT_MANIFEST_PATH")"
export CONTROLLER_URL="${CONTROLLER_URL:-http://127.0.0.1:8787}"
export WORKER_ID="${WORKER_ID:-local-worker}"
export WORKER_SUPPORTED_PROJECTS="${WORKER_SUPPORTED_PROJECTS:-clawkit}"
export WORKER_PLACEHOLDER_FALLBACK="true"
export OPENCLAW_WEBHOOK_TOKEN="${OPENCLAW_WEBHOOK_TOKEN:-replace-me}"
write_controller_config "$CLAWKIT_MANIFEST_PATH"

log_info "启动 controller（前台运行）..."
pnpm --filter @clawkit/controller start &
CONTROLLER_PID=$!

log_info "等待 controller 就绪..."
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:8787/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

log_info "启动 worker（前台运行）..."
pnpm --filter @clawkit/worker start &
WORKER_PID=$!

cleanup() {
  echo ""
  log_info "正在停止服务..."
  kill $CONTROLLER_PID $WORKER_PID 2>/dev/null || true
  log_success "服务已停止"
  exit 0
}

trap cleanup SIGINT SIGTERM

wait
