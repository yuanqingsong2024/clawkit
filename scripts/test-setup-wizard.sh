#!/bin/bash

# Setup 向导 all-in-one 快速测试脚本
# 用途：一键启动 Controller 并打开 Setup 向导页面

set -e

echo "🚀 Setup 向导 all-in-one 快速测试"
echo "=================================="
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在项目根目录运行此脚本"
    exit 1
fi

# 检查构建产物
if [ ! -f "packages/controller/dist/index.js" ]; then
    echo "⚠️  警告：Controller 未构建，正在构建..."
    pnpm build
fi

# 检查测试配置文件
if [ ! -f "test-all-in-one.yaml" ]; then
    echo "❌ 错误：test-all-in-one.yaml 不存在"
    echo "请先运行以下命令生成配置文件："
    echo "  参考 docs/archive/setup-wizard-all-in-one-test-guide.md"
    exit 1
fi

# 验证配置文件
echo "📋 验证配置文件..."
node ./packages/cli/dist/index.js doctor -f test-all-in-one.yaml > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 配置文件验证通过"
else
    echo "❌ 配置文件验证失败"
    node ./packages/cli/dist/index.js doctor -f test-all-in-one.yaml
    exit 1
fi

# 检查端口占用
PORT=8787
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  警告：端口 $PORT 已被占用"
    echo "请先停止占用端口的进程，或修改配置文件中的端口"
    echo ""
    echo "查看占用进程："
    lsof -i :$PORT
    exit 1
fi

echo ""
echo "✅ 准备就绪，正在启动 Controller..."
echo ""
echo "📝 提示："
echo "  - Controller 将在端口 8787 启动"
echo "  - Setup 向导地址：http://127.0.0.1:8787/setup"
echo "  - 按 Ctrl+C 停止服务"
echo ""
echo "=================================="
echo ""

# 设置环境变量（使用测试配置）
export CLAWKIT_MANIFEST_PATH="$(pwd)/test-all-in-one.yaml"

# 启动 Controller
node ./packages/controller/dist/index.js
