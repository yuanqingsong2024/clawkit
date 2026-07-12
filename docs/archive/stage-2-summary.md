# Worker 骨架 + 最小派发链路阶段总结

**完成时间**：2026-03-11

**阶段目标**：在不接入真实 OpenCode 执行的前提下，建立 controller 与 worker 之间的最小可用派发链路。

---

## 一、已完成功能

### 1. Shared 包扩展

**新增类型定义**：
- `WorkerRecord`：Worker 注册记录
- `WorkerStatus`：Worker 状态枚举（idle/busy/offline）
- `DispatchRecord`：任务派发记录
- `DispatchStatus`：派发状态枚举（pending/dispatched/accepted/failed/cancelled）
- `WorkerRegisterRequest`：Worker 注册请求
- `WorkerHeartbeatRequest`：Worker 心跳请求
- `WorkerPullTaskResponse`：Worker 拉取任务响应
- `WorkerSubmitResultRequest`：Worker 提交结果请求
- `TaskExecutor`：任务执行器抽象接口
- `TaskExecutionContext`：任务执行上下文
- `TaskExecutionResult`：任务执行结果

**新增错误码**：
- `TASK_NOT_FOUND`：任务不存在
- `WORKER_NOT_FOUND`：Worker 未注册
- `NO_AVAILABLE_WORKER`：没有可用的 worker

**文件清单**：
- `packages/shared/src/types/worker-record.ts`
- `packages/shared/src/types/dispatch-record.ts`
- `packages/shared/src/types/worker-api.ts`
- `packages/shared/src/interfaces/task-executor.ts`

---

### 2. Controller 包扩展

**新增服务**：

1. **WorkerRegistry**（`services/worker-registry.ts`）
   - Worker 注册与更新
   - 心跳接收与超时检测
   - Worker 状态管理（idle/busy/offline）
   - 可用 worker 查询
   - Worker 选择策略：
     - 优先匹配 supportedProjects 包含 projectKey 的 worker
     - 其次匹配支持通配符 `*` 的 worker
     - 无可用 worker 时抛出错误

2. **DispatchService**（`services/dispatch-service.ts`）
   - 任务派发（仅 approved 状态）
   - Worker 选择与分配
   - 任务拉取（poll 模式）
   - 结果回传处理
   - 状态流转管理
   - 派发记录查询

3. **ServiceContainer**（`http/services/service-container.ts`）
   - 统一管理所有服务实例
   - 依赖注入容器

**新增 HTTP 路由**：

1. **Worker 路由**（`http/routes/workers-routes.ts`）
   - `POST /api/workers/register`：注册 worker
   - `POST /api/workers/:workerId/heartbeat`：发送心跳
   - `GET /api/workers/:workerId/pull`：拉取任务
   - `POST /api/workers/:workerId/result`：提交结果
   - `GET /api/workers`：查询 worker 列表
   - `GET /api/workers/:workerId`：查询 worker 详情

2. **Dispatch 路由**（`http/routes/dispatches-routes.ts`）
   - `POST /api/dispatches`：派发任务
   - `GET /api/dispatches/:taskId`：查询派发记录
   - `GET /api/dispatches`：查询所有派发记录

**扩展功能**：
- 任务状态查询接口现在包含 `dispatchInfo` 和 `workerInfo`
- TaskMemory.executionSummary 扩展支持占位执行结果

**文件清单**：
- `packages/controller/src/services/worker-registry.ts`
- `packages/controller/src/services/dispatch-service.ts`
- `packages/controller/src/http/services/service-container.ts`
- `packages/controller/src/http/routes/workers-routes.ts`
- `packages/controller/src/http/routes/dispatches-routes.ts`

---

### 3. Worker 包实现

**核心组件**：

1. **配置加载**（`config.ts`）
   - 从环境变量加载配置
   - 支持配置项：
     - `WORKER_ID`：Worker 唯一标识
     - `WORKER_NAME`：Worker 名称
     - `WORKER_NODE_NAME`：节点名称
     - `WORKER_CONNECT_MODE`：连接模式（pull/push）
     - `WORKER_TAGS`：标签（逗号分隔）
     - `WORKER_SUPPORTED_PROJECTS`：支持的项目（逗号分隔）
     - `CONTROLLER_URL`：Controller 地址
     - `WORKER_HEARTBEAT_INTERVAL_MS`：心跳间隔（默认 10 秒）
     - `WORKER_POLL_INTERVAL_MS`：任务拉取间隔（默认 5 秒）

2. **注册服务**（`services/registration-service.ts`）
   - 向 controller 注册 worker
   - 支持重复注册（更新信息）

