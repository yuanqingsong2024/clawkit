# Cron 定时触发器插件

Cron 定时触发器插件，支持基于 Cron 表达式的定时任务触发。

## 功能特性

- ✅ **Cron 表达式**：支持标准 5 字段和扩展 6 字段格式
- ✅ **时区支持**：支持配置时区
- ✅ **任务管理**：支持创建、启动、停止、删除、更新任务
- ✅ **手动触发**：支持手动触发任务
- ✅ **批量操作**：支持同时启动/停止所有任务
- ✅ **下次执行时间**：自动计算并显示下次执行时间

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/cron-trigger plugins/trigger/
```

## 配置

在 `clawkit.yaml` 中配置插件：

```yaml
plugins:
  triggers:
    - name: cron-trigger
      enabled: true
      config:
        # 时区
        timezone: Asia/Shanghai
        
        # 是否自动启动
        autoStart: true
        
        # 任务列表
        jobs:
          - id: daily-build
            name: 每日构建
            cron: "0 0 9 * * *"  # 每天早上 9 点
            data:
              pipeline: ci-pipeline
              
          - id: weekly-report
            name: 周报生成
            cron: "0 0 10 * * 1"  # 每周一早上 10 点
            data:
              type: report
```

## Cron 表达式

### 标准格式（5 字段）

```
┌───────────── 分钟 (0-59)
│ ┌───────────── 小时 (0-23)
│ │ ┌───────────── 日 (1-31)
│ │ │ ┌───────────── 月 (1-12)
│ │ │ │ ┌───────────── 星期 (0-6, 0=周日)
│ │ │ │ │
* * * * *
```

### 扩展格式（6 字段）

```
┌───────────── 秒 (0-59)
│ ┌───────────── 分钟 (0-59)
│ │ ┌───────────── 小时 (0-23)
│ │ │ ┌───────────── 日 (1-31)
│ │ │ │ ┌───────────── 月 (1-12)
│ │ │ │ │ ┌───────────── 星期 (0-6, 0=周日)
│ │ │ │ │ │
* * * * * *
```

### 特殊字符

| 字符 | 说明 | 示例 |
|------|------|------|
| `*` | 任意值 | `* * * * *` 每天每分钟 |
| `,` | 列表分隔 | `0,30 * * * *` 每小时的 0 和 30 分 |
| `-` | 范围 | `0 9-17 * * *` 上午 9 点到下午 5 点每小时 |
| `/` | 步长 | `*/5 * * * *` 每 5 分钟 |
| `L` | 最后 | `0 0 L * *` 每月最后一天 |
| `W` | 工作日 | `0 0 15W * *` 每月第 15 个工作日 |
| `#` | 第几周 | `0 0 * * 5#3` 每月第三个周五 |

### 常用示例

| Cron | 说明 |
|------|------|
| `* * * * *` | 每分钟 |
| `0 * * * *` | 每小时整点 |
| `0 0 * * *` | 每天午夜 |
| `0 9 * * *` | 每天早上 9 点 |
| `0 9 * * 1-5` | 工作日上午 9 点 |
| `0 */2 * * *` | 每 2 小时 |
| `0 0 * * 0` | 每周日午夜 |
| `0 0 1 * *` | 每月第一天午夜 |
| `0 0 1,15 * *` | 每月 1 号和 15 号午夜 |
| `30 4 1,15 * *` | 每月 1 号和 15 号凌晨 4:30 |

## 使用示例

### 基本使用

```javascript
const CronTrigger = require('./cron-trigger');

// 初始化
CronTrigger.initialize({
  timezone: 'Asia/Shanghai',
  jobs: [
    {
      id: 'daily-build',
      name: '每日构建',
      cron: '0 0 9 * * *',
      data: { pipeline: 'ci' },
    },
  ],
});

// 注册事件处理器
CronTrigger.onTrigger((event) => {
  console.log('触发任务:', event.job.name);
  console.log('下次执行:', event.schedule.nextRun);
  
  // 执行流水线
  triggerPipeline(event.data.pipeline);
});
```

