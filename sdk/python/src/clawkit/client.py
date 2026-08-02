"""
ClawKit Python SDK 客户端

官方 Python SDK - 方便第三方应用接入 ClawKit

@example
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
"""

import os
from clawkit.http import HttpClient, from_env as http_from_env
from clawkit.services.task_service import TaskService
from clawkit.services.pipeline_service import PipelineService
from clawkit.services.worker_service import WorkerService
from clawkit.services.system_service import SystemService
from clawkit.services.plugin_service import PluginService


class ClawKit:
    """ClawKit 客户端"""

    def __init__(
        self,
        base_url: str,
        api_key: str = None,
        timeout: int = 30000,
        headers: dict = None,
    ):
        """
        初始化 ClawKit 客户端

        Args:
            base_url: Controller 服务地址
            api_key: API Key（可选）
            timeout: 超时时间（毫秒）
            headers: 自定义请求头
        """
        if not base_url:
            raise ValueError("base_url is required")

        self.http = HttpClient(
            base_url=base_url,
            api_key=api_key,
            timeout=timeout,
            headers=headers,
        )

        # 初始化各服务
        self.tasks = TaskService(self.http)
        self.pipelines = PipelineService(self.http)
        self.workers = WorkerService(self.http)
        self.system = SystemService(self.http)
        self.plugins = PluginService(self.http)

    def get_base_url(self) -> str:
        """获取基础 URL"""
        return self.http.base_url

    def close(self):
        """关闭客户端"""
        # requests 没有需要关闭的连接，但保留此方法以备将来扩展
        pass


def from_env() -> ClawKit:
    """
    从环境变量创建客户端

    自动读取以下环境变量：
    - CLAWKIT_BASE_URL 或 CLAWKIT_URL: Controller 服务地址
    - CLAWKIT_API_KEY: API Key（可选）

    @example
    ```python
    client = from_env()
    ```
    """
    base_url = os.getenv("CLAWKIT_BASE_URL") or os.getenv("CLAWKIT_URL")
    api_key = os.getenv("CLAWKIT_API_KEY")

    if not base_url:
        raise ValueError("CLAWKIT_BASE_URL or CLAWKIT_URL environment variable is required")

    return ClawKit(base_url=base_url, api_key=api_key)
