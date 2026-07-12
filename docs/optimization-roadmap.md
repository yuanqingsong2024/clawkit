# clawkit 优化任务路线图

本文档记录 clawkit 项目的优化任务规划，按优先级分组。

## ✅ 已完成（v0.2.0）

### 高优先级任务（4/4 完成）

#### 1. Worker 并发执行能力 ✅
**状态**：已完成  
**实现**：
- 增加 `maxConcurrentTasks` 配置（默认 3）
- 使用 Map 管理并发任务
- 任务异步执行，互不阻塞

**影响**：性能提升 3 倍

---

#### 2. 任务执行超时控制 ✅
**状态**：已完成  
**实现**：
- 增加 `executionTimeoutMs` 配置（默认 30 分钟）
- 使用 Promise.race 实现超时控制
- 超时后自动终止任务

**影响**：防止长时间运行任务卡死 Worker

---

#### 3. 任务失败自动重试机制 ✅
**状态**：已完成  
**实现**：
- 增加 `maxRetries` 配置（默认 3 次）
- 指数退避重试策略（1s, 2s, 4s, 8s...）
- 重试日志清晰

**影响**：提升任务成功率

---

#### 4. Web Console 日志查看功能 ✅
**状态**：已完成  
**实现**：
- 创建 `/api/logs/:service` API
- 支持历史日志和实时日志流（SSE）
- 前端日志查看页面

**影响**：提升可观测性，无需 SSH 查看日志

---

## 📋 待实施任务

### 中优先级任务（0/5 完成）

#### 5. 优化 Setup 向导
**优先级**：中  
**预估工作量**：3-5 天  
**实现方案**：
- 将 YAML 编辑改为分步表单
- 每个字段增加说明和示例
- 实时校验和错误提示
- 支持预设模板快速填充

**收益**：降低使用门槛，提升用户体验

**涉及文件**：
- `packages/web/src/pages/SetupWizardPage.tsx`
- `packages/web/src/components/SetupForm.tsx`（新建）

---

#### 6. 任务列表分页、搜索和过滤
**优先级**：中  
**预估工作量**：2-3 天  
**实现方案**：
```typescript
// Controller API 增加分页参数
GET /api/tasks?page=1&pageSize=20&status=RUNNING&projectKey=clawkit&startDate=2024-01-01

// 前端使用 TanStack Query 实现分页
const { data } = useQuery({
  queryKey: ['tasks', page, filters],
  queryFn: () => fetchTasks({ page, ...filters })
});
```

**收益**：任务量大时性能提升

**涉及文件**：
- `packages/controller/src/http/routes/tasks-routes.ts`
- `packages/web/src/pages/TasksPage.tsx`

---

#### 7. 任务执行实时进度反馈
**优先级**：中  
**预估工作量**：4-6 天  
**实现方案**：
- Worker 执行过程中定期上报进度
- Controller 通过 WebSocket 推送进度给前端
- 前端展示进度条和实时日志

**收益**：用户可实时了解任务执行情况

**涉及文件**：
- `packages/controller/src/http/websocket.ts`（新建）
- `packages/worker/src/services/progress-reporter.ts`（新建）
- `packages/web/src/pages/TaskDetailPage.tsx`

---

#### 8. Worker 健康监控增强
**优先级**：中  
**预估工作量**：2-3 天  
**实现方案**：
```typescript
// 心跳携带资源使用信息
interface HeartbeatPayload {
  workerId: string;
  status: WorkerStatus;
  currentTaskId?: string;
  resourceUsage: {
    cpuPercent: number;
    memoryUsedMB: number;
    memoryTotalMB: number;
    diskUsedGB: number;
    diskTotalGB: number;
  };
}
```

**收益**：提前发现资源瓶颈

**涉及文件**：
- `packages/worker/src/services/heartbeat-service.ts`
- `packages/worker/src/services/resource-monitor.ts`（新建）
- `packages/web/src/pages/StatusPage.tsx`

---

#### 9. RUNNING 状态任务的取消能力
**优先级**：中  
**预估工作量**：3-4 天  
**实现方案**：
- Controller 提供取消任务 API
- Worker 监听取消信号，中断任务执行
- 支持优雅终止和强制终止

**收益**：用户可手动终止错误任务

**涉及文件**：
- `packages/controller/src/http/routes/tasks-routes.ts`
- `packages/worker/src/worker.ts`
- `packages/worker/src/executors/open-code-executor.ts`

---

### 低优先级任务（0/7 完成）

#### 10. 任务优先级机制
**优先级**：低  
**预估工作量**：1-2 天  
**实现方案**：
- TaskDraft 增加 `priority` 字段
- Controller 派发时按优先级排序
- 支持高优先级任务插队

**收益**：紧急任务优先执行

---

#### 11. 优化 Worker 轮询机制
**优先级**：低  
**预估工作量**：3-4 天  
**实现方案**：
- 使用 WebSocket 或 SSE 替代固定间隔轮询
- Controller 主动推送任务给 Worker
- 减少无效轮询，降低延迟

**收益**：任务响应更快，资源消耗更低

---

#### 12. 统一配置管理逻辑
**优先级**：低  
**预估工作量**：2-3 天  
**实现方案**：
- 明确配置优先级（环境变量 > manifest > 默认值）
- 统一配置加载逻辑
- 增加配置校验和合并逻辑

**收益**：配置管理更清晰

---

#### 13. 引入日志库并支持日志级别配置
**优先级**：低  
**预估工作量**：2-3 天  
**实现方案**：
- 引入 pino 或 winston
- 支持日志级别配置（DEBUG/INFO/WARN/ERROR）
- 支持日志格式化（JSON）

**收益**：生产环境日志管理更规范

---

#### 14. 补充核心服务单元测试
**优先级**：低  
**预估工作量**：5-7 天  
**实现方案**：
- ControllerFlowService 单元测试
- DispatchService 单元测试
- Worker 单元测试
- 目标覆盖率 70%+

**收益**：提升代码质量和可维护性

---

#### 15. 优化错误信息用户友好度
**优先级**：低  
**预估工作量**：2-3 天  
**实现方案**：
- 错误信息增加中文描述
- 提供具体的解决建议
- 增加错误码文档链接

**收益**：用户更容易理解和解决问题

---

#### 16. 关键操作增加二次确认
**优先级**：低  
**预估工作量**：1-2 天  
**实现方案**：
- 部署、修复等操作增加确认弹窗
- 显示操作影响范围
- 支持取消操作

**收益**：降低误操作风险

---

## 📊 实施建议

### 第一阶段（已完成）
- ✅ 完成 4 个高优先级任务
- ✅ 重点提升系统稳定性和核心功能

### 第二阶段（按需实施）
- 根据实际使用反馈选择中优先级任务
- 建议优先实施：任务列表分页、Worker 健康监控

### 第三阶段（长期规划）
- 根据用户需求选择低优先级任务
- 持续优化和完善

---

## 🎯 当前状态

**已完成**：4/16 任务（25%）  
**核心功能**：✅ 已完成  
**系统稳定性**：✅ 显著提升  
**用户体验**：⏳ 可继续优化  

**结论**：当前版本已达到 MVP 标准，核心功能完整，系统稳定可用。剩余任务属于增强型优化，可根据实际需求按需实施。
