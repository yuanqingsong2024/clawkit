"""
系统模型定义
"""

from typing import Optional, List, Dict
from pydantic import BaseModel


class HealthStatus(BaseModel):
    """健康检查响应"""
    success: bool
    code: str
    message: str
    data: Optional[dict] = None


class SystemMemory(BaseModel):
    """系统内存信息"""
    rss: float
    heap_total: float
    heap_used: float
    external: float


class SystemInfo(BaseModel):
    """系统信息"""
    version: str
    platform: str
    arch: str
    node_version: str
    uptime: float
    memory: SystemMemory


class MetricPoint(BaseModel):
    """指标数据点"""
    timestamp: str
    value: float
    labels: Optional[Dict[str, str]] = None


class MetricSeries(BaseModel):
    """指标序列"""
    name: str
    description: str
    unit: str
    type: str  # 'gauge' | 'counter' | 'histogram' | 'summary'
    points: List[MetricPoint]
