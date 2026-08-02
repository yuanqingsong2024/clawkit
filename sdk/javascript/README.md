# @clawkit/sdk

ClawKit 官方 Node.js SDK - 方便第三方应用接入 ClawKit

## 安装

```bash
npm install @clawkit/sdk
# 或
yarn add @clawkit/sdk
# 或
pnpm add @clawkit/sdk
```

## 快速开始

```typescript
import { ClawKit } from '@clawkit/sdk';

// 创建客户端
const client = new ClawKit({
  baseUrl: 'http://localhost:8787',
  apiKey: 'your-api-key' // 可选
});

// 创建任务
const task = await client.tasks.create({
  text: '优化数据库查询性能'
});

// 审批任务
await client.tasks.approve(task.id);

// 执行流水线
const execution = await client.pipelines.execute('pipeline-id');
```

## 功能特性

- ✅ **任务管理** - 创建、查询、审批、取消任务
- ✅ **流水线编排** - 创建和管理 DAG 流水线
- ✅ **Worker 管理** - 查看和管理 Worker 节点
- ✅ **系统监控** - 健康检查、指标查询
- ✅ **插件市场** - 浏览和安装插件
- ✅ **TypeScript 支持** - 完整的类型定义

## API 参考

### 客户端初始化

```typescript
const client = new ClawKit({
  baseUrl: 'http://localhost:8787',  // Controller 地址
  apiKey: 'your-api-key',            // API Key（可选）
  timeout: 30000,                   // 超时时间（毫秒）
  retry: 3,                         // 重试次数
  headers: {                        // 自定义请求头
    'X-Custom-Header': 'value'
  }
});

// 或从环境变量创建
const client = ClawKit.fromEnv(); 
// 自动读取 CLAWKIT_BASE_URL 和 CLAWKIT_API_KEY
```

### 任务服务 (client.tasks)

```typescript
// 创建任务
const task = await client.tasks.create({
  text: '优化数据库查询',
  projectKey: 'my-project',
  priority: 'high'
});

// 获取任务列表
const { items, pagination } = await client.tasks.list({
  status: 'running',
  page: 1,
  pageSize: 20
});

// 获取任务详情
const task = await client.tasks.get('task-id');

// 审批任务
await client.tasks.approve('task-id', { comment: '同意执行' });

// 拒绝任务
await client.tasks.reject('task-id', { reason: '需要修改需求' });

// 取消任务
await client.tasks.cancel('task-id');

// 删除任务
await client.tasks.delete('task-id');
```

### 流水线服务 (client.pipelines)

```typescript
// 创建流水线
const pipeline = await client.pipelines.create({
  name: 'CI Pipeline',
  description: '持续集成流水线',
  stages: [
    {
      id: 'build',
      name: '构建',
      type: 'task',
      executor: 'opencode',
      config: { prompt: '运行构建命令' }
    },
    {
      id: 'test',
      name: '测试',
      type: 'task',
      dependsOn: ['build'],
      executor: 'opencode',
      config: { prompt: '运行测试' }
    }
  ]
});

// 获取流水线列表
const pipelines = await client.pipelines.list();

// 执行流水线
const execution = await client.pipelines.execute('pipeline-id');

// 获取执行历史
const history = await client.pipelines.getExecutionHistory('pipeline-id');

// 取消执行
await client.pipelines.cancelExecution('execution-id');
```

### Worker 服务 (client.workers)

```typescript
// 获取 Worker 列表
const workers = await client.workers.list();

// 获取在线 Worker
const onlineWorkers = await client.workers.getOnline();

// 获取可用 Worker（负载未满）
const availableWorkers = await client.workers.getAvailable();

// 获取指定项目的 Worker
const projectWorkers = await client.workers.getByProject('my-project');
```

### 系统服务 (client.system)

```typescript
// 健康检查
const health = await client.system.health();

// 获取系统信息
const info = await client.system.info();

// 获取指标数据
const metrics = await client.system.metrics({
  name: 'tasks',
  start: new Date('2026-01-01'),
  end: new Date()
});
```

### 插件服务 (client.plugins)

```typescript
// 获取插件列表
const plugins = await client.plugins.list();

// 搜索插件
const results = await client.plugins.search('opencode');

// 获取已安装插件
const installed = await client.plugins.getInstalled();

// 安装插件
await client.plugins.install('dingtalk-notifier');

// 卸载插件
await client.plugins.uninstall('dingtalk-notifier');

// 评分插件
await client.plugins.rate('opencode', 5, '很好用！');
```

## 类型定义

SDK 提供完整的 TypeScript 类型定义：

```typescript
import { 
  Task, 
  TaskStatus, 
  TaskPriority,
  Pipeline,
  PipelineStage,
  Worker,
  ClawKitError 
} from '@clawkit/sdk';
```

## 错误处理

```typescript
import { ClawKit, ClawKitError, NotFoundError } from '@clawkit/sdk';

try {
  const task = await client.tasks.get('non-existent-id');
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('任务不存在');
  } else if (error instanceof ClawKitError) {
    console.log(`API 错误: ${error.code} - ${error.message}`);
  } else {
    console.log('未知错误');
  }
}
```

## 环境变量

| 变量名 | 说明 | 必填 |
|-------|------|-----|
| CLAWKIT_BASE_URL | Controller 服务地址 | 是 |
| CLAWKIT_URL | Controller 服务地址（别名） | 是 |
| CLAWKIT_API_KEY | API Key | 否 |

## License

MIT
