/**
 * 已安装插件管理页面
 * 管理本地已安装的插件
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loading, Tabs } from '../components/ui';
import { getInstalledPlugins, uninstallPlugin, togglePlugin, type InstalledPlugin } from '../lib/api';

export function PluginListPage(): JSX.Element {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getInstalledPlugins();
      setPlugins(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载插件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      setActionLoading(id);
      await togglePlugin(id, !enabled);
      await loadPlugins();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstall = async (id: string, name: string) => {
    if (!confirm(`确定要卸载插件 "${name}" 吗？`)) return;
    try {
      setActionLoading(id);
      await uninstallPlugin(id);
      await loadPlugins();
    } catch (err) {
      alert(err instanceof Error ? err.message : '卸载失败');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPlugins = filterType === 'all' 
    ? plugins 
    : plugins.filter(p => p.type === filterType);

  const getTypeBadge = (type: InstalledPlugin['type']) => {
    const typeMap = {
      executor: { label: '执行器', className: 'bg-blue-100 text-blue-700', icon: '⚡' },
      trigger: { label: '触发器', className: 'bg-amber-100 text-amber-700', icon: '🎯' },
      notifier: { label: '通知器', className: 'bg-green-100 text-green-700', icon: '🔔' },
    };
    const config = typeMap[type] || typeMap.executor;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const tabs = [
    { key: 'all', label: '全部', icon: '🧩' },
    { key: 'executor', label: '执行器', icon: '⚡' },
    { key: 'trigger', label: '触发器', icon: '🎯' },
    { key: 'notifier', label: '通知器', icon: '🔔' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">插件管理</h1>
        <p className="mt-1 text-sm text-slate-500">管理已安装的插件，启用或禁用它们</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{plugins.length}</div>
          <div className="mt-1 text-sm text-slate-500">全部插件</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{plugins.filter(p => p.enabled).length}</div>
          <div className="mt-1 text-sm text-slate-500">已启用</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-slate-400">{plugins.filter(p => !p.enabled).length}</div>
          <div className="mt-1 text-sm text-slate-500">已禁用</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{new Set(plugins.map(p => p.type)).size}</div>
          <div className="mt-1 text-sm text-slate-500">类型数</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs tabs={tabs} activeKey={filterType} onChange={setFilterType} variant="pill" className="mb-6" />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loading text="加载插件列表..." />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 py-16">
          <div className="mb-4 text-5xl">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-700">{error}</h3>
          <button
            onClick={loadPlugins}
            className="mt-4 rounded-xl bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            重试
          </button>
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16">
          <div className="mb-4 text-6xl">🧩</div>
          <h3 className="text-lg font-semibold text-slate-700">
            {filterType === 'all' ? '暂无已安装插件' : `暂无 ${filterType} 类型插件`}
          </h3>
          <p className="mt-2 text-sm text-slate-500">前往插件市场安装更多插件</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlugins.map((plugin, index) => (
            <motion.div
              key={plugin.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`rounded-2xl border p-5 transition-all ${
                plugin.enabled 
                  ? 'border-slate-200 bg-white hover:border-blue-200 hover:shadow-md' 
                  : 'border-slate-200 bg-slate-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                {/* Icon */}
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl shadow-lg ${
                  plugin.enabled ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                }`}>
                  <span className="text-2xl">{plugin.type === 'executor' ? '⚡' : plugin.type === 'trigger' ? '🎯' : '🔔'}</span>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{plugin.name}</h3>
                    {getTypeBadge(plugin.type)}
                    {!plugin.enabled && (
                      <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        已禁用
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{plugin.description}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                    <span>v{plugin.version}</span>
                    <span>by {plugin.author}</span>
                    <span>安装于 {formatDate(plugin.installedAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  {/* Toggle Switch */}
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={plugin.enabled}
                      onChange={() => handleToggle(plugin.id, plugin.enabled)}
                      disabled={actionLoading === plugin.id}
                      className="peer sr-only"
                    />
                    <div className="peer h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-indigo-600">
                      <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        plugin.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </label>

                  {/* Settings Button */}
                  <button
                    className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                    title="配置"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  {/* Uninstall Button */}
                  <button
                    onClick={() => handleUninstall(plugin.id, plugin.name)}
                    disabled={actionLoading === plugin.id}
                    className="rounded-lg border border-red-200 p-2 text-red-400 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    title="卸载"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
