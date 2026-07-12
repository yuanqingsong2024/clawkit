#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "重启 clawkit 真实执行全链路"
echo "=========================================="
echo ""

echo "[1/2] 停止现有服务..."
bash "$SCRIPT_DIR/stop-real-stack.sh"
echo ""

echo "[2/2] 启动服务..."
bash "$SCRIPT_DIR/start-real-stack.sh"
