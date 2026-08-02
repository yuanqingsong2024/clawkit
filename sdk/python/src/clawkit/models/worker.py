"""
Worker 模型定义
"""

from enum import Enum
from typing import List
from pydantic import BaseModel


class WorkerStatus(str, Enum):
    """Worker 状态枚举"""
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"
    ERROR = "error"


class Worker(BaseModel):
    """Worker 对象"""
    id: str
    name: str
    status: WorkerStatus
    tags: List[str]
    supported_projects: List[str]
    current_load: float
    max_load: float
    last_heartbeat: str
    created_at: str
