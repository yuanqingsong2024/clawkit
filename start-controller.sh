#!/bin/bash
cd "$(dirname "$0")"

export OPENCLAW_WEBHOOK_TOKEN="replace-me"
export CLAWKIT_MANIFEST_PATH="/media/yuanqingsong/新加卷1/code/clawkit/clawkit.yaml"

echo "启动 Controller..."
cd packages/controller
pnpm build
node dist/index.js > ../../.clawkit/logs/controller.log 2>&1 &
CONTROLLER_PID=$!
echo $CONTROLLER_PID > ../../.clawkit/controller.pid
echo "Controller 已启动 (PID: $CONTROLLER_PID)"

sleep 2

if ps -p $CONTROLLER_PID > /dev/null; then
    echo "✓ Controller 运行正常"
    echo "访问: http://127.0.0.1:8787"
else
    echo "✗ Controller 启动失败，查看日志:"
    tail -20 ../../.clawkit/logs/controller.log
fi
