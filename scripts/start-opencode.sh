#!/bin/bash
# 启动 OpenCode 服务脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 默认配置
PORT="${OPENCODE_PORT:-4096}"
HOSTNAME="${OPENCODE_HOSTNAME:-127.0.0.1}"
LOG_FILE="${PROJECT_ROOT}/opencode.log"
PID_FILE="${PROJECT_ROOT}/.clawkit/opencode.pid"

echo "=========================================="
echo "启动 OpenCode 服务"
echo "=========================================="
echo "端口: $PORT"
echo "主机: $HOSTNAME"
echo "日志: $LOG_FILE"
echo "=========================================="

if [ -z "${OPENCODE_SERVER_PASSWORD:-}" ]; then
    echo "错误: OPENCODE_SERVER_PASSWORD 未设置"
    echo "请先执行: export OPENCODE_SERVER_PASSWORD=\"your-password\""
    exit 1
fi

mkdir -p "${PROJECT_ROOT}/.clawkit"

# 检查 opencode 命令是否存在
if ! command -v opencode &> /dev/null; then
    echo "错误: opencode 命令未找到"
    echo "请先安装 OpenCode: https://opencode.ai"
    exit 1
fi

# 检查端口是否已被占用
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "警告: 端口 $PORT 已被占用"
    echo "正在尝试停止现有进程..."
    
    PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t)
    if [ -n "$PID" ]; then
        kill $PID 2>/dev/null || true
        sleep 2
    fi
fi

# 启动 OpenCode 服务
echo "正在启动 OpenCode 服务..."
nohup env OPENCODE_SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}" OPENCODE_SERVER_PASSWORD="$OPENCODE_SERVER_PASSWORD" opencode serve --port $PORT --hostname $HOSTNAME --print-logs > "$LOG_FILE" 2>&1 &
OPENCODE_PID=$!

echo "$OPENCODE_PID" > "$PID_FILE"

echo "OpenCode 服务已启动 (PID: $OPENCODE_PID)"
echo "日志文件: $LOG_FILE"
echo "PID 文件: $PID_FILE"

# 等待服务启动
echo "等待服务就绪..."
sleep 3

# 检查服务是否正常运行
if ps -p $OPENCODE_PID > /dev/null; then
    echo "✓ OpenCode 服务运行正常"
    echo "✓ 访问地址: http://$HOSTNAME:$PORT"
    echo ""
    echo "查看日志: tail -f $LOG_FILE"
    echo "停止服务: kill $OPENCODE_PID"
else
    echo "✗ OpenCode 服务启动失败"
    echo "请查看日志: cat $LOG_FILE"
    exit 1
fi
