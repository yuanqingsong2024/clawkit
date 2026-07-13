/**
 * 插件市场页面
 * 浏览和安装插件
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loading, Tabs } from '../components/ui';
import { searchPlugins, getTrendingPlugins, installPlugin, type PluginEntry } from '../lib/api';

export function PluginMarketPage(): JSX.Element {
  const [plugins, setPlugins] = useState<PluginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
  }, [searchKeyword, filterType]);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (searchKeyword || filterType !== 'all') {
        const data = await searchPlugins({
          keyword: searchKeyword || undefined,
          type: filterType !== 'all' ? filterType : undefined,
        });
        setPlugins(data.items);
      } else {
        const data = await getTrendingPlugins(20);
        setPlugins(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载插件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (id: string) => {
    try {
      setInstalling(id);
      await installPlugin(id);
      alert('插件安装成功！');
      await loadPlugins();
    } catch (err) {
      alert(err instanceof Error ? err.message : '安装失败');
    } finally {
      setInstalling(null);
    }
  };

  const getTypeBadge = (type: PluginEntry['type']) => {
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

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
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
        <h1 className="text-2xl font-bold text-slate-900">插件市场</h1>
        <p className="mt-1 text-sm text-slate-500">发现和安装扩展 ClawKit 功能的插件</p>
      </div>

      {/* Search & Filter */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索插件..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Type Filter Tabs */}
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
      ) : plugins.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16">
          <div className="mb-4 text-6xl">🧩</div>
          <h3 className="text-lg font-semibold text-slate-700">没有找到插件</h3>
          <p className="mt-2 text-sm text-slate-500">尝试调整搜索条件或筛选类型</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plugins.map((plugin, index) => (
            <motion.div
              key={plugin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
                  <span className="text-xl">🧩</span>
                </div>
                {getTypeBadge(plugin.type)}
              </div>

              {/* Info */}
              <h3 className="text-lg font-semibold text-slate-900">{plugin.name}</h3>
              <p className="mt-2 line-clamp-2 text-sm text-slate-500">{plugin.description}</p>

              {/* Tags */}
              {plugin.tags && plugin.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plugin.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta */}
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {formatNumber(plugin.downloads)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  {plugin.rating.toFixed(1)}
                </span>
                <span>v{plugin.version}</span>
              </div>

              {/* Author */}
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                by {plugin.author}
              </div>

              {/* Install Button */}
              <button
                onClick={() => handleInstall(plugin.id)}
                disabled={installing === plugin.id}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
              >
                {installing === plugin.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    安装中...
                  </span>
                ) : (
                  '安装插件'
                )}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