### 动态创建任务

```javascript
// 创建新任务
const job = CronTrigger.createJob({
  id: 'hourly-sync',
  name: '每小时同步',
  cron: '0 0 * * * *',
  data: { source: 'gitlab', target: 'github' },
});

console.log('下次执行:', job.nextRun);
```

### 手动触发

```javascript
// 手动触发任务
await CronTrigger.triggerJob('hourly-sync');
```

### 任务管理

```javascript
// 获取所有任务
const jobs = CronTrigger.getAllJobs();
console.log('当前任务数:', jobs.length);

// 获取任务状态
const status = CronTrigger.getJobStatus('daily-build');
console.log('是否运行:', status.isRunning);
console.log('运行次数:', status.runCount);
console.log('下次执行:', status.nextRun);

// 停止任务
CronTrigger.stopJob('daily-build');

// 启动任务
CronTrigger.startJob('daily-build');

// 删除任务
CronTrigger.removeJob('daily-build');

// 更新任务
CronTrigger.updateJob('daily-build', {
  cron: '0 30 9 * * *',  // 改为 9:30
  data: { pipeline: 'ci-v2' },
});
```

### Webhook 接口（兼容）

```javascript
// 虽然 Cron 触发器主要通过定时触发，但也可以通过 HTTP 请求触发
app.post('/api/triggers/cron', async (req, res) => {
  const result = await CronTrigger.handleWebhook(req.body, req.headers);
  res.json(result);
});
```

## 事件数据结构

```javascript
{
  eventId: 'cron-daily-build-1690992000000',
  eventType: 'scheduled',
  source: 'cron',
  triggerName: '每日构建',
  timestamp: '2026-08-03T01:00:00.000Z',
  job: {
    id: 'daily-build',
    name: '每日构建',
    cron: '0 0 9 * * *',
    runCount: 42,
    lastRun: '2026-08-02T01:00:00.000Z'
  },
  data: {
    pipeline: 'ci'
  },
  schedule: {
    nextRun: '2026-08-04T01:00:00.000Z',
    timezone: 'Asia/Shanghai'
  }
}
```

## API 参考

### initialize(config, context)

初始化插件，可选自动启动所有任务。

### createJob(jobConfig)

创建新任务。

### removeJob(jobId)

删除任务。

### startJob(jobId)

启动任务。

### stopJob(jobId)

停止任务。

### startAll()

启动所有任务。

### stopAll()

停止所有任务。

### getAllJobs()

获取所有任务列表。

### getJobStatus(jobId)

获取任务状态。

### triggerJob(jobId)

手动触发任务。

### updateJob(jobId, updates)

更新任务配置。

### onTrigger(handler)

注册事件处理器，返回取消订阅函数。

### getNextExecution(cron)

获取 Cron 表达式的下次执行时间。

### healthCheck()

健康检查。

### validatePluginConfig(config)

验证插件配置。

## 常见问题

### Q1: 任务没有执行？

1. 检查 `autoStart` 是否为 `true`
2. 检查任务是否已启用 (`enabled: true`)
3. 检查 Cron 表达式是否正确
4. 查看日志是否有错误信息

### Q2: 时区不正确？

```javascript
// 确保使用正确的时区
CronTrigger.initialize({
  timezone: 'Asia/Shanghai',  // 中国时区
  // 或 'America/New_York' 等
});
```

### Q3: 如何实现一次性任务？

```javascript
// 在处理器中删除任务
CronTrigger.onTrigger(async (event) => {
  if (event.data.type === 'once') {
    await doSomething();
    CronTrigger.removeJob(event.job.id);
  }
});
```

## 相关链接

- [Cron 表达式参考](https://crontab.guru/)
- [cron-parser 文档](https://github.com/node-cron/cron-parser)
- [时区列表](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