3. **心跳服务**（`services/heartbeat-service.ts`）
   - 定期发送心跳
   - 上报当前状态和任务 ID
   - 可启动/停止

4. **任务拉取服务**（`services/task-pull-service.ts`）
   - 从 controller 拉取任务
   - 返回任务信息或无任务标记

5. **结果提交服务**（`services/result-submit-service.ts`）
   - 提交任务执行结果
   - 包含状态、摘要、日志、风险等信息

6. **占位执行器**（`executors/placeholder-executor.ts`）
   - 实现 TaskExecutor 接口
   - 模拟 2 秒执行时间
   - 生成占位结果（placeholderExecution=true）
   - 不执行真实代码修改

7. **Worker 主类**（`worker.ts`）
   - 统一管理所有服务
   - 启动流程：注册 → 心跳 → 轮询任务
   - 任务执行流程：拉取 → 执行 → 回传
   - 错误处理与状态管理

**文件清单**：
- `packages/worker/src/config.ts`
- `packages/worker/src/services/registration-service.ts`
- `packages/worker/src/services/heartbeat-service.ts`
- `packages/worker/src/services/task-pull-service.ts`
- `packages/worker/src/services/result-submit-service.ts`
- `packages/worker/src/executors/placeholder-executor.ts`
- `packages/worker/src/worker.ts`

---

### 4. 文档补充

**新增文档**：

1. **worker.md**（191 行）
   - Worker 架构说明
   - 配置说明
   - 使用方式
   - 工作流程
   - 占位执行器说明
   - 错误处理
   - 状态管理
   - 限制与约束

2. **dispatch-flow.md**（367 行）
   - 完整派发流程
   - 状态流转图
   - Worker 选择策略
   - API 接口说明
   - 错误处理
   - 时序图
   - 下一阶段规划

3. **worker-api.md**（609 行）
   - 完整 API 文档
   - 9 个接口详细说明
   - 请求/响应示例
   - 数据模型说明
   - 错误码列表
   - 使用示例
   - 注意事项

**文件清单**：
- `docs/worker.md`
- `docs/dispatch-flow.md`
- `docs/worker-api.md`

---

### 5. 测试补充

**新增测试**：

1. **worker-registry.test.js**
   - Worker 注册测试
   - 心跳测试
   - 可用 worker 查询测试
   - Worker 选择测试
   - 状态管理测试
   - 多 worker 测试
   - 通配符匹配测试
   - ✅ 8 个测试全部通过

2. **dispatch-service.test.js**
   - 任务派发测试
   - 任务拉取测试
   - 结果提交测试
   - 状态流转测试
   - 派发记录查询测试
   - ✅ 7 个测试全部通过

3. **no-worker-error.test.js**
   - 无可用 worker 错误测试
   - ✅ 测试通过

**文件清单**：
- `packages/controller/tests/worker-registry.test.js`
- `packages/controller/tests/dispatch-service.test.js`
- `packages/controller/tests/no-worker-error.test.js`

---

## 二、完整派发链路

### 状态流转

```
TaskStatus:
draft → prompt_generated → waiting_approval → approved
  ↓
dispatched → running → done/failed

DispatchStatus:
pending → dispatched → accepted

WorkerStatus:
idle → busy → idle
```

### 完整流程

1. **任务创建与审批**
   - 用户通过 OpenClaw 创建任务
   - Controller 生成 TaskDraft 和 PromptDraft
   - 用户确认，任务状态变为 `approved`

2. **任务派发**
   - Controller 调用 `DispatchService.dispatchTask()`
   - 选择可用 worker（优先匹配项目，其次通配符）
   - 创建 DispatchRecord
   - 标记 worker 为 `busy`
   - 更新任务状态为 `dispatched`

3. **Worker 拉取任务**
   - Worker 定期调用 `GET /api/workers/:workerId/pull`
   - Controller 返回派发给该 worker 的任务
   - 更新 DispatchRecord 状态为 `accepted`
   - 更新任务状态为 `running`

4. **Worker 执行任务**
   - Worker 调用 `PlaceholderExecutor.execute()`
   - 模拟执行 2 秒
   - 生成占位结果

5. **结果回传**
   - Worker 调用 `POST /api/workers/:workerId/result`
   - Controller 更新任务状态为 `done` 或 `failed`
   - 更新 TaskMemory.executionSummary
   - 标记 worker 为 `idle`

### 验证结果

✅ 整条链路已打通，所有测试通过

---

## 三、关键设计决策

### 1. Worker 选择策略

