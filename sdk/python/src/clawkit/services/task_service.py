"""
任务服务
"""

from typing import Optional, List
from clawkit.http import HttpClient
from clawkit.models.task import (
    Task,
    TaskStatus,
    TaskPriority,
    CreateTaskOptions,
    ListTasksOptions,
    ApproveTaskOptions,
    RejectTaskOptions,
    PaginatedResponse,
)


class TaskService:
    """任务服务类"""

    def __init__(self, http: HttpClient):
        self.http = http
        self.resource = "tasks"

    def create(self, options: CreateTaskOptions) -> Task:
        """创建任务"""
        data = self.http.post(f"/api/{self.resource}", options.model_dump(exclude_none=True))
        return Task(**data)

    def list(self, options: Optional[ListTasksOptions] = None) -> PaginatedResponse[Task]:
        """获取任务列表"""
        params = {}
        if options:
            params = options.model_dump(exclude_none=True)

        data = self.http.get(f"/api/{self.resource}", params)
        return PaginatedResponse[Task](
            items=[Task(**item) for item in data.get("items", [])],
            pagination=data.get("pagination", {}),
        )

    def get(self, task_id: str) -> Task:
        """获取任务详情"""
        data = self.http.get(f"/api/{self.resource}/{task_id}")
        return Task(**data)

    def get_status(self, task_id: str) -> TaskStatus:
        """获取任务状态"""
        data = self.http.get(f"/api/{self.resource}/{task_id}/status")
        return TaskStatus(data.get("status"))

    def approve(self, task_id: str, options: Optional[ApproveTaskOptions] = None) -> Task:
        """审批任务"""
        data = self.http.post(
            f"/api/{self.resource}/{task_id}/approve",
            options.model_dump(exclude_none=True) if options else None,
        )
        return Task(**data)

    def reject(self, task_id: str, options: RejectTaskOptions) -> Task:
        """拒绝任务"""
        data = self.http.post(
            f"/api/{self.resource}/{task_id}/reject",
            options.model_dump(exclude_none=True),
        )
        return Task(**data)

    def cancel(self, task_id: str) -> Task:
        """取消任务"""
        data = self.http.post(f"/api/{self.resource}/{task_id}/cancel")
        return Task(**data)

    def delete(self, task_id: str) -> None:
        """删除任务"""
        self.http.delete(f"/api/{self.resource}/{task_id}")

    def retry(self, task_id: str) -> Task:
        """重新执行任务"""
        data = self.http.post(f"/api/{self.resource}/{task_id}/retry")
        return Task(**data)

    def get_result(self, task_id: str) -> Optional[dict]:
        """获取任务结果"""
        task = self.get(task_id)
        if task.result:
            return task.result.model_dump()
        return None
