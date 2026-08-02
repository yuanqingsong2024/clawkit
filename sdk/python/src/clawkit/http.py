"""
HTTP 客户端
"""

import os
from typing import Optional, Dict, Any, Union
import requests
from clawkit.models.common import ClawKitError, NotFoundError


class HttpClient:
    """HTTP 客户端类"""

    def __init__(
        self,
        base_url: str,
        api_key: Optional[str] = None,
        timeout: int = 30000,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout / 1000  # 转换为秒
        self.default_headers = {
            "Content-Type": "application/json",
            **(headers or {}),
        }

    def _get_headers(self) -> Dict[str, str]:
        """获取请求头"""
        headers = self.default_headers.copy()
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    def _handle_response(self, response: requests.Response) -> Any:
        """处理响应"""
        if response.status_code == 404:
            # 尝试从响应中获取资源信息
            try:
                data = response.json()
                message = data.get("message", "Resource not found")
            except Exception:
                message = "Resource not found"
            raise NotFoundError("Resource", message)

        if not response.ok:
            try:
                data = response.json()
                raise ClawKitError(
                    message=data.get("message", response.text),
                    code=data.get("code", "unknown.error"),
                    status_code=response.status_code,
                    details=data.get("data"),
                )
            except Exception:
                raise ClawKitError(
                    message=response.text or response.reason,
                    code="unknown.error",
                    status_code=response.status_code,
                )

        try:
            data = response.json()
            return data.get("data", data)
        except Exception:
            return response.text

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        """GET 请求"""
        url = f"{self.base_url}{path}"
        response = requests.get(
            url,
            params=params,
            headers=self._get_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def post(self, path: str, data: Optional[Dict[str, Any]] = None) -> Any:
        """POST 请求"""
        url = f"{self.base_url}{path}"
        response = requests.post(
            url,
            json=data,
            headers=self._get_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def put(self, path: str, data: Optional[Dict[str, Any]] = None) -> Any:
        """PUT 请求"""
        url = f"{self.base_url}{path}"
        response = requests.put(
            url,
            json=data,
            headers=self._get_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def delete(self, path: str, data: Optional[Dict[str, Any]] = None) -> Any:
        """DELETE 请求"""
        url = f"{self.base_url}{path}"
        response = requests.delete(
            url,
            json=data,
            headers=self._get_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def patch(self, path: str, data: Optional[Dict[str, Any]] = None) -> Any:
        """PATCH 请求"""
        url = f"{self.base_url}{path}"
        response = requests.patch(
            url,
            json=data,
            headers=self._get_headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)


def from_env() -> HttpClient:
    """从环境变量创建 HTTP 客户端"""
    base_url = os.getenv("CLAWKIT_BASE_URL") or os.getenv("CLAWKIT_URL")
    api_key = os.getenv("CLAWKIT_API_KEY")

    if not base_url:
        raise ValueError("CLAWKIT_BASE_URL or CLAWKIT_URL environment variable is required")

    return HttpClient(base_url=base_url, api_key=api_key)
