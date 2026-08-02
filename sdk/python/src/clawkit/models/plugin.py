"""
插件模型定义
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class PluginType(str, Enum):
    """插件类型"""
    EXECUTOR = "executor"
    TRIGGER = "trigger"
    NOTIFIER = "notifier"


class PluginLifecycleState(str, Enum):
    """插件状态"""
    LOADING = "loading"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class Plugin(BaseModel):
    """插件对象"""
    name: str
    version: str
    type: PluginType
    description: Optional[str] = None
    author: Optional[str] = None
    state: PluginLifecycleState
    config: Optional[Dict[str, Any]] = None
    capabilities: Optional[List[str]] = None
