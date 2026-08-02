"""
ClawKit 模型定义
"""

from clawkit.models.task import (
    Task,
    TaskStatus,
    TaskPriority,
    TaskResult,
    CreateTaskOptions,
    ListTasksOptions,
)
from clawkit.models.pipeline import (
    Pipeline,
    PipelineMeta,
    PipelineStage,
    PipelineStageType,
    PipelineExecution,
    PipelineExecutionStatus,
    PipelineStats,
)
from clawkit.models.worker import (
    Worker,
    WorkerStatus,
)
from clawkit.models.system import (
    HealthStatus,
    SystemInfo,
    MetricSeries,
)
from clawkit.models.plugin import (
    Plugin,
    PluginType,
    PluginLifecycleState,
)
from clawkit.models.common import (
    ApiResponse,
    PaginationInfo,
    ClawKitError,
    ValidationError,
    AuthenticationError,
    NotFoundError,
)

__all__ = [
    # 任务
    "Task",
    "TaskStatus",
    "TaskPriority",
    "TaskResult",
    "CreateTaskOptions",
    "ListTasksOptions",
    # 流水线
    "Pipeline",
    "PipelineMeta",
    "PipelineStage",
    "PipelineStageType",
    "PipelineExecution",
    "PipelineExecutionStatus",
    "PipelineStats",
    # Worker
    "Worker",
    "WorkerStatus",
    # 系统
    "HealthStatus",
    "SystemInfo",
    "MetricSeries",
    # 插件
    "Plugin",
    "PluginType",
    "PluginLifecycleState",
    # 通用
    "ApiResponse",
    "PaginationInfo",
    "ClawKitError",
    "ValidationError",
    "AuthenticationError",
    "NotFoundError",
]
