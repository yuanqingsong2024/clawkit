#!/usr/bin/env bash
# clawkit 一键部署脚本（单机模式）
# 用途：内部试运行和首次部署，降低使用成本
# 原则：不重复实现部署逻辑，只做编排，复用现有 CLI 命令

set -euo pipefail

# ============================================================================
# 颜色定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 日志函数
# ============================================================================
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

log_step() {
  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}$1${NC}"
  echo -e "${GREEN}========================================${NC}"
}

# ============================================================================
# 帮助信息
# ============================================================================
show_help() {
  cat <<'EOF'
clawkit 一键部署脚本（单机模式）

用法：
  ./scripts/quick-start.sh [选项]

选项：
  -f, --file <path>    manifest 文件路径（默认：examples/all-in-one.yaml）
  --skip-build         跳过构建步骤（适合已构建过的情况）
  --no-start           只部署不启动服务
  --smoke-test         部署完成后自动执行烟雾测试
  -h, --help           显示此帮助信息

示例：
  # 使用默认配置一键部署并启动
  ./scripts/quick-start.sh

  # 使用自定义配置
  ./scripts/quick-start.sh -f ./my-config.yaml

  # 跳过构建，直接部署
  ./scripts/quick-start.sh --skip-build

  # 部署后自动执行烟雾测试
  ./scripts/quick-start.sh --smoke-test

说明：
  - 此脚本适合单机模式（all-in-one）部署
  - 会依次执行：环境检查 → 安装依赖 → 构建 → doctor → apply → 启动服务
  - 失败时会立即停止并输出错误信息
  - 不会破坏已有环境，apply 会自动备份现有文件

EOF
}

# ============================================================================
# 参数解析
# ============================================================================
MANIFEST_FILE="examples/all-in-one.yaml"
SKIP_BUILD=false
NO_START=false
RUN_SMOKE_TEST=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -f|--file)
      MANIFEST_FILE="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --no-start)
      NO_START=true
      shift
      ;;
    --smoke-test)
      RUN_SMOKE_TEST=true
      shift
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

# ============================================================================
# 步骤 1：环境检查
# ============================================================================
log_step "步骤 1/7：环境检查"

# 检查 Node.js
if ! command -v node &> /dev/null; then
  log_error "未找到 Node.js，请先安装 Node.js >= 20.0.0"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
log_info "Node.js 版本：$NODE_VERSION"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
  log_error "未找到 pnpm，请先安装 pnpm >= 8.0.0"
  log_info "安装方法：npm install -g pnpm"
  exit 1
fi

PNPM_VERSION=$(pnpm -v)
log_info "pnpm 版本：$PNPM_VERSION"

# 检查项目根目录
if [ ! -f "package.json" ]; then
  log_error "当前目录不是项目根目录，请在项目根目录执行此脚本"
  exit 1
fi

# 检查 manifest 文件
if [ ! -f "$MANIFEST_FILE" ]; then
  log_error "manifest 文件不存在：$MANIFEST_FILE"
  exit 1
fi

log_success "环境检查通过"

# ============================================================================
# 步骤 2：安装依赖
# ============================================================================
log_step "步骤 2/7：安装依赖"

if [ -d "node_modules" ]; then
  log_info "node_modules 已存在，跳过安装"
else
  log_info "正在安装依赖..."
  pnpm install
  log_success "依赖安装完成"
fi

# ============================================================================
# 步骤 3：构建项目
# ============================================================================
log_step "步骤 3/7：构建项目"

if [ "$SKIP_BUILD" = true ]; then
  log_warn "跳过构建步骤（--skip-build）"
else
  log_info "正在构建项目..."
  pnpm build
  log_success "项目构建完成"
fi

# ============================================================================
# 步骤 4：部署前检查（doctor）
# ============================================================================
log_step "步骤 4/7：部署前检查（doctor）"

log_info "正在执行配置诊断..."
if node ./packages/cli/dist/index.js doctor -f "$MANIFEST_FILE"; then
  log_success "配置诊断通过"
else
  log_error "配置诊断失败，请根据上述建议修复后重试"
  exit 1
fi

# ============================================================================
# 步骤 5：执行部署（apply）
# ============================================================================
log_step "步骤 5/7：执行部署（apply）"

