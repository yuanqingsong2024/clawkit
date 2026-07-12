# Setup Wizard SSE 实时部署功能交付文档

## 功能概述

为 clawkit Web Console 的 Setup Wizard 页面添加了以下高级功能：

1. **自动环境检查**：页面加载时自动检测 Docker、Docker Compose、端口占用情况
2. **实时日志流**：通过 Server-Sent Events (SSE) 实时推送部署/安装日志
3. **可视化进度条**：直观展示部署/安装进度（0% → 100%）
4. **一键部署按钮**：OpenClaw 和 OpenCode 的独立部署功能

---

## 架构设计

### 后端 API

#### 1. 环境检查 API

**端点**: `GET /api/setup/check-environment`

**功能**: 快速检查部署前置条件（5 秒超时）

**响应格式**:
```typescript
{
  overall: 'pass' | 'warn' | 'fail',
  checks: [
    {
      name: 'Docker',
      status: 'pass' | 'warn' | 'fail',
      message: '检查结果描述',
      details?: '详细信息'
    },
    // ... 其他检查项
  ]
}
```

**检查项**:
- Docker 是否安装并运行
- Docker Compose V2 是否可用
- 端口 18000（OpenClaw）是否被占用
- 端口 4096（Controller）是否被占用

**实现文件**: `packages/controller/src/http/services/environment-check-service.ts`

---

#### 2. OpenClaw SSE 部署端点

**端点**: `POST /api/setup/openclaw/deploy/stream`

**协议**: Server-Sent Events (SSE)

**事件类型**:

| 事件名 | 数据格式 | 说明 |
|--------|----------|------|
| `openclaw.stage` | `{ stage: string, progress: number }` | 阶段变更（0/25/50/75/100） |
| `openclaw.log` | `{ log: string }` | 实时日志输出 |
| `openclaw.complete` | `{ success: boolean, message: string, openClawUrl?: string }` | 部署完成 |
| `openclaw.error` | `{ error: string, details?: string }` | 部署失败 |

**部署阶段**:
1. **准备配置** (0%) - 生成 Docker Compose 文件
2. **拉取镜像** (25%) - 执行 `docker compose pull`
3. **启动容器** (50%) - 执行 `docker compose up -d`
4. **健康检查** (75%) - 轮询 `/health` 端点
5. **完成** (100%) - 返回服务 URL

**心跳机制**: 15 秒间隔发送 `:ping\n\n` 保持连接

**资源清理**: 客户端断开时自动终止所有子进程

**实现文件**: 
- `packages/controller/src/http/services/openclaw-deploy.service.ts`
- `packages/controller/src/http/routes/setup-routes.ts` (第 135-168 行)

---

#### 3. OpenCode SSE 安装端点

**端点**: `POST /api/setup/opencode/install/stream`

**协议**: Server-Sent Events (SSE)

**事件类型**:

| 事件名 | 数据格式 | 说明 |
|--------|----------|------|
| `opencode.stage` | `{ stage: string, progress: number }` | 阶段变更 |
| `opencode.log` | `{ log: string }` | 实时日志输出 |
| `opencode.complete` | `{ success: boolean, message: string, openCodeUrl?: string, binaryPath?: string }` | 安装完成 |
| `opencode.error` | `{ error: string, details?: string }` | 安装失败 |

**安装阶段**:
1. **检查环境** - 验证系统要求
2. **下载二进制** - 从官方源下载
3. **启动服务** - 执行 OpenCode 二进制
4. **健康检查** - 验证服务可用性
5. **完成** - 返回服务 URL 和二进制路径

**心跳机制**: 15 秒间隔发送 `:ping\n\n` 保持连接

**资源清理**: 客户端断开时自动终止所有子进程

**实现文件**: 
- `packages/controller/src/http/services/opencode-install.service.ts`
- `packages/controller/src/http/routes/setup-routes.ts` (第 170-203 行)

---

### 前端实现

#### 状态管理

**环境检查状态**:
```typescript
interface EnvironmentCheckResponse {
  overall: 'pass' | 'warn' | 'fail';
  checks: EnvironmentCheckItem[];
}

const [envCheckResult, setEnvCheckResult] = useState<EnvironmentCheckResponse | null>(null);
```