**策略**：
1. 优先选择 supportedProjects 包含 projectKey 的 worker
2. 其次选择 supportedProjects 包含 `*` 的 worker
3. 无可用 worker 时抛出错误

**理由**：
- 精确匹配优先，确保专用 worker 优先处理对应项目
- 通配符作为后备，提供灵活性
- 明确错误，避免任务派发到不合适的 worker

### 2. Poll 模式

**当前实现**：Worker 主动拉取任务

**理由**：
- 实现简单，无需维护长连接
- Worker 可控制拉取频率
- 适合当前阶段验证链路

**下一阶段**：实现 Push 模式（WebSocket）

### 3. 占位执行器

**设计**：
- 实现 TaskExecutor 接口
- 标记 placeholderExecution=true
- 不执行真实操作

**理由**：
- 验证派发链路完整性
- 为后续接入真实 OpenCode 预留接口
- 保持接口一致性

### 4. 服务容器

**设计**：ServiceContainer 统一管理服务实例

**理由**：
- 依赖注入，便于测试
- 统一初始化顺序
- 便于后续扩展

---

## 四、当前限制

### 功能限制

1. **不执行真实 OpenCode**
   - 当前使用 PlaceholderExecutor
   - 不修改代码
   - 不运行测试
   - 不执行 Git 操作

2. **仅支持 Poll 模式**
   - Worker 主动拉取任务
   - 不支持 Push 模式

3. **单任务执行**
   - 一个 worker 同时只能执行一个任务
   - 不支持任务队列

4. **无持久化**
   - Worker 和 Dispatch 记录仅存储在内存
   - 重启后数据丢失

5. **简单调度策略**
   - 仅支持项目匹配和通配符
   - 不支持负载均衡
   - 不支持优先级调度

### 技术限制

1. **无超时控制**
   - 任务执行无超时限制
   - 心跳超时固定 30 秒

2. **无重试机制**
   - 任务执行失败不自动重试
   - 心跳失败不重连

3. **无监控指标**
   - 无性能监控
   - 无任务统计

---

## 五、验收标准

### 已完成验收项

✅ Worker 可以启动  
✅ Worker 可以注册到 controller  
✅ Worker 可以发送心跳  
✅ approved 任务可以被派发  
✅ Worker 可以通过 poll 拉到任务  
✅ Worker 可以回传占位执行结果  
✅ Controller 可以更新任务状态  
✅ 整条链路不依赖真实 OpenCode  
✅ 文档与测试齐全  
✅ 没有越界实现真实代码执行  

---

## 六、下一阶段规划

### 阶段目标

接入真实 OpenCode 执行器，实现真实代码修改与测试执行。

### 待实现功能

1. **OpenCodeExecutor**
   - 替换 PlaceholderExecutor
   - 调用真实 OpenCode API
   - 执行真实代码修改
   - 运行真实测试
   - 执行真实 Git 操作

2. **持久化**
   - Worker 注册信息持久化
   - Dispatch 记录持久化
   - 任务状态持久化

3. **Push 模式**
   - WebSocket 连接
   - Controller 主动推送任务

4. **任务队列**
   - 支持任务排队
   - 优先级调度

5. **监控与日志**
   - 性能监控
   - 任务统计
   - 结构化日志

6. **错误处理增强**
   - 任务超时控制
   - 自动重试机制
   - 失败恢复策略

---

## 七、技术债务

1. **类型安全**
   - ControllerApiService 中 dispatchService 和 workerRegistry 使用 `any` 类型
   - 建议：定义明确的接口类型

2. **错误处理**
   - 部分错误处理不够细致
   - 建议：统一错误处理策略

3. **测试覆盖**
   - 缺少 HTTP 路由的集成测试
   - 建议：补充端到端测试

4. **配置管理**
   - Worker 配置仅支持环境变量
   - 建议：支持配置文件

---

## 八、总结

本阶段成功建立了 controller 与 worker 之间的最小可用派发链路，实现了从任务审批到 worker 执行再到结果回传的完整流程。

**核心成果**：
- ✅ 3 个包扩展（shared、controller、worker）
- ✅ 2 个核心服务（WorkerRegistry、DispatchService）
- ✅ 9 个 HTTP 接口
- ✅ 1 个占位执行器
- ✅ 3 份详细文档（共 1167 行）
- ✅ 3 个测试文件（共 16 个测试用例）
- ✅ 整条链路打通验证

**代码质量**：
- 所有包构建通过
- 所有测试通过
- 代码注释完整（中文）
- 文档齐全（中文）

**下一步**：
接入真实 OpenCode 执行器，实现真实代码修改与测试执行。
