/**
 * 流水线列表页面
 * 工作台风格：紧凑卡片布局
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { primaryButtonClassName, compactButtonClassName } from '../components/ui/styles';

import { getPipelines, executePipeline, deletePipeline, type PipelineDefinition } from '../lib/api';

export function PipelineListPage(): JSX.Element {
  const [pipelines, setPipelines] = useState<PipelineDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : '执行失败');
    } finally {
      setExecuting(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个流水线吗？')) return;
    try {
      setDeleting(id);
      await deletePipeline(id);
      await loadPipelines();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: PipelineDefinition['status']) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      draft: { label: '草稿', className: 'bg-slate-50 text-slate-600 ring-slate-500/10' },
      active: { label: '运行中', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
      paused: { label: '已暂停', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
      archived: { label: '已归档', className: 'bg-slate-50 text-slate-400 ring-slate-500/10' },
    };
    const config = statusMap[status] || statusMap.draft;
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${config.className}`}>
        {config.label}
      </span>
    );
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
      <Card compact title="流水线">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card compact key={i} className="overflow-hidden animate-pulse">
              <div className="h-24 rounded bg-slate-200 mb-3"></div>
              <div className="space-y-2">
                <div className="h-4 rounded bg-slate-200 w-3/4"></div>
                <div className="h-3 rounded bg-slate-200 w-1/2"></div>
                <div className="h-8 rounded bg-slate-200 w-24"></div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-8">
          <div className="mb-3 text-4xl">⚠️</div>
          <h3 className="text-base font-semibold text-slate-900 mb-2">加载失败</h3>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            onClick={loadPipelines}
            className={`${primaryButtonClassName} bg-rose-600 hover:bg-rose-700`}
          >
            重试
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部标题和快速操作 */}
      <PageHeader
        title="流水线管理"
        description="管理和执行 AI 工作流流水线"
        actions={[
          <Link
            key="create"
            to="/pipelines/create"
            className={`${primaryButtonClassName} bg-green-700 hover:bg-green-800`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建
          </Link>,
        ]}
      />

      {/* 空状态 */}
      {pipelines.length === 0 ? (
        <Card className="text-center py-12">
          <div className="mb-4 text-6xl">🔄</div>
          <h3 className="text-base font-semibold text-slate-800 mb-2">暂无流水线</h3>
          <p className="text-sm text-slate-500 mb-6">创建你的第一个流水线，开始自动化工作流</p>
          <Link
            to="/pipelines/create"
            className={`${primaryButtonClassName} bg-blue-600 hover:bg-blue-700`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            创建流水线
          </Link>
        </Card>
      ) : null}

      {/* 流水线列表 - 卡片网格 */}
      {pipelines.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline, index) => (
            <motion.div
              key={pipeline.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group"
            >
              <Card compact className="h-full hover:shadow-md transition-all">
                {/* 头部 - 图标和状态 */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 shadow">
                    <span className="text-lg">🔄</span>
                  </div>
                  <div className="flex gap-1.5">
                    {getStatusBadge(pipeline.status)}
                    <Badge
                      tone={pipeline.status === 'active' ? 'info' : 'neutral'}
                      className="text-xs"
                    >
                      v{pipeline.version}
                    </Badge>
                  </div>
                </div>

                {/* 主要信息 */}
                <h3 className="text-sm font-semibold text-slate-900 mb-1.5 truncate">
                  {pipeline.name}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                  {pipeline.description || '暂无描述'}
                </p>

                {/* 元数据 */}
                <div className="mb-3 flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {pipeline.nodes?.length || 0} 个节点
                  </span>
                  <span>📁 {pipeline.projectKey}</span>
                </div>

                {/* 时间信息 */}
                <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[10px] text-slate-500 leading-4">
                  更新：{formatDate(pipeline.updatedAt)}
                </div>

                {/* 操作按钮 */}
                <div className="mt-3 flex gap-1.5">
                  <Link
                    to={`/pipelines/${pipeline.id}`}
                    className={`${compactButtonClassName} flex-1 bg-blue-600 text-white hover:bg-blue-700`}
                  >
                    查看
                  </Link>
                  <button
                    onClick={() => handleExecute(pipeline.id)}
                    disabled={executing === pipeline.id}
                    className={`${compactButtonClassName} px-2 py-1 text-xs ${pipeline.status === 'active' ? 'bg-slate-800 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                  >
                    {executing === pipeline.id ? '执行中…' : pipeline.status === 'active' ? '停止' : '执行'}
                  </button>
                  <button
                    onClick={() => handleDelete(pipeline.id)}
                    disabled={deleting === pipeline.id}
                    className={`${compactButtonClassName} border border-slate-200 hover:bg-slate-50`}
                    title="删除流水线"
                  >
                    {deleting === pipeline.id ? '删除中…' : '🗑️'}
                  </button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
