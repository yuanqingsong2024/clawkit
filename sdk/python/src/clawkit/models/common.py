"""
通用模型定义
"""

from typing import TypeVar, Generic, Optional, Any
from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """API 响应包装器"""
    success: bool
    code: str
    message: str
    data: Optional[T] = None


class PaginationInfo(BaseModel):
    """分页信息"""
    page: int
    pageSize: int
    total: int
    totalPages: int


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应"""
    items: list[T]
    pagination: PaginationInfo


class ClawKitError(Exception):
    """SDK 错误基类"""
    code: str
    status_code: Optional[int] = None
    details: Optional[Any] = None

    def __init__(self, message: str, code: str = "unknown.error", status_code: Optional[int] = None, details: Optional[Any] = None):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


class ValidationError(ClawKitError):
    """验证错误"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "validation.error", 400, details)


class AuthenticationError(ClawKitError):
    """认证错误"""
    def __init__(self, message: str, details: Optional[Any] = None):
        super().__init__(message, "auth.error", 401, details)


class NotFoundError(ClawKitError):
    """资源未找到错误"""
    def __init__(self, resource: str, resource_id: str):
        super().__init__(f"{resource} not found: {resource_id}", "not.found", 404)
        self.resource = resource
        self.resource_id = resource_id
