#!/bin/bash
# ClawKit 一键启动脚本
# 功能：清理缓存 -> 重新构建 -> 启动 Controller + Desktop

set -e

echo "=========================================="
echo "  ClawKit 一键启动"
echo "=========================================="

# 项目根目录（脚本位于 scripts/ 下，所以根目录是上一级）
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 1. 杀掉旧进程
echo ""
echo "[1/5] 清理旧进程..."
pkill -f "clawkit-desktop" 2>/dev/null || true
pkill -f "node dist/index.js" 2>/dev/null || true
sleep 2

# 2. 清理缓存
echo ""
echo "[2/5] 清理缓存..."
rm -rf packages/web/dist 2>/dev/null || true
rm -rf packages/controller/dist 2>/dev/null || true
rm -rf packages/desktop/src-tauri/target/release/build 2>/dev/null || true
echo "  ✓ 缓存已清理"

# 3. 重新构建
echo ""
echo "[3/5] 重新构建..."
cd "$PROJECT_ROOT"
pnpm build 2>&1 | tail -5

# 4. 启动 Controller
echo ""
echo "[4/5] 启动 Controller..."
cd "$PROJECT_ROOT"
nohup node packages/controller/dist/index.js > /tmp/controller.log 2>&1 &
CONTROLLER_PID=$!
echo "  ✓ Controller PID: $CONTROLLER_PID"
sleep 3

# 检查 Controller 是否启动成功
if curl -s "http://127.0.0.1:8787/api/overview" > /dev/null 2>&1; then
    echo "  ✓ Controller 运行正常"
else
    echo "  ✗ Controller 启动失败，请检查日志: tail -30 /tmp/controller.log"
fi

# 5. 启动 Desktop
echo ""
echo "[5/5] 启动 Desktop 客户端..."
"$PROJECT_ROOT/packages/desktop/src-tauri/target/release/clawkit-desktop" > /tmp/desktop.log 2>&1 &
DESKTOP_PID=$!
echo "  ✓ Desktop PID: $DESKTOP_PID"

echo ""
echo "=========================================="
echo "  启动完成！"
echo "=========================================="
echo ""
echo "服务状态："
echo "  Controller: http://127.0.0.1:8787"
echo "  Desktop:    运行中 (PID: $DESKTOP_PID)"
echo ""
echo "查看日志："
echo "  Controller: tail -f /tmp/controller.log"
echo "  Desktop:    tail -f /tmp/desktop.log"
echo ""
