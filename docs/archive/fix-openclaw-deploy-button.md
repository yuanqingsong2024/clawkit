# 修复 OpenClaw 一键部署按钮问题

## 问题现象

用户点击"一键部署 OpenClaw"按钮后：
- ❌ 直接完成，无进度提示
- ❌ 按钮未隐藏
- ❌ 无成功状态显示

## 根本原因

**前后端数据结构不匹配**：

### 后端发送（SSE 事件）
```typescript
// packages/controller/src/http/routes/setup-routes.ts
event: openclaw.complete
data: {"success":true,"message":"OpenClaw 部署成功","openClawUrl":"http://localhost:18000"}
```

### 前端期望（错误代码）
```typescript
// packages/web/src/pages/SetupWizardPage.tsx (修复前)
case 'openclaw.complete':
  result: data.result  // ❌ data.result 是 undefined
```

### 结果
- `openClawDeployState.result` 始终为 `undefined`
- 按钮显示条件 `!openClawDeployState.result` 始终为 `true` → 按钮不隐藏
- 成功提示条件 `openClawDeployState.result` 存在始终为 `false` → 无成功提示

## 修复方案

### 修改文件
`packages/web/src/pages/SetupWizardPage.tsx`

### 修改内容

**OpenClaw complete 事件处理（第 557 行）**：
```typescript
// 修复前
case 'openclaw.complete':
  setOpenClawDeployState(prev => ({
    ...prev,
    isDeploying: false,
    result: data.result,  // ❌ undefined
    stage: 'complete',
    progress: 100
  }));
  break;

// 修复后
case 'openclaw.complete':
  setOpenClawDeployState(prev => ({
    ...prev,
    isDeploying: false,
    result: data,  // ✅ 直接使用 data
    stage: 'complete',
    progress: 100
  }));
  break;
```

**OpenCode complete 事件处理（第 632 行）**：
```typescript
// 同样修复，保持一致性
case 'opencode.complete':
  setOpenCodeDeployState(prev => ({
    ...prev,
    isDeploying: false,
    result: data,  // ✅ 修复
    stage: 'complete',
    progress: 100
  }));
  break;
```

## 验证步骤

### 1. 重新构建
```bash
cd packages/web
pnpm build
```

### 2. 启动 Controller
```bash
cd packages/controller
pnpm start
```

### 3. 访问 Web Console
打开浏览器：http://localhost:8787

### 4. 手动测试
1. 进入 Setup 页面
2. 点击"一键部署 OpenClaw"按钮
3. **预期行为**：
   - ✅ 显示部署进度（preparing → pulling → starting → health-check → complete）
   - ✅ 显示实时日志
   - ✅ 部署成功后按钮隐藏
   - ✅ 显示绿色成功提示："OpenClaw 部署成功"
   - ✅ 显示 OpenClaw URL：http://localhost:18000

### 5. 验证 SSE 端点（可选）
```bash
curl -N http://localhost:8787/api/setup/openclaw/deploy/stream
```

**预期输出**：
```
event: openclaw.stage
data: {"stage":"preparing","progress":0}

event: openclaw.stage
data: {"stage":"pulling","progress":25}

event: openclaw.log
data: {"log":" Image ghcr.io/openclaw/openclaw:latest Pulling "}

...

event: openclaw.complete
data: {"success":true,"message":"OpenClaw 部署成功","openClawUrl":"http://localhost:18000"}
```

## 效果对比

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| 进度显示 | ❌ 无 | ✅ 实时显示 |
| 日志输出 | ❌ 无 | ✅ 实时输出 |
| 按钮状态 | ❌ 始终显示 | ✅ 成功后隐藏 |
| 成功提示 | ❌ 无 | ✅ 绿色成功提示 |
| URL 显示 | ❌ 无 | ✅ 显示可点击链接 |

## 相关文件

- `packages/web/src/pages/SetupWizardPage.tsx` - 前端事件处理
- `packages/controller/src/http/routes/setup-routes.ts` - 后端 SSE 端点
- `packages/controller/src/http/services/openclaw-deploy.service.ts` - 部署服务

## 技术细节

### SSE 事件类型
- `openclaw.stage` - 阶段变更（preparing/pulling/starting/health-check/complete）
- `openclaw.log` - 实时日志
- `openclaw.complete` - 部署成功
- `openclaw.error` - 部署失败

### 前端状态管理
```typescript
interface DeployState {
  isDeploying: boolean;
  stage: string;
  progress: number;
  logs: string[];
  result: { success: boolean; message: string; openClawUrl?: string } | null;
  error: string | null;
}
```

### 按钮显示逻辑
```typescript
{!openClawDeployState.result && (
  <button onClick={startOpenClawDeploy}>
    一键部署 OpenClaw
  </button>
)}
```

### 成功提示显示逻辑
```typescript
{openClawDeployState.result && (
  <div className="success-message">
    {openClawDeployState.result.message}
    {openClawDeployState.result.openClawUrl && (
      <a href={openClawDeployState.result.openClawUrl}>
        {openClawDeployState.result.openClawUrl}
      </a>
    )}
  </div>
)}
```

## 总结

这是一个典型的前后端数据结构不匹配问题：
- 后端发送的是扁平结构：`{ success, message, openClawUrl }`
- 前端错误地期望嵌套结构：`{ result: { success, message, openClawUrl } }`

修复方法很简单：将 `result: data.result` 改为 `result: data`，让前端直接使用后端发送的数据对象。

同时修复了 OpenCode 部署的相同问题，保持代码一致性。
