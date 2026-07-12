#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export CLAWKIT_MANIFEST_PATH="${CLAWKIT_MANIFEST_PATH:-$PROJECT_ROOT/clawkit.yaml}"
export OPENCLAW_WEBHOOK_TOKEN="${OPENCLAW_WEBHOOK_TOKEN:-replace-me}"
export CONTROLLER_URL="${CONTROLLER_URL:-http://127.0.0.1:8787}"
export WORKER_ID="${WORKER_ID:-local-worker}"
export WORKER_SUPPORTED_PROJECTS="${WORKER_SUPPORTED_PROJECTS:-clawkit}"
export OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"

if [ -z "${OPENCODE_SERVER_PASSWORD:-}" ]; then
  echo "错误：OPENCODE_SERVER_PASSWORD 未设置。"
  echo "请先执行：export OPENCODE_SERVER_PASSWORD=\"your-password\""
  exit 1
fi

mkdir -p "$PROJECT_ROOT/.clawkit/logs"

echo "=========================================="
echo "启动 clawkit 真实执行全链路"
echo "=========================================="
echo "Manifest: $CLAWKIT_MANIFEST_PATH"
echo "Controller: $CONTROLLER_URL"
echo "Worker ID: $WORKER_ID"
echo "Projects: $WORKER_SUPPORTED_PROJECTS"
echo "OpenClaw token: $OPENCLAW_WEBHOOK_TOKEN"
echo "OpenCode user: $OPENCODE_SERVER_USERNAME"
echo "=========================================="
echo ""

echo "[1/3] 启动 OpenCode..."
bash "$SCRIPT_DIR/start-opencode.sh"
echo ""

echo "[2/3] 启动 Controller..."
bash "$PROJECT_ROOT/start-controller.sh"
echo ""

echo "[3/3] 启动真实 Worker..."
nohup env \
  CLAWKIT_MANIFEST_PATH="$CLAWKIT_MANIFEST_PATH" \
  CONTROLLER_URL="$CONTROLLER_URL" \
  WORKER_ID="$WORKER_ID" \
  WORKER_SUPPORTED_PROJECTS="$WORKER_SUPPORTED_PROJECTS" \
  WORKER_PLACEHOLDER_FALLBACK="false" \
  OPENCODE_EXECUTION_MODE="sdk" \
  OPENCODE_SERVER_BASE_URL="${OPENCODE_SERVER_BASE_URL:-http://127.0.0.1:4096}" \
  OPENCODE_SERVER_USERNAME="$OPENCODE_SERVER_USERNAME" \
  OPENCODE_SERVER_PASSWORD="$OPENCODE_SERVER_PASSWORD" \
  OPENCODE_SERVER_PASSWORD_ENV="${OPENCODE_SERVER_PASSWORD_ENV:-OPENCODE_SERVER_PASSWORD}" \
  pnpm --filter @clawkit/worker start > "$PROJECT_ROOT/.clawkit/logs/worker.log" 2>&1 &
WORKER_PID=$!
echo "$WORKER_PID" > "$PROJECT_ROOT/.clawkit/worker.pid"
sleep 3

if ps -p "$WORKER_PID" > /dev/null; then
  echo "✓ Worker 已启动 (PID: $WORKER_PID)"
else
  echo "✗ Worker 启动失败，查看日志: $PROJECT_ROOT/.clawkit/logs/worker.log"
  exit 1
fi

echo ""
echo "=========================================="
echo "真实执行全链路已启动"
echo "=========================================="
echo "Web Console: http://127.0.0.1:8787"
echo "Controller PID: $(cat "$PROJECT_ROOT/.clawkit/controller.pid" 2>/dev/null || echo 'unknown')"
echo "Worker PID: $WORKER_PID"
echo "OpenCode PID: $(cat "$PROJECT_ROOT/.clawkit/opencode.pid" 2>/dev/null || echo 'unknown')"
echo ""
echo "查看日志："
echo "  tail -f $PROJECT_ROOT/.clawkit/logs/controller.log"
echo "  tail -f $PROJECT_ROOT/.clawkit/logs/worker.log"
echo "  tail -f $PROJECT_ROOT/opencode.log"
echo ""
echo "停止服务："
echo "  bash $PROJECT_ROOT/scripts/stop-real-stack.sh"
