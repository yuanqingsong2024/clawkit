/**
 * 流水线列表页面
 * 展示所有流水线及其状态
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loading, SkeletonCard, Badge } from '../components/ui';
import { getPipelines, executePipeline, deletePipeline, type PipelineDefinition } from '../lib/api';

export function PipelineListPage(): JSX.Element {
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPipelines();
  }, []);

  const loadPipelines = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPipelines();
      setPipelines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载流水线失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (id: string) => {
    try {
      setExecuting(id);
      await executePipeline(id);
      await loadPipelines();
    } catch (err) {
      alert(err instanceof Error ? err.message : '执行失败');
    } finally {
      setExecuting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个流水线吗？')) return;
    try {
      await deletePipeline(id);
      await loadPipelines();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const getStatusBadge = (status: PipelineDefinition['status']) => {
    const statusMap = {
      draft: { label: '草稿', className: 'bg-slate-100 text-slate-600' },
      active: { label: '运行中', className: 'bg-green-100 text-green-700' },
      paused: { label: '已暂停', className: 'bg-amber-100 text-amber-700' },
      archived: { label: '已归档', className: 'bg-slate-100 text-slate-400' },
    };
    const config = statusMap[status] || statusMap.draft;
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">流水线</h1>
            <p className="mt-1 text-sm text-slate-500">管理和执行 AI 工作流流水线</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-2xl bg-red-50 p-6 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h3 className="text-lg font-semibold text-red-700">加载失败</h3>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <button onClick={loadPipelines} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">流水线</h1>
          <p className="mt-1 text-sm text-slate-500">管理和执行 AI 工作流流水线</p>
        </div>
        <Link
          to="/pipelines/create"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建流水线
        </Link>
      </div>

      {/* Empty State */}
      {pipelines.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16"
        >
          <div className="mb-4 text-6xl">🔄</div>
          <h3 className="text-lg font-semibold text-slate-700">暂无流水线</h3>
          <p className="mt-2 text-sm text-slate-500">创建你的第一个流水线，开始自动化工作流</p>
          <Link
            to="/pipelines/create"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建流水线
          </Link>
        </motion.div>
      ) : (
        /* Pipeline Grid */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline, index) => (
            <motion.div
              key={pipeline.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10"
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg">
                  <span className="text-xl text-white">🔄</span>
                </div>
                {getStatusBadge(pipeline.status)}
              </div>

              {/* Info */}
              <h3 className="text-lg font-semibold text-slate-900">{pipeline.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{pipeline.description || '暂无描述'}</p>

              {/* Meta */}
              <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {pipeline.nodes?.length || 0} 个节点
                </span>
                <span>v{pipeline.version}</span>
              </div>

              {/* Time */}
              <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                更新于 {formatDate(pipeline.updatedAt)}
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2">
                <Link
                  to={`/pipelines/${pipeline.id}`}
                  className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2 text-center text-sm font-medium text-white transition-all hover:from-blue-700 hover:to-indigo-700"
                >
                  查看详情
                </Link>
                <button
                  onClick={() => handleExecute(pipeline.id)}
                  disabled={executing === pipeline.id}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-green-700 disabled:opacity-50"
                >
                  {executing === pipeline.id ? '执行中...' : '执行'}
                </button>
                <button
                  onClick={() => handleDelete(pipeline.id)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-all hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
