/**
 * DAG 可视化编辑器
 * 提供拖拽式节点编排和连线功能
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';

export interface DAGNode {
  id: string;
  name: string;
  type: 'task' | 'trigger' | 'condition' | 'notifier';
  dependsOn: string[];
  position?: { x: number; y: number };
  config?: {
    prompt?: string;
    executor?: string;
    condition?: string;
    command?: string;
  };
}

export interface DAGEditorProps {
  initialNodes?: DAGNode[];
  onChange?: (nodes: DAGNode[]) => void;
  readOnly?: boolean;
}

// 节点类型配置
const NODE_TYPE_CONFIG = {
  task: {
    label: '任务',
    color: 'from-blue-500 to-indigo-500',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  trigger: {
    label: '触发器',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50 border-green-200',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  condition: {
    label: '条件',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
    ),
  },
  notifier: {
    label: '通知',
    color: 'from-purple-500 to-violet-500',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
};

export function DAGEditor({ initialNodes = [], onChange, readOnly = false }: DAGEditorProps): JSX.Element {
  const [nodes, setNodes] = useState<DAGNode[]>(() => {
    if (initialNodes.length > 0) {
      return initialNodes;
    }
    // 默认位置布局
    return [
      { id: 'node-1', name: '开始', type: 'trigger', dependsOn: [], config: { prompt: '流水线入口' }, position: { x: 100, y: 200 } },
      { id: 'node-2', name: '构建', type: 'task', dependsOn: ['node-1'], config: { prompt: '运行构建' }, position: { x: 300, y: 200 } },
      { id: 'node-3', name: '测试', type: 'task', dependsOn: ['node-2'], config: { prompt: '运行测试' }, position: { x: 500, y: 200 } },
    ];
  });
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [editingNode, setEditingNode] = useState<DAGNode | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<DAGNode['type']>('task');
  const [newNodePrompt, setNewNodePrompt] = useState('');
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // 通知父组件变化
  useEffect(() => {
    onChange?.(nodes);
  }, [nodes, onChange]);

  // 计算边的位置
  const getEdgePath = useCallback((fromId: string, toId: string) => {
    const fromNode = nodes.find(n => n.id === fromId);
    const toNode = nodes.find(n => n.id === toId);
    if (!fromNode || !toNode || !fromNode.position || !toNode.position) return '';

    const x1 = fromNode.position.x + 120; // 节点宽度
    const y1 = fromNode.position.y + 40;  // 节点高度 / 2
    const x2 = toNode.position.x;
    const y2 = toNode.position.y + 40;

    // 贝塞尔曲线
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }, [nodes]);

  // 添加节点
  const handleAddNode = () => {
    const newNode: DAGNode = {
      id: `node-${uuidv4().slice(0, 8)}`,
      name: newNodeName || '新节点',
      type: newNodeType,
      dependsOn: [],
      config: { prompt: newNodePrompt },
      position: {
        x: 100 + nodes.length * 200,
        y: 200,
      },
    };
    setNodes([...nodes, newNode]);
    setNewNodeName('');
    setNewNodeType('task');
    setNewNodePrompt('');
    setShowNodeForm(false);
  };

  // 删除节点
  const handleDeleteNode = (nodeId: string) => {
    setNodes(nodes.filter(n => n.id !== nodeId).map(n => ({
      ...n,
      dependsOn: n.dependsOn.filter(id => id !== nodeId),
    })));
    if (selectedNode === nodeId) setSelectedNode(null);
  };

  // 开始连线
  const handleStartConnect = (nodeId: string) => {
    if (readOnly) return;
    setConnectingFrom(nodeId);
  };

  // 完成连线
  const handleEndConnect = (nodeId: string) => {
    if (connectingFrom && connectingFrom !== nodeId) {
      const fromNode = nodes.find(n => n.id === connectingFrom);
      if (fromNode && !fromNode.dependsOn.includes(nodeId)) {
        // 检查是否会形成循环
        if (!wouldCreateCycle(connectingFrom, nodeId)) {
          setNodes(nodes.map(n => {
            if (n.id === connectingFrom) {
              return { ...n, dependsOn: [...n.dependsOn, nodeId] };
            }
            return n;
          }));
        }
      }
    }
    setConnectingFrom(null);
  };

  // 检查是否形成循环
  const wouldCreateCycle = (fromId: string, toId: string): boolean => {
    const visited = new Set<string>();
    const stack = [toId];
    
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === fromId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      
      const node = nodes.find(n => n.id === current);
      if (node) {
        stack.push(...node.dependsOn);
      }
    }
    return false;
  };

  // 拖拽开始
  const handleDragStart = (e: React.MouseEvent, nodeId: string) => {
    if (readOnly) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !node.position) return;
    
    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
  };

  // 拖拽移动
  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!draggedNode || readOnly) return;
    
    const newX = Math.max(0, e.clientX - dragOffset.x);
    const newY = Math.max(0, e.clientY - dragOffset.y);
    
    setNodes(nodes.map(n => {
      if (n.id === draggedNode) {
        return { ...n, position: { x: newX, y: newY } };
      }
      return n;
    }));
  }, [draggedNode, dragOffset, nodes, readOnly]);

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedNode(null);
  };

  // 双击编辑节点
  const handleDoubleClick = (node: DAGNode) => {
    if (readOnly) return;
    setEditingNode(node);
    setNewNodeName(node.name);
    setNewNodeType(node.type);
    setNewNodePrompt(String(node.config?.prompt || ''));
  };

  // 保存编辑
  const handleSaveEdit = () => {
    if (editingNode) {
      setNodes(nodes.map(n => {
        if (n.id === editingNode.id) {
          return {
            ...n,
            name: newNodeName,
            type: newNodeType,
            config: { prompt: newNodePrompt },
          };
        }
        return n;
      }));
    } else {
      handleAddNode();
    }
    setEditingNode(null);
    setShowNodeForm(false);
  };

  // 获取拓扑排序（用于显示执行顺序）
  const getTopologicalOrder = (): string[] => {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();
    
    // 初始化
    nodes.forEach(n => {
      inDegree.set(n.id, 0);
      adjList.set(n.id, []);
    });
    
    // 构建图
    nodes.forEach(n => {
      n.dependsOn.forEach(dep => {
        adjList.get(dep)?.push(n.id);
        inDegree.set(n.id, (inDegree.get(n.id) || 0) + 1);
      });
    });
    
    // 拓扑排序
    const queue: string[] = [];
    const result: string[] = [];
    
    // 找到入度为 0 的节点
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      result.push(nodeId);
      
      adjList.get(nodeId)?.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      });
    }
    
    return result;
  };

  const executionOrder = getTopologicalOrder();

  return (
    <div className="relative w-full h-full min-h-[500px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      {!readOnly && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2">
          <button
            onClick={() => {
              setShowNodeForm(true);
              setEditingNode(null);
              setNewNodeName('');
              setNewNodeType('task');
              setNewNodePrompt('');
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加节点
          </button>
          
          <div className="h-6 w-px bg-slate-200" />
          
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">{nodes.length}</span> 个节点
          </div>
          
          <div className="text-xs text-slate-500">
            执行顺序: {executionOrder.map(id => nodes.find(n => n.id === id)?.name).join(' → ')}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onClick={() => {
          if (connectingFrom) setConnectingFrom(null);
          setSelectedNode(null);
        }}
      >
        {/* SVG 层：绘制连线 */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
            </marker>
          </defs>
          
          {/* 绘制连线 */}
          {nodes.map(node =>
            node.dependsOn.map(depId => (
              <g key={`${depId}-${node.id}`}>
                <path
                  d={getEdgePath(depId, node.id)}
                  stroke="#94a3b8"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                />
                {/* 选中高亮 */}
                {connectingFrom === depId && (
                  <path
                    d={getEdgePath(depId, node.id)}
                    stroke="#3b82f6"
                    strokeWidth="3"
                    fill="none"
                    opacity="0.5"
                  />
                )}
              </g>
            ))
          )}
          
          {/* 正在连线时显示预览线 */}
          {connectingFrom && (
            <line
              x1={(nodes.find(n => n.id === connectingFrom)?.position?.x || 0) + 120}
              y1={(nodes.find(n => n.id === connectingFrom)?.position?.y || 0) + 40}
              x2="0"
              y2="0"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="invisible"
            />
          )}
        </svg>

        {/* 节点层 */}
        {nodes.map((node) => {
          const typeConfig = NODE_TYPE_CONFIG[node.type];
          const isSelected = selectedNode === node.id;
          const isConnecting = connectingFrom === node.id;
          const isDragging = draggedNode === node.id;
          const execIndex = executionOrder.indexOf(node.id);

          return (
            <div
              key={node.id}
              className={`
                absolute w-[120px] rounded-lg border-2 p-3 cursor-pointer
                transition-all duration-150 select-none
                ${typeConfig.bgColor}
                ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-slate-200'}
                ${isConnecting ? 'ring-2 ring-blue-500/50 scale-105' : ''}
                ${isDragging ? 'shadow-xl scale-105' : 'hover:shadow-md'}
                ${connectingFrom ? 'hover:border-blue-300' : ''}
              `}
              style={{
                left: node.position?.x || 0,
                top: node.position?.y || 0,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(node.id);
                if (connectingFrom) {
                  handleEndConnect(node.id);
                }
              }}
              onDoubleClick={() => handleDoubleClick(node)}
              onMouseDown={(e) => handleDragStart(e, node.id)}
            >
              {/* 执行顺序标记 */}
              <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-white text-xs font-bold flex items-center justify-center">
                {execIndex + 1}
              </div>
              
              {/* 删除按钮 */}
              {!readOnly && (
                <button
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteNode(node.id);
                  }}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* 节点内容 */}
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${typeConfig.color} text-white mb-2`}>
                  {typeConfig.icon}
                </div>
                <div className="font-medium text-sm text-slate-800 truncate">{node.name}</div>
                <div className="text-xs text-slate-500">{typeConfig.label}</div>
              </div>
              
              {/* 连线按钮 */}
              {!readOnly && (
                <div
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center cursor-crosshair hover:bg-blue-100 hover:border-blue-300 transition-colors"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleStartConnect(node.id);
                  }}
                  title="拖动创建连线"
                >
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                </div>
              )}
              
              {/* 依赖指示 */}
              {node.dependsOn.length > 0 && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-500">
                  {node.dependsOn.length} 个依赖
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 添加/编辑节点表单 */}
      {(showNodeForm || editingNode) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-20"
          onClick={() => {
            setShowNodeForm(false);
            setEditingNode(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-2xl p-6 w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingNode ? '编辑节点' : '添加新节点'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  节点名称
                </label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="例如：代码检查"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  节点类型
                </label>
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
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prompt / 指令
                </label>
                <textarea
                  value={newNodePrompt}
                  onChange={(e) => setNewNodePrompt(e.target.value)}
                  placeholder="描述这个节点要执行的任务..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNodeForm(false);
                  setEditingNode(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
              >
                {editingNode ? '保存' : '添加'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 帮助提示 */}
      {!readOnly && nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <svg className="h-16 w-16 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <p className="text-lg font-medium mb-2">开始构建你的流水线</p>
            <p className="text-sm">点击上方「添加节点」按钮创建第一个节点</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default DAGEditor;
