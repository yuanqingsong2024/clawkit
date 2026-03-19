# Setup 向导使用说明

## 功能概述

Setup 向导提供了一键配置与部署 clawkit 的 Web 界面，支持：

- 选择预设拓扑（当前内置 all-in-one / hybrid）
- 在线编辑 manifest YAML 配置
- 实时查看部署进度与日志
- 失败步骤提示与整轮重试

> 当前阶段是**最小可用版本**：
>
> - 已支持“选择预设 → 修改必要配置 → 点击确认启动 → 实时查看每一步状态/失败信息”
> - **尚未实现**逐字段表单式向导，也不是完整的可视化配置器
> - 如需填写必要信息，当前方式仍然是直接修改 YAML

## 访问方式

启动 controller 后，访问 Web Console 并点击左侧导航栏的"向导"菜单。

```bash
# 启动 controller
CLAWKIT_MANIFEST_PATH=./examples/all-in-one.yaml node ./packages/controller/dist/index.js

# 浏览器访问
open http://127.0.0.1:8787/setup
```

## 使用流程

### 1. 选择部署拓扑

向导当前提供两个预设配置：

- **单机模式（all-in-one）**：所有组件运行在同一台机器
- **混合模式（hybrid）**：OpenClaw + controller 在云端，worker + OpenCode 在本地

点击对应按钮即可加载预设配置。

> 说明：`split` 拓扑暂未提供单独预设按钮，但可通过编辑 YAML 手动配置。

### 2. 编辑 Manifest

预设配置会自动填充到编辑器中，你可以根据实际环境修改：

- 端口号
- 节点配置
- 项目路径
- OpenClaw webhook token

编辑器支持完整的 YAML 语法。

### 3. 启动部署

点击"启动部署"按钮后，系统会自动执行以下步骤：

1. **生成 manifest**：保存配置文件
2. **执行 doctor**：诊断环境与配置
3. **执行 plan**：生成部署计划
4. **执行 apply**：写入配置文件
5. **检查 controller 状态**：验证 controller 健康接口
6. **检查 worker 状态**：验证 worker 注册情况
7. **检查 OpenCode 状态**：验证 OpenCode server 可达性
8. **检查 OpenClaw 配置**：验证 webhook token 配置
9. **执行最小 smoke test**：综合验证所有组件
10. **生成结果摘要**：输出最终报告

### 4. 实时状态展示

部署过程中，页面会实时显示：

- **步骤进度**：每个步骤的执行状态（pending/running/success/failed）
- **实时日志**：步骤执行的详细输出
- **错误信息**：失败步骤的具体错误原因

### 5. 失败处理

如果部署失败，页面会显示：

- 失败步骤的错误信息
- 执行摘要与建议
- "重试"按钮，可整轮重新执行

> 当前失败后不会自动执行 heal / 回滚；只会明确展示失败步骤，并给出手动 heal 提示与整轮重试入口。

## API 接口

向导页面调用以下后端接口：

### 获取 Schema

```http
GET /api/setup/schema
```

返回表单字段定义。当前版本前端尚未基于 schema 动态渲染逐字段表单，该接口主要用于后续扩展与一致性校验。

### 获取默认配置

```http
GET /api/setup/defaults
```

返回预设配置列表：

```json
{
  "success": true,
  "data": {
    "presets": [
      {
        "key": "all-in-one",
        "title": "单机模式（all-in-one）",
        "yamlText": "profile:\n  name: local-studio\n  ..."
      }
    ]
  }
}
```

### 启动 Setup Run

```http
POST /api/setup/runs
Content-Type: application/json

{
  "formData": {
    "profile": { "name": "...", "topology": "all-in-one" },
    "nodes": { ... },
    "services": { ... },
    "workers": [ ... ],
    "runtime": { ... }
  }
}
```

返回 run 详情：

```json
{
  "success": true,
  "data": {
    "session": { "sessionId": "...", "status": "ready" },
    "run": { "runId": "...", "status": "running" },
    "steps": [ ... ]
  }
}
```

### 查询 Run 详情

```http
GET /api/setup/runs/:runId
```

### 重试 Run

```http
POST /api/setup/runs/:runId/retry
```

### SSE 状态流

```http
GET /api/setup/runs/:runId/stream
```

实时推送事件：

- `setup.run`：run 状态更新
- `setup.step`：步骤状态更新
- `setup.log`：日志消息
- `setup.summary`：最终摘要

## 技术实现

### 前端

- **框架**：React + TypeScript
- **状态管理**：@tanstack/react-query
- **SSE 客户端**：原生 EventSource API
- **YAML 解析**：yaml 库

### 后端

- **路由**：`/api/setup/*`（setup-routes.ts）
- **编排器**：SetupOrchestrator（通过 WebConsoleService 复用现有 CLI service 能力，不新增独立部署实现）
- **状态管理**：SetupRunService（支持 SQLite 持久化）
- **SSE 推送**：SetupStreamService

### 数据模型

- **SetupSession**：会话级别容器
- **SetupRun**：单次执行实例
- **SetupStep**：原子步骤

## 注意事项

1. **Manifest 保存后不会自动生效**：需要手动重启 controller/worker 进程
2. **Worker 必须先注册**：否则"检查 worker 状态"步骤会失败
3. **OpenCode 必须先启动**：否则"检查 OpenCode 状态"步骤会失败
4. **Webhook token 建议配置**：否则后续 OpenClaw 调用会失败

## 故障排查

### 问题：启动部署后无响应

**原因**：SSE 连接失败

**解决**：
1. 检查浏览器控制台是否有 CORS 错误
2. 确认 controller 的 `publicUrl` 配置正确
3. 尝试刷新页面重新连接

### 问题：Worker 检查失败

**原因**：没有已注册的 worker

**解决**：
1. 启动 worker 进程
2. 确认 worker 成功注册到 controller
3. 检查 worker 心跳是否正常

### 问题：OpenCode 检查失败

**原因**：OpenCode server 未启动或端口不匹配

**解决**：
1. 启动 OpenCode：`opencode serve --port 4096`
2. 确认端口与 manifest 中配置一致
3. 检查防火墙是否阻止连接

## 测试验证

项目提供了自动化测试脚本：

```bash
node ./scripts/test-setup-wizard.js
```

该脚本会：
1. 启动 controller
2. 调用 setup API
3. 验证完整流程
4. 输出执行结果

## 后续扩展

当前版本为最小可用版本，后续可扩展：

- 表单动态渲染（基于 schema）
- 历史 run 列表查看
- 断点续跑机制
- 配置模板管理
- 多环境配置切换
