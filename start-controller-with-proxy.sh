#!/bin/bash
# Controller 启动脚本（带代理配置）

# 设置代理环境变量
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897
export HTTP_PROXY=http://127.0.0.1:7897
export HTTPS_PROXY=http://127.0.0.1:7897

# 设置 controller 相关环境变量
export CLAWKIT_MANIFEST_PATH="${CLAWKIT_MANIFEST_PATH:-./clawkit.yaml}"
export CONTROLLER_DB_PATH="${CONTROLLER_DB_PATH:-./data/clawkit.db}"
export CONTROLLER_ENABLE_PERSISTENCE="${CONTROLLER_ENABLE_PERSISTENCE:-true}"

echo "=========================================="
echo "启动 Controller（带代理配置）"
echo "=========================================="
echo "代理地址: http://127.0.0.1:7897"
echo "Manifest: $CLAWKIT_MANIFEST_PATH"
echo "数据库: $CONTROLLER_DB_PATH"
echo "=========================================="
echo ""

# 进入 controller 目录并启动
cd "$(dirname "$0")/packages/controller" || exit 1
node dist/index.js
