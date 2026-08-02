"""
Worker 服务
"""

from typing import List
from clawkit.http import HttpClient
from clawkit.models.worker import Worker, WorkerStatus


class WorkerService:
    """Worker 服务类"""

    def __init__(self, http: HttpClient):
        self.http = http
        self.resource = "workers"

    def list(self) -> List[Worker]:
        """获取 Worker 列表"""
        data = self.http.get(f"/api/{self.resource}")
        workers = data.get("workers", []) if isinstance(data, dict) else data
        if isinstance(workers, list):
            return [Worker(**w) for w in workers]
        return []

    def get(self, worker_id: str) -> Worker:
        """获取 Worker 详情"""
        data = self.http.get(f"/api/{self.resource}/{worker_id}")
        return Worker(**data)

    def get_online(self) -> List[Worker]:
        """获取在线 Worker"""
        workers = self.list()
        return [w for w in workers if w.status == WorkerStatus.ONLINE]

    def get_available(self) -> List[Worker]:
        """获取可用 Worker（负载未满）"""
        workers = self.list()
        return [w for w in workers if w.status == WorkerStatus.ONLINE and w.current_load < w.max_load]

    def get_by_project(self, project_key: str) -> List[Worker]:
        """获取指定项目的 Worker"""
        workers = self.list()
        return [
            w
            for w in workers
            if w.status == WorkerStatus.ONLINE
            and (project_key in w.supported_projects or "*" in w.supported_projects)
        ]

    def get_stats(self) -> dict:
        """获取 Worker 状态统计"""
        workers = self.list()
        return {
            "total": len(workers),
            "online": len([w for w in workers if w.status == WorkerStatus.ONLINE]),
            "offline": len([w for w in workers if w.status == WorkerStatus.OFFLINE]),
            "busy": len([w for w in workers if w.status == WorkerStatus.BUSY]),
        }
