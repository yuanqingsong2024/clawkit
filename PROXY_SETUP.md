# 代理配置说明

## 问题背景

OpenCode 安装脚本托管在 GitHub，由于网络限制，直接访问 `raw.githubusercontent.com` 会出现 `curl: (35) Recv failure: Connection reset by peer` 错误。

## 解决方案

已修改 `packages/controller/src/http/services/opencode-install.service.ts`，使其支持通过环境变量配置代理。

## 使用方法

### 方式 1：使用提供的启动脚本（推荐）

```bash
# 在项目根目录执行
./start-controller-with-proxy.sh
```

该脚本会自动配置代理环境变量（http://127.0.0.1:7897）并启动 controller。

### 方式 2：手动配置环境变量

```bash
# 设置代理
export http_proxy=http://127.0.0.1:7897
export https_proxy=http://127.0.0.1:7897

# 启动 controller
cd packages/controller
node dist/index.js
```

### 方式 3：修改代理地址

如果你的代理端口不是 7897，编辑 `start-controller-with-proxy.sh`：

```bash
# 修改这两行为你的代理地址
export http_proxy=http://127.0.0.1:YOUR_PORT
export https_proxy=http://127.0.0.1:YOUR_PORT
```

## 验证步骤

1. 启动 controller（使用上述任一方式）
2. 打开 Web Console：http://localhost:3000/setup
3. 选择 "all-in-one" 预设
4. 在 OpenCode 配置中选择 "本地安装"
5. 点击 "一键配置"
6. 观察安装日志，应该能看到安装脚本成功下载并执行

## 测试代理是否工作

```bash
# 测试代理连通性
curl -x http://127.0.0.1:7897 -I https://www.google.com

# 测试通过代理下载 OpenCode 安装脚本
curl -x http://127.0.0.1:7897 -fsSL https://opencode.ai/install | head -20
```

如果上述命令成功，说明代理配置正确。

## 代码修改说明

修改位置：`packages/controller/src/http/services/opencode-install.service.ts`

```typescript
// 修改前
const child = spawn(command, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
});

// 修改后
const child = spawn(command, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: process.env,  // 继承父进程环境变量，包括代理配置
});
```

这个修改使得 spawn 的子进程能够继承父进程的环境变量，包括 `http_proxy` 和 `https_proxy`。

## 常见问题

### Q: 为什么需要配置代理？

A: OpenCode 安装脚本托管在 GitHub，在某些网络环境下无法直接访问 `raw.githubusercontent.com`。

### Q: 如何确认代理是否生效？

A: 查看 controller 启动日志，应该能看到 "代理地址: http://127.0.0.1:7897" 的提示。安装 OpenCode 时，如果能成功下载脚本，说明代理生效。

### Q: 可以使用 SOCKS5 代理吗？

A: 可以，但需要确保 curl 支持 SOCKS5。修改启动脚本中的代理地址为：

```bash
export http_proxy=socks5://127.0.0.1:1080
export https_proxy=socks5://127.0.0.1:1080
```

### Q: 不想使用代理怎么办？

A: 可以选择手动安装 OpenCode，然后在 Setup 向导中选择 "使用外部 OpenCode 服务"。详见主 README 的方案 2。

## 相关文件

- `start-controller-with-proxy.sh` - 带代理配置的 controller 启动脚本
- `packages/controller/src/http/services/opencode-install.service.ts` - OpenCode 安装服务
- `PROXY_SETUP.md` - 本文档
