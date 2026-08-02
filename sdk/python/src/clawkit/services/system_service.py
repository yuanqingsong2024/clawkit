"""
系统服务
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from clawkit.http import HttpClient
from clawkit.models.system import HealthStatus, SystemInfo, MetricSeries


class SystemService:
    """系统服务类"""

    def __init__(self, http: HttpClient):
        self.http = http

    def health(self) -> HealthStatus:
        """健康检查"""
        data = self.http.get("/api/health")
        return HealthStatus(**data)

    def info(self) -> SystemInfo:
        """获取系统信息"""
        data = self.http.get("/api/system/info")
        return SystemInfo(**data)

    def metrics(
        self,
        name: Optional[str] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> List[MetricSeries]:
        """获取指标数据"""
        params: Dict[str, Any] = {}
        if name:
            params["name"] = name
        if start:
            params["start"] = start.isoformat()
        if end:
            params["end"] = end.isoformat()

        data = self.http.get("/api/metrics", params)
        metrics = data.get("metrics", []) if isinstance(data, dict) else data
        if isinstance(metrics, list):
            return [MetricSeries(**m) for m in metrics]
        return []

    def task_metrics(self) -> List[MetricSeries]:
        """获取任务指标"""
        return self.metrics(name="tasks")

    def worker_metrics(self) -> List[MetricSeries]:
        """获取 Worker 指标"""
        return self.metrics(name="workers")

    def system_metrics(self) -> List[MetricSeries]:
        """获取系统资源指标"""
        return self.metrics(name="system")

    def is_ready(self) -> bool:
        """检查服务是否就绪"""
        try:
            health = self.health()
            return health.success is True
        except Exception:
            return False

    def get_version(self) -> str:
        """获取服务版本"""
        info = self.info()
        return info.version

    def get_openapi_spec(self) -> dict:
        """获取 OpenAPI 规范文档"""
        return self.http.get("/openapi.json")
