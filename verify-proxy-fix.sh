#!/bin/bash
set -e

echo "=========================================="
echo "代理修复验证脚本"
echo "=========================================="
echo ""

# 设置代理
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897

echo "✓ 步骤 1: 验证代理服务可用性"
if curl -x http://127.0.0.1:7897 -s -o /dev/null -w "%{http_code}" https://www.google.com | grep -q "200"; then
    echo "  ✅ 代理服务正常工作"
else
    echo "  ❌ 代理服务不可用，请检查代理是否启动"
    exit 1
fi
echo ""

echo "✓ 步骤 2: 验证通过代理访问 GitHub raw"
if curl -x http://127.0.0.1:7897 -fsSL https://opencode.ai/install | head -1 | grep -q "#!/usr/bin/env bash"; then
    echo "  ✅ 可以通过代理下载 OpenCode 安装脚本"
else
    echo "  ❌ 无法通过代理访问 GitHub raw"
    exit 1
fi
echo ""

echo "✓ 步骤 3: 验证代码修改已生效"
if grep -q "env: process.env" ./packages/controller/dist/http/services/opencode-install.service.js; then
    echo "  ✅ controller 构建产物包含环境变量继承代码"
else
    echo "  ❌ controller 构建产物缺少环境变量继承代码"
    exit 1
fi
echo ""

echo "✓ 步骤 4: 验证启动脚本配置正确"
if grep -q "http://127.0.0.1:7897" ./start-controller-with-proxy.sh; then
    echo "  ✅ 启动脚本包含正确的代理配置"
else
    echo "  ❌ 启动脚本代理配置不正确"
    exit 1
fi
echo ""

echo "✓ 步骤 5: 模拟 OpenCode 安装命令"
echo "  测试命令: bash -c 'curl -fsSL https://opencode.ai/install | head -20'"
if bash -c 'curl -fsSL https://opencode.ai/install | head -20' 2>&1 | grep -q "OpenCode Installer"; then
    echo "  ✅ 安装命令可以正常执行（通过继承的代理环境变量）"
else
    echo "  ❌ 安装命令执行失败"
    exit 1
fi
echo ""

echo "=========================================="
echo "✅ 所有验证通过！"
echo "=========================================="
echo ""
echo "下一步操作："
echo "1. 运行: ./start-controller-with-proxy.sh"
echo "2. 访问: http://localhost:3000/setup"
echo "3. 选择 'all-in-one' 预设并安装 OpenCode"
echo ""
echo "预期结果："
echo "- 不再出现 'curl: (35) Recv failure' 错误"
echo "- OpenCode 安装成功完成"
echo ""
