# Worker 工作节点

Worker 是 clawkit 的任务执行节点，负责从 controller 拉取任务并执行。

## 当前阶段

**阶段目标**：建立 controller 与 worker 之间的最小可用派发链路，并接入真实 OpenCode 执行主路径。

**当前实现**：
- ✅ Worker 注册与心跳
- ✅ 任务拉取（poll 模式）
- ✅ OpenCodeExecutor 真实执行主路径
- ✅ 占位执行器（作为回退路径）
- ✅ 结果回传

**当前限制**：
- ❌ 严格真实执行仍依赖本机先启动 `opencode serve`
- ❌ 若开启回退开关，链路验证可能落到占位执行，不能替代真实执行验收
- ❌ 当前仍以单 worker、串行执行为主

## 架构

```
Worker
├── config.ts                    # 配置加载
├── worker.ts                    # Worker 主类
├── services/
│   ├── registration-service.ts  # 注册服务
│   ├── heartbeat-service.ts     # 心跳服务
│   ├── task-pull-service.ts     # 任务拉取服务
│   └── result-submit-service.ts # 结果提交服务
└── executors/
    └── placeholder-executor.ts  # 占位执行器
```

## 配置

Worker 通过环境变量配置：

```bash
# Worker 标识
WORKER_ID=worker-1
WORKER_NAME="Worker 1"
WORKER_NODE_NAME=local

# 连接模式
WORKER_CONNECT_MODE=pull

# Worker 标签（逗号分隔）
WORKER_TAGS=dev,test

# 支持的项目（逗号分隔，* 表示所有项目）
WORKER_SUPPORTED_PROJECTS=*

# Controller 地址
CONTROLLER_URL=http://127.0.0.1:8787

# 心跳间隔（毫秒）
WORKER_HEARTBEAT_INTERVAL_MS=10000

# 任务拉取间隔（毫秒）
WORKER_POLL_INTERVAL_MS=5000
```

## 使用方式

### 编程方式

```typescript
import { Worker } from '@clawkit/worker';

const worker = new Worker();

await worker.start();

// 停止 worker
await worker.stop();
```

### 命令行方式

```bash
# 启动 worker
node dist/index.js
```

## 工作流程

1. **启动阶段**
   - 加载配置
   - 向 controller 注册
   - 启动心跳服务
   - 启动任务轮询

2. **运行阶段**
   - 定期发送心跳（默认 10 秒）
   - 定期拉取任务（默认 5 秒）
   - 优先执行真实 OpenCode 主路径
   - 必要时按配置回退到占位执行
   - 回传结果

3. **停止阶段**
   - 停止任务轮询
   - 停止心跳服务

## 占位执行器

当 OpenCode 不可达且显式开启回退开关时，会使用 `PlaceholderExecutor` 模拟任务执行：

**输入**：
- taskId
- projectKey
- intent
- constraints
- acceptanceCriteria
- sourceText

**输出**：
- status: 'done' | 'failed'
- summary: 执行摘要
- placeholderExecution: true（标记为占位执行）
- logs: 执行日志
- risks: 风险提示
- nextStageHint: 下一阶段提示

**特点**：
- 模拟 2 秒执行时间
- 不修改任何代码
- 不执行真实操作
- 仅用于验证派发链路或回退兜底

## OpenCodeExecutor

当前仓库已经提供 `OpenCodeExecutor` 作为主执行路径；当 OpenCode 不可达且开启回退开关时，才会退回到 `PlaceholderExecutor`：

```typescript
export class OpenCodeExecutor implements TaskExecutor {
  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    // 调用真实 OpenCode
    // 执行真实代码修改
    // 运行真实测试
    // 执行真实 Git 操作
  }
}
```

## 错误处理

Worker 会捕获并处理以下错误：

1. **注册失败**：抛出异常，停止启动
2. **心跳失败**：记录日志，继续运行
3. **任务拉取失败**：记录日志，继续轮询
4. **任务执行失败**：回传失败结果，标记为 failed
5. **结果提交失败**：记录日志，任务状态可能不一致

## 状态管理

Worker 维护以下状态：

- `IDLE`：空闲，可接受新任务
- `BUSY`：忙碌，正在执行任务
- `OFFLINE`：离线（由 controller 判定，心跳超时）

## 日志

Worker 输出以下日志：

```
Worker worker-1 启动中...
Worker 注册成功: worker-1 (Worker 1)
心跳服务已启动，间隔 10000ms
Worker worker-1 已启动，开始轮询任务
拉取到任务: task-123
[占位执行器] 开始执行任务 task-123
[占位执行器] 任务 task-123 执行完成
任务 task-123 结果提交成功
任务 task-123 执行完成
```

## 限制与约束

当前阶段限制：

1. **单任务执行**：一次只能执行一个任务
2. **仅 poll 模式**：不支持 push 模式
3. **无持久化**：重启后状态丢失
4. **无任务队列**：不支持任务排队
5. **无并发控制**：不支持多任务并发

这些限制将在后续阶段逐步解除。
