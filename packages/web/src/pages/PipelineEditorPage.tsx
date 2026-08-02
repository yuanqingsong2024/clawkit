/**
 * DAG 可视化编辑器页面
 * 提供拖拽式节点编排和可视化流水线设计
 */

import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DAGEditor, type DAGNode } from '../components/pipeline/DAGEditor';
import { createPipeline, updatePipeline, getPipeline, type PipelineDetail } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';

export function PipelineEditorPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [nodes, setNodes] = useState<DAGNode[]>([
    {
      id: 'node-start',
      name: '开始',
      type: 'trigger',
      dependsOn: [],
      config: { prompt: '流水线入口点' },
      position: { x: 50, y: 200 },
    },
  ]);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [viewMode, setViewMode] = useState<'editor' | 'form'>('editor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // 加载已有流水线
  useState(() => {
    if (id) {
      loadPipeline(id);
    }
  });

  const loadPipeline = async (pipelineId: string) => {
    try {
      const pipeline = await getPipeline(pipelineId);
      if (pipeline) {
        setName(pipeline.meta?.name || '');
        setDescription(pipeline.meta?.description || '');
        // 将后端格式转换为前端格式
        const loadedNodes: DAGNode[] = (pipeline.stages || []).map((stage: any, index: number) => ({
          id: stage.id || `node-${index}`,
          name: stage.name || '未命名节点',
          type: (stage.type || 'task') as DAGNode['type'],
          dependsOn: stage.dependsOn || stage.dependencies || [],
          config: stage.config || {},
          position: stage.position || { x: 50 + index * 200, y: 200 },
        }));
        setNodes(loadedNodes.length > 0 ? loadedNodes : [{
          id: 'node-start',
          name: '开始',
          type: 'trigger',
          dependsOn: [],
          config: { prompt: '流水线入口点' },
          position: { x: 50, y: 200 },
        }]);
      }
    } catch (err) {
      console.error('加载流水线失败:', err);
    }
  };

  // 保存流水线
  const handleSave = async () => {
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

      // 将前端格式转换为后端格式
      const stages = nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        dependsOn: node.dependsOn,
        config: node.config,
      }));

      if (isEditing && id) {
        await updatePipeline(id, {
          name: name.trim(),
          description: description.trim(),
          stages,
        });
      } else {
        await createPipeline({
          name: name.trim(),
          description: description.trim(),
          stages,
        });
      }

      setShowSaveModal(false);
      navigate('/pipelines');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 导出为 YAML
  const handleExport = useCallback(() => {
    const yaml = `pipeline:
  name: "${name || '未命名流水线'}"
  description: "${description || ''}"
  
  stages:
${nodes.map(node => `    - id: "${node.id}"
      name: "${node.name}"
      type: ${node.type}
      ${node.dependsOn.length > 0 ? `dependsOn: [${node.dependsOn.map(d => `"${d}"`).join(', ')}]` : ''}
      config:
        prompt: "${node.config?.prompt || ''}"`).join('\n')}
`;

    // 创建下载
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'pipeline'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, name, description]);

  // 切换到表单模式时自动排列节点
  const autoArrange = useCallback(() => {
    // 计算层级
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    
    const calcLevel = (nodeId: string): number => {
      if (levels.has(nodeId)) return levels.get(nodeId)!;
      if (visited.has(nodeId)) return 0;
      
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.dependsOn.length === 0) {
        levels.set(nodeId, 0);
        return 0;
      }
      
      const maxDepLevel = Math.max(...node.dependsOn.map(depId => calcLevel(depId)));
      const level = maxDepLevel + 1;
      levels.set(nodeId, level);
      return level;
    };
    
    nodes.forEach(node => calcLevel(node.id));
    
    // 按层级分组
    const levelNodes = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelNodes.has(level)) levelNodes.set(level, []);
      levelNodes.get(level)!.push(nodeId);
    });
    
    // 更新位置
    const newNodes = nodes.map(node => {
      const level = levels.get(node.id) || 0;
      const sameLevelNodes = levelNodes.get(level) || [];
      const indexInLevel = sameLevelNodes.indexOf(node.id);
      const nodesInLevel = sameLevelNodes.length;
      
      return {
        ...node,
        position: {
          x: 50 + level * 200,
          y: 50 + indexInLevel * 120 + (300 - nodesInLevel * 120) / 2,
        },
      };
    });
    
    setNodes(newNodes);
  }, [nodes]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/pipelines')}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回
            </button>
            
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {isEditing ? '编辑流水线' : '新建流水线'}
              </h1>
              <p className="text-sm text-slate-500">
                拖拽节点设计你的 AI 工作流
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* 视图切换 */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('editor')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'editor' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                可视化
              </button>
              <button
                onClick={() => setViewMode('form')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'form' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                表单
              </button>
            </div>
            
            <button
              onClick={autoArrange}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
              </svg>
              自动排列
            </button>
            
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              导出 YAML
            </button>
            
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              保存
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'editor' ? (
          <DAGEditor
            nodes={nodes}
            onChange={setNodes}
          />
        ) : (
          <FormView
            nodes={nodes}
            setNodes={setNodes}
          />
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setShowSaveModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-slate-900 mb-4">保存流水线</h2>
            
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            
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
              
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">{nodes.length}</span> 个节点
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

// 表单视图组件
interface FormViewProps {
  nodes: DAGNode[];
  setNodes: React.Dispatch<React.SetStateAction<DAGNode[]>>;
}

function FormView({ nodes, setNodes }: FormViewProps) {
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<DAGNode['type']>('task');
  const [newNodePrompt, setNewNodePrompt] = useState('');
  const [newNodeDeps, setNewNodeDeps] = useState<string[]>([]);

  const handleAddNode = () => {
    if (!newNodeName.trim()) {
      alert('请输入节点名称');
      return;
    }

    const newNode: DAGNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      name: newNodeName.trim(),
      type: newNodeType,
      dependsOn: newNodeDeps,
      config: { prompt: newNodePrompt },
      position: { x: 50 + nodes.length * 200, y: 200 },
    };

    setNodes([...nodes, newNode]);
    setNewNodeName('');
    setNewNodeType('task');
    setNewNodePrompt('');
    setNewNodeDeps([]);
  };

  const handleRemoveNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId).map(n => ({
      ...n,
      dependsOn: n.dependsOn.filter(id => id !== nodeId),
    })));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 overflow-auto h-full">
      <div className="space-y-6">
        {/* 节点列表 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">节点配置</h2>
          
          {nodes.length > 0 && (
            <div className="mb-6 space-y-3">
              <h3 className="text-sm font-medium text-slate-700">已添加的节点</h3>
              {nodes.map((node, index) => (
                <div
                  key={node.id}
                  className="flex items-center gap-4 rounded-lg border border-slate-200 p-4"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${
                    node.type === 'trigger' ? 'from-green-500 to-emerald-500' :
                    node.type === 'condition' ? 'from-amber-500 to-orange-500' :
                    node.type === 'notifier' ? 'from-purple-500 to-violet-500' :
                    'from-blue-500 to-indigo-500'
                  } text-white font-semibold text-sm`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{node.name}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        {node.type === 'task' ? '任务' :
                         node.type === 'trigger' ? '触发器' :
                         node.type === 'condition' ? '条件' : '通知'}
                      </span>
                    </div>
                    {node.config?.prompt && (
                      <p className="mt-1 text-xs text-slate-400 font-mono">
                        {String(node.config.prompt)}
                      </p>
                    )}
                    {node.dependsOn.length > 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        依赖: {node.dependsOn.map(id => nodes.find(n => n.id === id)?.name || id).join(', ')}
                      </p>
                    )}
                  </div>
                  <button
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
          
          {/* 添加节点表单 */}
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
                    onChange={(e) => setNewNodeType(e.target.value as DAGNode['type'])}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="task">任务</option>
                    <option value="trigger">触发器</option>
                    <option value="condition">条件判断</option>
                    <option value="notifier">通知器</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-slate-500 mb-1">Prompt / 指令</label>
                <textarea
                  value={newNodePrompt}
                  onChange={(e) => setNewNodePrompt(e.target.value)}
                  placeholder="描述这个节点要执行的任务..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              {nodes.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">依赖节点</label>
                  <div className="flex flex-wrap gap-2">
                    {nodes.map((node) => (
                      <label key={node.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs cursor-pointer hover:bg-slate-200">
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
                onClick={handleAddNode}
                className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 transition-colors"
              >
                + 添加节点
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PipelineEditorPage;
