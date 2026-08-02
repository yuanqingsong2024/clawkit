"""
流水线模型定义
"""

from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class PipelineStageType(str, Enum):
    """流水线阶段类型"""
    TASK = "task"
    CONDITION = "condition"
    PARALLEL = "parallel"
    SERIAL = "serial"


class PipelineStage(BaseModel):
    """流水线阶段"""
    id: str
    name: str
    type: PipelineStageType
    depends_on: Optional[List[str]] = None
    executor: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    condition: Optional[str] = None


class PipelineMeta(BaseModel):
    """流水线元信息"""
    id: str
    name: str
    description: Optional[str] = None
    version: int
    created_at: int
    updated_at: int


class Pipeline(BaseModel):
    """流水线"""
    meta: PipelineMeta
    stages: List[PipelineStage]


class PipelineExecutionStatus(str, Enum):
    """流水线执行状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StageExecutionResult(BaseModel):
    """阶段执行结果"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    duration: Optional[float] = None


class PipelineExecutionResult(BaseModel):
    """流水线执行结果"""
    success: bool
    output: Optional[str] = None
    error: Optional[str] = None
    stages: Optional[Dict[str, StageExecutionResult]] = None


class PipelineExecution(BaseModel):
    """流水线执行记录"""
    id: str
    pipeline_id: str
    trigger_type: str
    status: PipelineExecutionStatus
    stage_executions: Dict[str, str]
    result: Optional[PipelineExecutionResult] = None
    created_at: int
    started_at: Optional[int] = None
    completed_at: Optional[int] = None


class PipelineStats(BaseModel):
    """流水线统计信息"""
    total: int
    running: int
    completed: int
    failed: int


class CreatePipelineOptions(BaseModel):
    """创建流水线选项"""
    name: str
    description: Optional[str] = None
    stages: Optional[List[PipelineStage]] = None


class UpdatePipelineOptions(BaseModel):
    """更新流水线选项"""
    name: Optional[str] = None
    description: Optional[str] = None
    stages: Optional[List[PipelineStage]] = None