log_info "正在执行部署..."
node ./packages/cli/dist/index.js apply -f "$MANIFEST_FILE"
log_success "部署完成"

# ============================================================================
# 步骤 6：启动服务
# ============================================================================
log_step "步骤 6/7：启动服务"

if [ "$NO_START" = true ]; then
  log_warn "跳过启动服务（--no-start）"
else
  log_info "准备启动服务..."
  log_info "注意：服务将在后台启动，日志输出到 .clawkit/logs/ 目录"
  
  # 创建日志目录
  mkdir -p .clawkit/logs
  
  # 设置环境变量
  export CLAWKIT_MANIFEST_PATH="$MANIFEST_FILE"
  export CONTROLLER_URL="http://127.0.0.1:8787"
  export WORKER_ID="local-worker"
  export WORKER_SUPPORTED_PROJECTS="clawkit"
  export WORKER_PLACEHOLDER_FALLBACK="true"
  
  # 检查 OPENCLAW_WEBHOOK_TOKEN
  if [ -z "${OPENCLAW_WEBHOOK_TOKEN:-}" ]; then
    log_warn "OPENCLAW_WEBHOOK_TOKEN 未设置，使用默认值（仅供测试）"
    export OPENCLAW_WEBHOOK_TOKEN="replace-me"
  fi
  
  # 启动 controller
  log_info "启动 controller..."
  set +u
  nohup pnpm --filter @clawkit/controller start > .clawkit/logs/controller.log 2>&1 &
  CONTROLLER_PID=$!
  set -u
  if [ -n "${CONTROLLER_PID:-}" ]; then
    echo "$CONTROLLER_PID" > .clawkit/controller.pid
    log_success "controller 已启动 (PID: $CONTROLLER_PID)"
  else
    log_warn "无法获取 controller PID"
  fi
  
  # 等待 controller 启动
  log_info "等待 controller 启动..."
  sleep 3
  
  # 启动 worker
  log_info "启动 worker..."
  set +u
  nohup pnpm --filter @clawkit/worker start > .clawkit/logs/worker.log 2>&1 &
  WORKER_PID=$!
  set -u
  if [ -n "${WORKER_PID:-}" ]; then
    echo "$WORKER_PID" > .clawkit/worker.pid
    log_success "worker 已启动 (PID: $WORKER_PID)"
  else
    log_warn "无法获取 worker PID"
  fi
  
  log_success "所有服务已启动"
fi

# ============================================================================
# 步骤 7：烟雾测试（可选）
# ============================================================================
if [ "$RUN_SMOKE_TEST" = true ]; then
  log_step "步骤 7/7：烟雾测试"
  
  log_info "等待服务完全启动..."
  sleep 5
  
  if [ -f "./scripts/smoke-test.sh" ]; then
    ./scripts/smoke-test.sh
  else
    log_warn "smoke-test.sh 不存在，跳过烟雾测试"
  fi
else
  log_step "步骤 7/7：完成"
fi

# ============================================================================
# 输出部署结果摘要
# ============================================================================
echo ""
log_step "部署结果摘要"

log_success "clawkit 部署成功！"
echo ""
log_info "服务地址："
log_info "  Controller API: http://127.0.0.1:8787/api"
log_info "  Web Console:    http://127.0.0.1:8787"
echo ""
log_info "日志位置："
log_info "  Controller: .clawkit/logs/controller.log"
log_info "  Worker:     .clawkit/logs/worker.log"
echo ""
log_info "进程 ID："
log_info "  Controller: $(cat .clawkit/controller.pid 2>/dev/null || echo '未启动')"
log_info "  Worker:     $(cat .clawkit/worker.pid 2>/dev/null || echo '未启动')"
echo ""
log_info "下一步建议："
log_info "  1. 查看日志：tail -f .clawkit/logs/controller.log"
log_info "  2. 访问 Web Console：http://127.0.0.1:8787"
log_info "  3. 执行烟雾测试：./scripts/smoke-test.sh"
log_info "  4. 停止服务：kill \$(cat .clawkit/controller.pid) \$(cat .clawkit/worker.pid)"
echo ""
log_success "部署完成！"
