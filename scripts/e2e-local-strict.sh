#!/bin/bash
# 严格模式端到端验证脚本
# 用途：验证真实 OpenCode 执行能力（不允许 placeholder fallback）
# 前置条件：必须先启动 opencode serve

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "ClawKit 严格模式端到端验证"
echo "=========================================="
echo ""

# 检查 opencode serve 是否可达
OPENCODE_URL="${OPENCODE_SERVER_BASE_URL:-http://127.0.0.1:4096}"
echo "检查 OpenCode server 可达性: $OPENCODE_URL"

if ! curl -s -f "$OPENCODE_URL/global/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ OpenCode server 不可达${NC}"
  echo ""
  echo "请先启动 OpenCode server："
  echo "  export OPENCODE_SERVER_USERNAME=\"opencode\""
  echo "  export OPENCODE_SERVER_PASSWORD=\"your-password\""
  echo "  opencode serve --hostname 127.0.0.1 --port 4096"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓ OpenCode server 可达${NC}"
echo ""

# 检查必要的环境变量
if [ -z "$OPENCODE_SERVER_PASSWORD" ]; then
  echo -e "${RED}✗ 环境变量 OPENCODE_SERVER_PASSWORD 未设置${NC}"
  echo ""
  echo "请设置 OpenCode server 密码："
  echo "  export OPENCODE_SERVER_PASSWORD=\"your-password\""
  echo ""
  exit 1
fi

echo -e "${GREEN}✓ 环境变量已设置${NC}"
echo ""

# 设置严格模式环境变量
export CLAWKIT_MANIFEST_PATH="$(pwd)/examples/all-in-one.yaml"
export CONTROLLER_URL="http://127.0.0.1:18787"
export WORKER_ID="strict-e2e-worker"
export WORKER_SUPPORTED_PROJECTS="clawkit"
export OPENCODE_EXECUTION_MODE="sdk"
export OPENCODE_SERVER_BASE_URL="$OPENCODE_URL"
export OPENCODE_SERVER_PASSWORD_ENV="OPENCODE_SERVER_PASSWORD"
export WORKER_PLACEHOLDER_FALLBACK="false"  # 关键：禁用 fallback
export OPENCLAW_WEBHOOK_TOKEN="e2e-strict-token"

echo "启动 controller..."
node ./packages/controller/dist/index.js > /tmp/clawkit-strict-controller.log 2>&1 &
CONTROLLER_PID=$!
echo "Controller PID: $CONTROLLER_PID"

# 等待 controller 启动
sleep 2

if ! kill -0 $CONTROLLER_PID 2>/dev/null; then
  echo -e "${RED}✗ Controller 启动失败${NC}"
  cat /tmp/clawkit-strict-controller.log
  exit 1
fi

echo -e "${GREEN}✓ Controller 已启动${NC}"
echo ""

echo "启动 worker（严格模式，禁用 placeholder fallback）..."
node ./packages/worker/dist/index.js > /tmp/clawkit-strict-worker.log 2>&1 &
WORKER_PID=$!
echo "Worker PID: $WORKER_PID"

# 等待 worker 注册
sleep 2

if ! kill -0 $WORKER_PID 2>/dev/null; then
  echo -e "${RED}✗ Worker 启动失败${NC}"
  cat /tmp/clawkit-strict-worker.log
  kill $CONTROLLER_PID 2>/dev/null || true
  exit 1
fi

echo -e "${GREEN}✓ Worker 已启动${NC}"
echo ""

# 清理函数
cleanup() {
  echo ""
  echo "清理进程..."
  kill $WORKER_PID 2>/dev/null || true
  kill $CONTROLLER_PID 2>/dev/null || true
  echo "清理完成"
}

trap cleanup EXIT

# 发送测试任务
echo "发送测试任务..."
TASK_RESPONSE=$(curl -s -X POST "$CONTROLLER_URL/api/openclaw/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer e2e-strict-token" \
  -d '{
    "text": "创建研发任务\n项目：clawkit\n意图：验证真实 OpenCode 执行\n范围：读取 README.md 前 10 行"
  }')

TASK_ID=$(echo "$TASK_RESPONSE" | grep -o 'clawkit-[a-z0-9-]*' | head -1)

if [ -z "$TASK_ID" ]; then
  echo -e "${RED}✗ 创建任务失败${NC}"
  echo "响应: $TASK_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ 任务已创建: $TASK_ID${NC}"
echo ""

# 确认派发
echo "确认派发任务..."
curl -s -X POST "$CONTROLLER_URL/api/openclaw/webhook" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer e2e-strict-token" \
  -d "{\"text\": \"#确认派发 $TASK_ID\"}" > /dev/null

echo -e "${GREEN}✓ 任务已派发${NC}"
echo ""

# 轮询任务状态
echo "等待任务执行完成..."
MAX_WAIT=60
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  STATUS_RESPONSE=$(curl -s "$CONTROLLER_URL/api/tasks/$TASK_ID/status")
  TASK_STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  if [ "$TASK_STATUS" = "done" ] || [ "$TASK_STATUS" = "failed" ]; then
    break
  fi
  
  echo -n "."
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done

echo ""
echo ""

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
  echo -e "${RED}✗ 任务执行超时${NC}"
  exit 1
fi

# 检查执行结果
echo "检查执行结果..."
PLACEHOLDER_EXECUTION=$(echo "$STATUS_RESPONSE" | grep -o '"placeholderExecution":[^,}]*' | cut -d':' -f2)

if [ "$TASK_STATUS" = "done" ]; then
  if [ "$PLACEHOLDER_EXECUTION" = "false" ]; then
    echo -e "${GREEN}✓ 严格模式验证通过${NC}"
    echo ""
    echo "任务状态: $TASK_STATUS"
    echo "占位执行: $PLACEHOLDER_EXECUTION"
    echo ""
    echo -e "${GREEN}=========================================="
    echo "真实 OpenCode 执行验证成功"
    echo "==========================================${NC}"
    exit 0
  else
    echo -e "${RED}✗ 验证失败：仍然使用了 placeholder 执行${NC}"
    echo ""
    echo "任务状态: $TASK_STATUS"
    echo "占位执行: $PLACEHOLDER_EXECUTION"
    echo ""
    echo "完整响应:"
    echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
    exit 1
  fi
else
  echo -e "${RED}✗ 任务执行失败${NC}"
  echo ""
  echo "任务状态: $TASK_STATUS"
  echo ""
  echo "完整响应:"
  echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
  exit 1
fi
