/**
 * 插件市场页面
 * 工作台风格：紧凑卡片布局
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { primaryButtonClassName, secondaryButtonClassName, inputClassName, compactButtonClassName } from '../components/ui/styles';
import { Loading } from '../components/ui/Loading';
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
      executor: { label: '执行器', className: 'bg-blue-50 text-blue-700 ring-blue-600/20', icon: '⚡' },
      trigger: { label: '触发器', className: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: '🎯' },
      notifier: { label: '通知器', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: '🔔' },
    };
    const config = typeMap[type] || typeMap.executor;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${config.className}`}>
        {config.icon} {config.label}
      </span>
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  };

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'executor', label: '执行器' },
    { key: 'trigger', label: '触发器' },
    { key: 'notifier', label: '通知器' },
  ];

  return (
    <div className="space-y-3">
      {/* 顶部标题 */}
      <PageHeader
        title="插件市场"
        description="发现和安装扩展 ClawKit 功能的插件"
        actions={[
          <button
            key="refresh"
            type="button"
            onClick={loadPlugins}
            className={secondaryButtonClassName}
          >
            刷新
          </button>,
        ]}
      />

      {/* 搜索和筛选 */}
      <Card compact title="搜索插件">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* 类型筛选 */}
          <div className="flex rounded-md border border-slate-200 bg-white">
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterType(tab.key)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  filterType === tab.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-50' + (index > 0 ? ' border-l border-slate-200' : ' rounded-l-md')
                } ${index === tabs.length - 1 ? ' rounded-r-md' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 插件列表 */}
      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Loading text="加载插件列表..." />
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="text-center py-8">
            <div className="mb-2 text-4xl">⚠️</div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">加载失败</h3>
            <p className="text-sm text-slate-600 mb-4">{error}</p>
            <button
              onClick={loadPlugins}
              className={primaryButtonClassName}
            >
              重试
            </button>
          </div>
        </Card>
      ) : plugins.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <div className="mb-2 text-4xl">🧩</div>
            <h3 className="text-base font-semibold text-slate-800 mb-2">没有找到插件</h3>
            <p className="text-sm text-slate-500">尝试调整搜索条件或筛选类型</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plugins.map((plugin, index) => (
            <motion.div
              key={plugin.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card compact className="h-full hover:shadow-md transition-all">
                {/* 头部 */}
                <div className="mb-2.5 flex items-start justify-between gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 shadow">
                    <span className="text-base">🧩</span>
                  </div>
                  <div className="flex-shrink-0">{getTypeBadge(plugin.type)}</div>
                </div>

                {/* 信息 */}
                <h3 className="text-sm font-semibold text-slate-900 mb-1 truncate">{plugin.name}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-2.5">{plugin.description}</p>

                {/* 标签 */}
                {plugin.tags && plugin.tags.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-1">
                    {plugin.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 元数据 - 响应式 */}
                <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    ⬇️ {formatNumber(plugin.downloads)}
                  </span>
                  <span className="flex items-center gap-1">
                    ⭐ {plugin.rating.toFixed(1)}
                  </span>
                  <span className="text-slate-300">|</span>
                  <span>v{plugin.version}</span>
                </div>

                {/* 作者 */}
                <div className="mb-2.5 rounded border border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
                  by {plugin.author}
                </div>

                {/* 安装按钮 */}
                <button
                  onClick={() => handleInstall(plugin.id)}
                  disabled={installing === plugin.id}
                  className={`${compactButtonClassName} w-full bg-blue-600 text-white hover:bg-blue-700`}
                >
                  {installing === plugin.id ? '安装中…' : '安装'}
                </button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
