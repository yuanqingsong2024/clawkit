"""
任务模型定义
"""

from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """任务状态枚举"""
    DRAFT = "draft"
    PROMPT_GENERATED = "prompt_generated"
    WAITING_APPROVAL = "waiting_approval"
    APPROVED = "approved"
    DISPATCHED = "dispatched"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    """任务优先级枚举"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class TaskResult(BaseModel):
    """任务结果"""
    output: str
    files_changed: Optional[List[str]] = None
    summary: Optional[str] = None
    error: Optional[str] = None


class Task(BaseModel):
    """任务对象"""
    id: str
    project_key: str
    text: str
    prompt: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    result: Optional[TaskResult] = None
    created_at: str
    updated_at: str


class CreateTaskOptions(BaseModel):
    """创建任务选项"""
    text: str
    project_key: Optional[str] = None
    priority: Optional[TaskPriority] = None
    prompt: Optional[str] = None


class ListTasksOptions(BaseModel):
    """任务列表查询选项"""
    page: Optional[int] = Field(default=1, ge=1)
    page_size: Optional[int] = Field(default=20, ge=1, le=100)
    status: Optional[TaskStatus] = None
    project_key: Optional[str] = None
    priority: Optional[TaskPriority] = None


class ApproveTaskOptions(BaseModel):
    """审批任务选项"""
    comment: Optional[str] = None


class RejectTaskOptions(BaseModel):
    """拒绝任务选项"""
    reason: str