**SSE 部署状态**:
```typescript
interface SSEDeployState {
  isDeploying: boolean;
  stage: string;
  progress: number;
  logs: string[];
  result: { success: boolean; message: string; openClawUrl?: string } | null;
  error: string | null;
}

const [openClawDeployState, setOpenClawDeployState] = useState<SSEDeployState>({
  isDeploying: false,
  stage: '',
  progress: 0,
  logs: [],
  result: null,
  error: null,
});
```

**SSE 安装状态**:
```typescript
interface SSEInstallState {
  isInstalling: boolean;
  stage: string;
  progress: number;
  logs: string[];
  result: { success: boolean; message: string; openCodeUrl?: string; binaryPath?: string } | null;
  error: string | null;
}

const [openCodeInstallState, setOpenCodeInstallState] = useState<SSEInstallState>({
  isInstalling: false,
  stage: '',
  progress: 0,
  logs: [],
  result: null,
  error: null,
});
```

---

#### SSE 连接函数

**OpenClaw 部署**:
```typescript
const startOpenClawDeploy = () => {
  const eventSource = new EventSource('/api/setup/openclaw/deploy/stream', {
    withCredentials: true,
  });

  eventSource.addEventListener('openclaw.stage', (e) => {
    const data = JSON.parse(e.data);
    setOpenClawDeployState(prev => ({
      ...prev,
      stage: data.stage,
      progress: data.progress,
    }));
  });

  eventSource.addEventListener('openclaw.log', (e) => {
    const data = JSON.parse(e.data);
    setOpenClawDeployState(prev => ({
      ...prev,
      logs: [...prev.logs, data.log],
    }));
  });

  eventSource.addEventListener('openclaw.complete', (e) => {
    const data = JSON.parse(e.data);
    setOpenClawDeployState(prev => ({
      ...prev,
      isDeploying: false,
      result: data,
    }));
    eventSource.close();
  });

  eventSource.addEventListener('openclaw.error', (e) => {
    const data = JSON.parse(e.data);
    setOpenClawDeployState(prev => ({
      ...prev,
      isDeploying: false,
      error: data.error,
    }));
    eventSource.close();
  });

  eventSource.onerror = () => {
    setOpenClawDeployState(prev => ({
      ...prev,
      isDeploying: false,
      error: 'SSE 连接失败',
    }));
    eventSource.close();
  };

  openClawEventSourceRef.current = eventSource;
};
```

**OpenCode 安装**: 类似实现，事件名前缀为 `opencode.*`

---

#### UI 组件

