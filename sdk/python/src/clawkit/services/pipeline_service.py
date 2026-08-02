"""
流水线服务
"""

from typing import Optional, List
from clawkit.http import HttpClient
from clawkit.models.pipeline import (
    Pipeline,
    PipelineStage,
    CreatePipelineOptions,
    UpdatePipelineOptions,
    PipelineExecution,
    PipelineStats,
)


class PipelineService:
    """流水线服务类"""

    def __init__(self, http: HttpClient):
        self.http = http
        self.resource = "pipelines"

    def list(self) -> List[Pipeline]:
        """获取流水线列表"""
        data = self.http.get(f"/api/{self.resource}")
        if isinstance(data, list):
            return [Pipeline(**item) for item in data]
        return []

    def get(self, pipeline_id: str) -> Pipeline:
        """获取流水线详情"""
        data = self.http.get(f"/api/{self.resource}/{pipeline_id}")
        return Pipeline(**data)

    def create(self, options: CreatePipelineOptions) -> Pipeline:
        """创建流水线"""
        data = self.http.post(
            f"/api/{self.resource}",
            options.model_dump(exclude_none=True),
        )
        return Pipeline(**data)

    def update(self, pipeline_id: str, options: UpdatePipelineOptions) -> Pipeline:
        """更新流水线"""
        data = self.http.put(
            f"/api/{self.resource}/{pipeline_id}",
            options.model_dump(exclude_none=True),
        )
        return Pipeline(**data)

    def delete(self, pipeline_id: str) -> None:
        """删除流水线"""
        self.http.delete(f"/api/{self.resource}/{pipeline_id}")

    def validate(self, pipeline_id: str) -> dict:
        """验证流水线配置"""
        return self.http.post(f"/api/{self.resource}/{pipeline_id}/validate")

    def execute(self, pipeline_id: str, trigger_type: str = "manual") -> PipelineExecution:
        """执行流水线"""
        data = self.http.post(
            f"/api/{self.resource}/{pipeline_id}/execute",
            {"triggerType": trigger_type},
        )
        return PipelineExecution(**data)

    def get_execution_history(self, pipeline_id: str) -> List[PipelineExecution]:
        """获取执行历史"""
        data = self.http.get(f"/api/{self.resource}/{pipeline_id}/executions")
        if isinstance(data, list):
            return [PipelineExecution(**item) for item in data]
        return []

    def get_execution(self, execution_id: str) -> PipelineExecution:
        """获取执行详情"""
        data = self.http.get(f"/api/{self.resource}/executions/{execution_id}")
        return PipelineExecution(**data)

    def cancel_execution(self, execution_id: str) -> None:
        """取消执行"""
        self.http.post(f"/api/{self.resource}/executions/{execution_id}/cancel")

    def get_stats(self) -> PipelineStats:
        """获取统计信息"""
        data = self.http.get(f"/api/{self.resource}/stats")
        return PipelineStats(**data)

    def add_stage(self, pipeline_id: str, stage: PipelineStage) -> Pipeline:
        """添加阶段"""
        pipeline = self.get(pipeline_id)
        stages = [s.model_dump() for s in pipeline.stages]
        stages.append(stage.model_dump())
        return self.update(pipeline_id, UpdatePipelineOptions(stages=stages))

    def remove_stage(self, pipeline_id: str, stage_id: str) -> Pipeline:
        """移除阶段"""
        pipeline = self.get(pipeline_id)
        stages = [s for s in pipeline.stages if s.id != stage_id]
        return self.update(pipeline_id, UpdatePipelineOptions(stages=stages))
