/**
 * 创建流水线页面
 * 用于创建新的流水线定义
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { createPipeline, type PipelineNode } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';

export function PipelineCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectKey] = useState('clawkit');
  const [version] = useState('1.0.0');
  const [executionMode] = useState('sequential');
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 新节点表单
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState('executor');
  const [newNodeCommand, setNewNodeCommand] = useState('');
  const [newNodeDeps, setNewNodeDeps] = useState<string[]>([]);

  const handleAddNode = () => {
    if (!newNodeName.trim()) {
      alert('请输入节点名称');
      return;
    }

    const newNode: PipelineNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      type: newNodeType,
      name: newNodeName.trim(),
      config: {
        command: newNodeCommand,
      },
      dependsOn: newNodeDeps.length > 0 ? newNodeDeps : undefined,
    };

    setNodes([...nodes, newNode]);
    setNewNodeName('');
    setNewNodeCommand('');
    setNewNodeDeps([]);
  };

  const handleRemoveNode = (nodeId: string) => {
    // 移除节点及其依赖引用
    setNodes(nodes.filter(n => n.id !== nodeId).map(n => ({
      ...n,
      dependsOn: n.dependsOn?.filter(dep => dep !== nodeId),
    })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('请输入流水线名称');
      return;
    }

    if (nodes.length === 0) {
      setError('请至少添加一个节点');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const pipeline = await createPipeline({
        name: name.trim(),
        description: description.trim(),
        nodes,
      });

      navigate(`/pipelines/${pipeline.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/pipelines')}
          className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回流水线列表
        </button>
        <h1 className="text-2xl font-bold text-slate-900">创建流水线</h1>
        <p className="mt-1 text-sm text-slate-500">定义一个 AI 工作流流水线，包含多个执行节点</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">基本信息</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  流水线名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：代码审查流水线"
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  描述
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述这个流水线的用途..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    项目
                  </label>
                  <input
                    type="text"
                    value={projectKey}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    执行模式
                  </label>
                  <select
                    value={executionMode}
                    disabled
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
                  >
                    <option value="sequential">顺序执行</option>
                    <option value="parallel">并行执行</option>
                    <option value="dag">DAG 执行</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Nodes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h2 className="mb-4 text-lg font-semibold text-slate-900">节点配置</h2>

            {/* Existing Nodes */}
            {nodes.length > 0 && (
              <div className="mb-6 space-y-3">
                <h3 className="text-sm font-medium text-slate-700">已添加的节点</h3>
                {nodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-4 rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{node.name}</span>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          {node.type}
                        </span>
                      </div>
                      {node.config && (
                        <p className="mt-1 text-xs text-slate-400 font-mono">
                          {String(node.config.command)}
                        </p>
                      )}
                      {node.dependsOn && node.dependsOn.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          依赖: {node.dependsOn.length} 个节点
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveNode(node.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Node Form */}
            <div className="rounded-lg border border-dashed border-slate-300 p-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">添加新节点</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">节点名称</label>
                    <input
                      type="text"
                      value={newNodeName}
                      onChange={(e) => setNewNodeName(e.target.value)}
                      placeholder="例如：代码检查"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">节点类型</label>
                    <select
                      value={newNodeType}
                      onChange={(e) => setNewNodeType(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="executor">执行器</option>
                      <option value="trigger">触发器</option>
                      <option value="notifier">通知器</option>
                      <option value="condition">条件判断</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">命令/配置</label>
                  <input
                    type="text"
                    value={newNodeCommand}
                    onChange={(e) => setNewNodeCommand(e.target.value)}
                    placeholder="例如：npm run lint, npm run test"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {nodes.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">依赖节点（可选）</label>
                    <div className="flex flex-wrap gap-2">
                      {nodes.map((node) => (
                        <label key={node.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={newNodeDeps.includes(node.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewNodeDeps([...newNodeDeps, node.id]);
                              } else {
                                setNewNodeDeps(newNodeDeps.filter(id => id !== node.id));
                              }
                            }}
                            className="rounded"
                          />
                          {node.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleAddNode}
                  className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  + 添加节点
                </button>
              </div>
            </div>
          </motion.div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/pipelines')}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || nodes.length === 0}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
            >
              {loading ? '创建中...' : '创建流水线'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