**环境检查展示**:
```tsx
{envCheckResult && (
  <div className="mb-4 p-3 rounded-lg border border-gray-200">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-medium">环境检查</span>
      <Badge variant={
        envCheckResult.overall === 'pass' ? 'success' :
        envCheckResult.overall === 'warn' ? 'warning' : 'destructive'
      }>
        {envCheckResult.overall === 'pass' ? '通过' :
         envCheckResult.overall === 'warn' ? '警告' : '失败'}
      </Badge>
    </div>
    <div className="space-y-1">
      {envCheckResult.checks.map((check, idx) => (
        <div key={idx} className="text-xs flex items-center gap-2">
          <span className={
            check.status === 'pass' ? 'text-green-600' :
            check.status === 'warn' ? 'text-yellow-600' : 'text-red-600'
          }>
            {check.status === 'pass' ? '✓' :
             check.status === 'warn' ? '⚠' : '✗'}
          </span>
          <span>{check.name}: {check.message}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

**进度条组件**:
```tsx
{openClawDeployState.isDeploying && (
  <div className="mt-3">
    <div className="flex items-center justify-between text-xs mb-1">
      <span className="text-gray-600">{openClawDeployState.stage}</span>
      <span className="text-gray-600">{openClawDeployState.progress}%</span>
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div
        className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${openClawDeployState.progress}%` }}
      />
    </div>
  </div>
)}
```

**实时日志展示**:
```tsx
{openClawDeployState.logs.length > 0 && (
  <details className="mt-3">
    <summary className="text-xs text-gray-600 cursor-pointer">
      查看部署日志 ({openClawDeployState.logs.length} 条)
    </summary>
    <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono max-h-40 overflow-y-auto">
      {openClawDeployState.logs.map((log, idx) => (
        <div key={idx} className="text-gray-700">{log}</div>
      ))}
    </div>
  </details>
)}
```

**部署按钮**:
```tsx
<button
  onClick={startOpenClawDeploy}
  disabled={isAnyDeploying}
  className="px-4 py-2 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
>
  {openClawDeployState.isDeploying ? (
    <>
      <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
      部署中...
    </>
  ) : (
    '一键部署 OpenClaw'
  )}
</button>
```

---

## 代码变更统计

### 后端

| 文件 | 变更 | 说明 |
|------|------|------|
| `packages/controller/src/http/services/environment-check-service.ts` | +313 行 | 新增环境检查服务 |
| `packages/controller/src/http/services/openclaw-deploy.service.ts` | +473 行 | 新增 SSE 部署服务 |
| `packages/controller/src/http/services/opencode-install.service.ts` | +345 行 | 新增 SSE 安装服务 |
| `packages/controller/src/http/routes/setup-routes.ts` | +95 行 | 新增 3 个 API 端点 |
| **总计** | **+1226 行** | |

### 前端

| 文件 | 变更 | 说明 |
|------|------|------|
| `packages/web/src/pages/SetupWizardPage.tsx` | +380 行, -5 行 | SSE 集成、进度条、日志展示 |

---

## 测试验证

### 构建验证

✅ **后端 TypeScript 编译**: 通过（仅配置警告，无类型错误）
```bash
cd packages/controller
pnpm build
# 输出: 编译成功
```

✅ **前端 Vite 构建**: 通过（8.11 秒）
```bash
cd packages/web
pnpm build
# 输出: dist/index.html 生成成功
```

✅ **LSP 类型检查**: 通过（零错误）
```bash
# SetupWizardPage.tsx: 无类型错误
# setup-routes.ts: 无类型错误
# 所有服务文件: 无类型错误
```

---

### 手动测试指南

#### 1. 启动 Controller 服务

```bash
cd packages/clawkit/packages/controller
pnpm dev
```

#### 2. 测试环境检查 API

```bash
curl http://localhost:4096/api/setup/check-environment
```

**预期输出**:
```json
{
  "overall": "pass",
  "checks": [
    {
      "name": "Docker",
      "status": "pass",
      "message": "Docker 已安装并运行"
    },
    {
      "name": "Docker Compose V2",
      "status": "pass",
      "message": "Docker Compose V2 可用"
    },
    {
      "name": "端口 18000",
      "status": "pass",
      "message": "端口未被占用"
    },
    {
      "name": "端口 4096",
      "status": "warn",
      "message": "端口已被占用（当前服务）"
    }
  ]
}
```

#### 3. 测试 OpenClaw SSE 端点

```bash
curl -N -X POST http://localhost:4096/api/setup/openclaw/deploy/stream
```

**预期输出**（SSE 事件流）:
```
:ping

event: openclaw.stage
data: {"stage":"准备配置","progress":0}

event: openclaw.log
data: {"log":"生成 Docker Compose 配置..."}

event: openclaw.stage
data: {"stage":"拉取镜像","progress":25}

event: openclaw.log
data: {"log":"docker compose pull"}

:ping

event: openclaw.stage
data: {"stage":"启动容器","progress":50}

event: openclaw.complete
data: {"success":true,"message":"OpenClaw 部署成功","openClawUrl":"http://localhost:18000"}
```

#### 4. 测试 OpenCode SSE 端点

```bash
curl -N -X POST http://localhost:4096/api/setup/opencode/install/stream
```

**预期输出**: 类似 OpenClaw，事件名前缀为 `opencode.*`

#### 5. 前端集成测试

```bash
cd packages/web
pnpm dev
```

访问 `http://localhost:5173/setup-wizard`，验证：

- [ ] 页面加载时自动执行环境检查
- [ ] 环境检查结果正确展示（pass/warn/fail 状态）
- [ ] 点击"一键部署 OpenClaw"按钮
  - [ ] 按钮显示"部署中..."和 spinner
  - [ ] 进度条从 0% 增长到 100%
  - [ ] 实时日志逐行展示
  - [ ] 部署成功后显示服务 URL
  - [ ] 部署失败后显示错误信息和重试按钮
- [ ] 点击"一键安装 OpenCode"按钮
  - [ ] 同上验证点
- [ ] 并发部署防护：一个部署进行中时，另一个按钮禁用

---

## 技术亮点

### 1. 事件驱动架构

使用 SSE 替代传统的轮询或 WebSocket，优势：
- **单向推送**: 服务器主动推送，客户端被动接收
- **自动重连**: 浏览器原生支持断线重连
- **HTTP 兼容**: 无需额外协议支持，穿透防火墙友好
- **轻量级**: 相比 WebSocket 更简单，适合单向数据流

### 2. 进程生命周期管理

**问题**: spawn 子进程可能因客户端断开而成为僵尸进程

**解决方案**:
- 使用 `activeProcesses: Set<ChildProcess>` 跟踪所有活动进程
- 监听 SSE 连接的 `close` 事件
- 连接断开时调用 `terminateAllProcesses()` 清理资源

```typescript
res.on('close', () => {
  clearInterval(heartbeatInterval);
  openClawDeployService.terminateAllProcesses();
});
```

### 3. 超时保护

**问题**: 环境检查可能因网络/系统问题卡住

**解决方案**: 每个检查项 5 秒超时
```typescript
const checkWithTimeout = async (
  checkFn: () => Promise<CheckResult>,
  timeoutMs: number = 5000
): Promise<CheckResult> => {
  return Promise.race([
    checkFn(),
    new Promise<CheckResult>((resolve) =>
      setTimeout(() => resolve({
        name: 'Timeout',
        status: 'fail',
        message: '检查超时',
      }), timeoutMs)
    ),
  ]);
};
```

### 4. 心跳保活

**问题**: SSE 连接可能因代理/防火墙超时而断开

**解决方案**: 15 秒间隔发送心跳
```typescript
const heartbeatInterval = setInterval(() => {
  res.write(':ping\n\n');
}, 15000);
```

### 5. 渐进式 UI 反馈

**阶段进度**: 0% → 25% → 50% → 75% → 100%
**实时日志**: 逐行展示 stdout/stderr
**可折叠日志**: 默认折叠，点击展开查看详情
**视觉反馈**: 渐变色进度条 + spinner 动画

---

## 已知限制

### 1. 并发部署限制

**当前行为**: 同一时间只能执行一个部署/安装任务

**原因**: 
- Docker Compose 可能冲突（端口占用、网络配置）
- 资源竞争（CPU、内存、磁盘 I/O）

**未来改进**: 支持队列机制，自动排队执行

### 2. 日志缓冲限制

**当前行为**: 前端内存中存储所有日志

**风险**: 长时间部署可能导致内存占用过高

**未来改进**: 
- 限制日志条数（如最多 1000 条）
- 实现日志分页或虚拟滚动
- 提供日志下载功能

### 3. 错误恢复

**当前行为**: 部署失败后需手动重试

**未来改进**:
- 自动重试机制（最多 3 次）
- 部分失败时的断点续传
- 回滚机制（失败时自动清理）

---

## 交付清单

### 代码文件

- [x] `packages/controller/src/http/services/environment-check-service.ts`
- [x] `packages/controller/src/http/services/openclaw-deploy.service.ts`
- [x] `packages/controller/src/http/services/opencode-install.service.ts`
- [x] `packages/controller/src/http/routes/setup-routes.ts`
- [x] `packages/web/src/pages/SetupWizardPage.tsx`

### Git 提交

- [x] `feat(controller): 添加环境检查和流式部署日志 API` (+1226 行)
- [x] `feat(web): 实现自动环境检查功能 (Wave 2.1)`
- [x] `feat(web): 实现 SSE 实时日志展示和进度条 (Wave 2.2-3)`

### 文档

- [x] 本交付文档 (`docs/setup-wizard-sse-deployment.md`)

### 验证

- [x] 后端 TypeScript 编译通过
- [x] 前端 Vite 构建通过
- [x] LSP 类型检查零错误
- [ ] 手动测试（需运行时环境）

---

## 后续建议

### 短期优化

1. **错误信息国际化**: 当前错误信息为中文，考虑支持多语言
2. **日志高亮**: 为不同级别的日志添加颜色（info/warn/error）
3. **部署预检**: 在实际部署前执行 dry-run 验证配置

### 长期规划

1. **部署历史**: 记录每次部署的日志和结果，支持查看历史
2. **部署模板**: 支持自定义部署参数（端口、资源限制等）
3. **监控集成**: 部署完成后自动启动健康监控和告警

---

## 联系方式

如有问题或建议，请联系开发团队或提交 Issue。

**文档版本**: v1.0  
**最后更新**: 2026-05-03  
**作者**: Sisyphus (OhMyOpenCode AI Agent)
