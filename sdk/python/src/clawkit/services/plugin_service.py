"""
插件服务
"""

from typing import Optional, List
from clawkit.http import HttpClient
from clawkit.models.plugin import Plugin, PluginType, PluginLifecycleState


class PluginService:
    """插件服务类"""

    def __init__(self, http: HttpClient):
        self.http = http
        self.resource = "plugins"

    def list(self, type: Optional[PluginType] = None, search: Optional[str] = None) -> List[Plugin]:
        """获取插件列表"""
        params = {}
        if type:
            params["type"] = type.value
        if search:
            params["search"] = search

        data = self.http.get(f"/api/{self.resource}", params)
        if isinstance(data, list):
            return [Plugin(**p) for p in data]
        return []

    def search(self, query: str) -> List[Plugin]:
        """搜索插件"""
        data = self.http.get(f"/api/{self.resource}/search", {"q": query})
        if isinstance(data, list):
            return [Plugin(**p) for p in data]
        return []

    def get(self, plugin_name: str) -> Plugin:
        """获取插件详情"""
        data = self.http.get(f"/api/{self.resource}/{plugin_name}")
        return Plugin(**data)

    def get_installed(self) -> List[Plugin]:
        """获取已安装插件"""
        data = self.http.get(f"/api/{self.resource}/installed")
        if isinstance(data, list):
            return [Plugin(**p) for p in data]
        return []

    def install(self, plugin_name: str, version: Optional[str] = None) -> None:
        """安装插件"""
        payload = {"name": plugin_name}
        if version:
            payload["version"] = version
        self.http.post(f"/api/{self.resource}/install", payload)

    def uninstall(self, plugin_name: str) -> None:
        """卸载插件"""
        self.http.post(f"/api/{self.resource}/uninstall", {"name": plugin_name})

    def rate(self, plugin_name: str, rating: int, comment: Optional[str] = None) -> None:
        """评分插件"""
        payload = {"name": plugin_name, "rating": rating}
        if comment:
            payload["comment"] = comment
        self.http.post(f"/api/{self.resource}/rate", payload)

    def get_executors(self) -> List[Plugin]:
        """获取执行器插件"""
        return self.list(type=PluginType.EXECUTOR)

    def get_triggers(self) -> List[Plugin]:
        """获取触发器插件"""
        return self.list(type=PluginType.TRIGGER)

    def get_notifiers(self) -> List[Plugin]:
        """获取通知器插件"""
        return self.list(type=PluginType.NOTIFIER)

    def get_active(self) -> List[Plugin]:
        """获取活跃插件"""
        plugins = self.get_installed()
        return [p for p in plugins if p.state == PluginLifecycleState.ACTIVE]
