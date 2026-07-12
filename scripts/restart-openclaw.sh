#!/bin/bash
# OpenClaw 重启脚本 - 清理旧配置并重新部署

set -e  # 遇到错误立即退出

echo "=== 步骤 1: 停止旧的 OpenClaw 容器 ==="
if [ -f ~/.openclaw/docker-compose.yml ]; then
  docker compose -f ~/.openclaw/docker-compose.yml down || true
fi

echo ""
echo "=== 步骤 2: 删除旧配置文件 ==="
rm -f ~/.openclaw/openclaw.json
rm -f ~/.openclaw/docker-compose.yml
echo "✓ 旧配置已删除"

echo ""
echo "=== 步骤 3: 重新生成配置 ==="
cd "$(dirname "$0")/.."
node ./packages/cli/dist/index.js apply -f ./examples/all-in-one.yaml
echo "✓ 新配置已生成"

echo ""
echo "=== 步骤 4: 验证新配置 ==="
echo "--- openclaw.json ---"
cat ~/.openclaw/openclaw.json
echo ""
echo "--- docker-compose.yml (前10行) ---"
head -10 ~/.openclaw/docker-compose.yml

echo ""
echo "=== 步骤 5: 启动 OpenClaw 容器 ==="
docker compose -f ~/.openclaw/docker-compose.yml up -d

echo ""
echo "=== 步骤 6: 等待容器启动 ==="
sleep 5

echo ""
echo "=== 步骤 7: 检查容器状态 ==="
docker ps | grep openclaw-gateway || echo "⚠️  容器未运行"

echo ""
echo "=== 步骤 8: 检查容器日志 ==="
docker logs openclaw-gateway --tail 20

echo ""
echo "=== 完成！==="
echo "现在请重启 controller："
echo "  1. 停止旧的 controller 进程（Ctrl+C 或 pkill -f 'node.*controller'）"
echo "  2. cd packages/controller && pnpm start"
