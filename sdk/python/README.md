# ClawKit Python SDK

官方 Python SDK - 方便第三方应用接入 ClawKit

## 安装

```bash
pip install clawkit
# 或
poetry add clawkit
```

## 快速开始

```python
from clawkit import ClawKit

# 创建客户端
client = ClawKit(
    base_url="http://localhost:8787",
    api_key="your-api-key"  # 可选
)

# 创建任务
task = client.tasks.create({
    "text": "优化数据库查询性能"
})

# 审批任务
client.tasks.approve(task.id)

# 执行流水线
execution = client.pipelines.execute("pipeline-id")
```

## 功能特性

- ✅ **任务管理** - 创建、查询、审批、取消任务
- ✅ **流水线编排** - 创建和管理 DAG 流水线
- ✅ **Worker 管理** - 查看和管理 Worker 节点
- ✅ **系统监控** - 健康检查、指标查询
- ✅ **插件市场** - 浏览和安装插件
- ✅ **类型安全** - Pydantic 模型支持

## API 参考

### 客户端初始化

```python
from clawkit import ClawKit, from_env

# 方式一：直接初始化
client = ClawKit(
    base_url="http://localhost:8787",  # Controller 地址
    api_key="your-api-key",           # API Key（可选）
    timeout=30000,                    # 超时时间（毫秒）
)

# 方式二：从环境变量创建
client = from_env()
# 自动读取 CLAWKIT_BASE_URL 和 CLAWKIT_API_KEY
```

### 任务服务 (client.tasks)

```python
from clawkit.models import TaskPriority

# 创建任务
task = client.tasks.create({
    "text": "优化数据库查询",
    "project_key": "my-project",
    "priority": "high"
})

# 获取任务列表
result = client.tasks.list({
    "status": "running",
    "page": 1,
    "page_size": 20
})
for task in result.items:
    print(task.id, task.text)

# 获取任务详情
task = client.tasks.get("task-id")

# 审批任务
client.tasks.approve("task-id", {"comment": "同意执行"})

# 拒绝任务
client.tasks.reject("task-id", {"reason": "需要修改需求"})

# 取消任务
client.tasks.cancel("task-id")

# 删除任务
client.tasks.delete("task-id")
```

### 流水线服务 (client.pipelines)

```python
# 创建流水线
pipeline = client.pipelines.create({
    "name": "CI Pipeline",
    "description": "持续集成流水线",
    "stages": [
        {
            "id": "build",
            "name": "构建",
            "type": "task",
            "executor": "opencode",
            "config": {"prompt": "运行构建命令"}
        },
        {
            "id": "test",
            "name": "测试",
            "type": "task",
            "depends_on": ["build"],
            "executor": "opencode",
            "config": {"prompt": "运行测试"}
        }
    ]
})

# 获取流水线列表
pipelines = client.pipelines.list()

# 执行流水线
execution = client.pipelines.execute("pipeline-id")

# 获取执行历史
history = client.pipelines.get_execution_history("pipeline-id")

# 取消执行
client.pipelines.cancel_execution("execution-id")
```

### Worker 服务 (client.workers)

```python
# 获取 Worker 列表
workers = client.workers.list()

# 获取在线 Worker
online_workers = client.workers.get_online()

# 获取可用 Worker（负载未满）
available_workers = client.workers.get_available()

# 获取指定项目的 Worker
project_workers = client.workers.get_by_project("my-project")
```

### 系统服务 (client.system)

```python
from datetime import datetime

# 健康检查
health = client.system.health()

# 获取系统信息
info = client.system.info()

# 获取指标数据
metrics = client.system.metrics(
    name="tasks",
    start=datetime(2026, 1, 1),
    end=datetime.now()
)
```

### 插件服务 (client.plugins)

```python
from clawkit.models import PluginType

# 获取插件列表
plugins = client.plugins.list()

# 搜索插件
results = client.plugins.search("opencode")

# 获取已安装插件
installed = client.plugins.get_installed()

# 安装插件
client.plugins.install("dingtalk-notifier")

# 卸载插件
client.plugins.uninstall("dingtalk-notifier")

# 评分插件
client.plugins.rate("opencode", 5, "很好用！")
```

## 类型模型

SDK 使用 Pydantic 模型提供类型安全：

```python
from clawkit.models import (
    Task,
    TaskStatus,
    TaskPriority,
    Pipeline,
    PipelineStage,
    Worker,
    WorkerStatus,
    ClawKitError,
    NotFoundError,
)
```

## 错误处理

```python
from clawkit import ClawKit
from clawkit.models import ClawKitError, NotFoundError

try:
    task = client.tasks.get("non-existent-id")
except NotFoundError as e:
    print(f"任务不存在: {e.resource_id}")
except ClawKitError as e:
    print(f"API 错误: {e.code} - {e.message}")
except Exception as e:
    print(f"未知错误: {e}")
```

## 环境变量

| 变量名 | 说明 | 必填 |
|-------|------|-----|
| CLAWKIT_BASE_URL | Controller 服务地址 | 是 |
| CLAWKIT_URL | Controller 服务地址（别名） | 是 |
| CLAWKIT_API_KEY | API Key | 否 |

## License

MIT
