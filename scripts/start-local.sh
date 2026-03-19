#!/usr/bin/env bash
set -euo pipefail

show_usage() {
  cat <<'EOF'
用法：
  ./scripts/start-local.sh controller
  ./scripts/start-local.sh worker-placeholder
  ./scripts/start-local.sh worker-opencode

说明：
  controller          启动 controller（需要先设置 OPENCLAW_WEBHOOK_TOKEN）
  worker-placeholder  启动 worker，占位执行模式（仅验证链路）
  worker-opencode     启动 worker，真实 OpenCode 执行模式（需先启动 opencode serve）

环境变量：
  CLAWKIT_MANIFEST_PATH  manifest 文件路径（默认 examples/all-in-one.yaml）
  OPENCLAW_WEBHOOK_TOKEN OpenClaw webhook token（controller 必填）
  CONTROLLER_URL         controller 地址（默认 http://127.0.0.1:8787）
  WORKER_ID              worker id（默认 local-worker）
  WORKER_SUPPORTED_PROJECTS 支持的项目 key（默认 clawkit）
EOF
}

if [ $# -lt 1 ]; then
  show_usage
  exit 1
fi

MODE="$1"

export CLAWKIT_MANIFEST_PATH="${CLAWKIT_MANIFEST_PATH:-$(pwd)/examples/all-in-one.yaml}"
export CONTROLLER_URL="${CONTROLLER_URL:-http://127.0.0.1:8787}"
export WORKER_ID="${WORKER_ID:-local-worker}"
export WORKER_SUPPORTED_PROJECTS="${WORKER_SUPPORTED_PROJECTS:-clawkit}"

pnpm build

case "$MODE" in
  controller)
    if [ -z "${OPENCLAW_WEBHOOK_TOKEN:-}" ]; then
      echo "错误：OPENCLAW_WEBHOOK_TOKEN 未设置。"
      echo "请先执行：export OPENCLAW_WEBHOOK_TOKEN=\"replace-me\""
      exit 1
    fi
    pnpm --filter @clawkit/controller start
    ;;
  worker-placeholder)
    export WORKER_PLACEHOLDER_FALLBACK="true"
    pnpm --filter @clawkit/worker start
    ;;
  worker-opencode)
    export WORKER_PLACEHOLDER_FALLBACK="false"
    export OPENCODE_EXECUTION_MODE="sdk"
    export OPENCODE_SERVER_BASE_URL="${OPENCODE_SERVER_BASE_URL:-http://127.0.0.1:4096}"
    export OPENCODE_SERVER_PASSWORD_ENV="${OPENCODE_SERVER_PASSWORD_ENV:-OPENCODE_SERVER_PASSWORD}"
    pnpm --filter @clawkit/worker start
    ;;
  *)
    echo "错误：未知模式 $MODE"
    show_usage
    exit 1
    ;;
esac
