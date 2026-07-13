/**
 * 流水线详情页面
 * 展示流水线的详细信息和执行状态
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loading, Badge, Tabs } from '../components/ui';
import { getPipeline, getPipelineExecutions, executePipeline, type PipelineDefinition, type PipelineExecution } from '../lib/api';

export function PipelineDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [pipeline, setPipeline] = useState<PipelineDefinition | null>(null);
  const [executions, setExecutions] = useState<PipelineExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pipelineData, executionsData] = await Promise.all([
        getPipeline(id!),
        getPipelineExecutions(id!),
      ]);
      setPipeline(pipelineData);
      setExecutions(executionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    try {
      setExecuting(true);
      await executePipeline(id!);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '执行失败');
    } finally {
      setExecuting(false);
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

  const getExecutionStatusBadge = (status: PipelineExecution['status']) => {
    const statusMap = {
      pending: { label: '等待中', className: 'bg-slate-100 text-slate-600' },
      running: { label: '运行中', className: 'bg-blue-100 text-blue-700' },
      completed: { label: '已完成', className: 'bg-green-100 text-green-700' },
      failed: { label: '失败', className: 'bg-red-100 text-red-700' },
      cancelled: { label: '已取消', className: 'bg-slate-100 text-slate-400' },
    };
    const config = statusMap[status] || statusMap.pending;
    return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}>{config.label}</span>;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <Loading text="加载流水线详情..." />
        </div>
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="rounded-2xl bg-red-50 p-6 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h3 className="text-lg font-semibold text-red-700">加载失败</h3>
          <p className="mt-2 text-sm text-red-600">{error || '流水线不存在'}</p>
          <Link to="/pipelines" className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            返回列表
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: '概览', icon: '📊' },
    { key: 'nodes', label: '节点配置', icon: '🔗' },
    { key: 'executions', label: '执行历史', icon: '📜' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to="/pipelines" className="text-slate-400 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{pipeline.name}</h1>
              {getStatusBadge(pipeline.status)}
            </div>
            <p className="mt-1 text-sm text-slate-500">{pipeline.description || '暂无描述'}</p>
          </div>
        </div>
        <button
          onClick={handleExecute}
          disabled={executing}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition-all hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {executing ? '执行中...' : '执行流水线'}
        </button>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} variant="underline" />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            {/* Basic Info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">基本信息</h3>
              <div className="space-y-4">
                <div className="flex justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-500">项目</span>
                  <span className="text-sm font-medium text-slate-900">{pipeline.projectKey}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-500">版本</span>
                  <span className="text-sm font-medium text-slate-900">v{pipeline.version}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-3">
                  <span className="text-sm text-slate-500">执行模式</span>
                  <span className="text-sm font-medium text-slate-900">{pipeline.executionMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500">节点数量</span>
                  <span className="text-sm font-medium text-slate-900">{pipeline.nodes?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Recent Execution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">最近执行</h3>
              {executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-2 text-4xl">📋</div>
                  <p className="text-sm text-slate-500">暂无执行记录</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {executions.slice(0, 3).map((exec) => (
                    <div key={exec.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {getExecutionStatusBadge(exec.status)}
                          <span className="text-xs text-slate-400">
                            {formatDate(exec.startedAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          耗时: {formatDuration(exec.duration)}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        #{exec.id.slice(-6)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'nodes' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">节点列表</h3>
              {pipeline.nodes && pipeline.nodes.length > 0 ? (
                <div className="space-y-3">
                  {pipeline.nodes.map((node, index) => (
                    <div key={node.id} className="flex items-center gap-4 rounded-lg border border-slate-200 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{node.name}</span>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{node.type}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">ID: {node.id}</p>
                      </div>
                      {node.dependsOn && node.dependsOn.length > 0 && (
                        <div className="text-xs text-slate-400">
                          依赖: {node.dependsOn.length} 个节点
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-2 text-4xl">🔗</div>
                  <p className="text-sm text-slate-500">暂无节点配置</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'executions' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">执行历史</h3>
              {executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-2 text-4xl">📋</div>
                  <p className="text-sm text-slate-500">暂无执行记录</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">执行ID</th>
                        <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">状态</th>
                        <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">触发方式</th>
                        <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">开始时间</th>
                        <th className="pb-3 text-left text-xs font-semibold uppercase text-slate-500">耗时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {executions.map((exec) => (
                        <tr key={exec.id} className="border-b border-slate-100">
                          <td className="py-3 text-sm font-mono text-slate-600">#{exec.id.slice(-8)}</td>
                          <td className="py-3">{getExecutionStatusBadge(exec.status)}</td>
                          <td className="py-3 text-sm text-slate-600">{exec.triggerType || '-'}</td>
                          <td className="py-3 text-sm text-slate-600">{formatDate(exec.startedAt)}</td>
                          <td className="py-3 text-sm text-slate-600">{formatDuration(exec.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
