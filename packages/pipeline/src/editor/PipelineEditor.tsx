/**
 * 流水线编辑器组件
 * 提供 React 组件用于可视化编辑流水线
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  PipelineDefinition,
  PipelineNodeConfig,
  DAGVisualNode,
  DAGVisualEdge,
  NodeType,
  PipelineStatus,
  PipelineExecutionState,
} from '../types/pipeline.types';
import { PipelineEditorApi } from './pipeline-editor-api';

/**
 * 流水线编辑器组件属性
 */
export interface PipelineEditorProps {
  /** 初始流水线定义 */
  initialPipeline?: PipelineDefinition;
  /** YAML 或 JSON 格式的流水线 */
  initialYamlOrJson?: string;
  /** 只读模式 */
  readOnly?: boolean;
  /** 高度 */
  height?: number | string;
  /** 宽度 */
  width?: number | string;
  /** 是否显示工具栏 */
  showToolbar?: boolean;
  /** 是否显示属性面板 */
  showPropertiesPanel?: boolean;
  /** 主题 */
  theme?: 'light' | 'dark';
  /** 类名 */
  className?: string;
  /** 样式 */
  style?: React.CSSProperties;
  /** 流水线执行回调 */
  onExecute?: (state: PipelineExecutionState) => void;
  /** 保存回调 */
  onSave?: (pipeline: PipelineDefinition) => void;
  /** 变更回调 */
  onChange?: (pipeline: PipelineDefinition) => void;
}

/**
 * 节点组件属性
 */
interface NodeComponentProps {
  node: DAGVisualNode;
  selected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (nodeId: string, e: React.MouseEvent) => void;
  readOnly: boolean;
  theme: 'light' | 'dark';
}

/**
 * 边组件属性
 */
interface EdgeComponentProps {
  edge: DAGVisualEdge;
  sourceNode: DAGVisualNode;
  targetNode: DAGVisualNode;
  selected: boolean;
  onSelect: (edgeId: string) => void;
  theme: 'light' | 'dark';
}

/**
 * 获取节点颜色
 */
function getNodeColor(type: NodeType, theme: 'light' | 'dark'): string {
  const colors: Record<NodeType, { light: string; dark: string }> = {
    [NodeType.TASK]: { light: '#3b82f6', dark: '#60a5fa' },
    [NodeType.CONDITION]: { light: '#f59e0b', dark: '#fbbf24' },
    [NodeType.PARALLEL]: { light: '#8b5cf6', dark: '#a78bfa' },
    [NodeType.SEQUENCE]: { light: '#10b981', dark: '#34d399' },
    [NodeType.TRIGGER]: { light: '#ef4444', dark: '#f87171' },
    [NodeType.END]: { light: '#6b7280', dark: '#9ca3af' },
  };
  return colors[type]?.[theme] || colors[NodeType.TASK][theme];
}

/**
 * 获取节点图标
 */
function getNodeIcon(type: NodeType): string {
  const icons: Record<NodeType, string> = {
    [NodeType.TASK]: '⚡',
    [NodeType.CONDITION]: '?',
    [NodeType.PARALLEL]: '⫴',
    [NodeType.SEQUENCE]: '→',
    [NodeType.TRIGGER]: '▶',
    [NodeType.END]: '■',
  };
  return icons[type] || '●';
}

/**
 * 获取节点类型名称
 */
function getNodeTypeName(type: NodeType): string {
  const names: Record<NodeType, string> = {
    [NodeType.TASK]: '任务',
    [NodeType.CONDITION]: '条件',
    [NodeType.PARALLEL]: '并行',
    [NodeType.SEQUENCE]: '串行',
    [NodeType.TRIGGER]: '触发器',
    [NodeType.END]: '结束',
  };
  return names[type] || '节点';
}

/**
 * 节点组件
 */
const NodeComponent: React.FC<NodeComponentProps> = ({
  node,
  selected,
  onSelect,
  onDragStart,
  readOnly,
  theme,
}) => {
  const color = getNodeColor(node.type, theme);

  return (
    <div
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: 200,
        height: 80,
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        border: `2px solid ${selected ? '#3b82f6' : color}`,
        borderRadius: 8,
        boxShadow: selected
          ? '0 4px 12px rgba(59, 130, 246, 0.5)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        cursor: readOnly ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'box-shadow 0.2s, border-color 0.2s',
      }}
      onClick={() => !readOnly && onSelect(node.id)}
      onMouseDown={(e) => !readOnly && onDragStart(node.id, e)}
    >
      {/* 节点图标和类型 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        }}
      >
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: 4,
            backgroundColor: color,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 'bold',
            marginRight: 8,
          }}
        >
          {getNodeIcon(node.type)}
        </span>
        <span
          style={{
            fontSize: 12,
            color: color,
            fontWeight: 500,
          }}
        >
          {getNodeTypeName(node.type)}
        </span>
      </div>

      {/* 节点名称 */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: 14,
          fontWeight: 500,
          color: theme === 'dark' ? '#f9fafb' : '#111827',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {node.name}
      </div>
    </div>
  );
};

/**
 * 边组件
 */
const EdgeComponent: React.FC<EdgeComponentProps> = ({
  edge,
  sourceNode,
  targetNode,
  selected,
  onSelect,
  theme,
}) => {
  const sourceX = sourceNode.position.x + 200;
  const sourceY = sourceNode.position.y + 40;
  const targetX = targetNode.position.x;
  const targetY = targetNode.position.y + 40;

  const midX = (sourceX + targetX) / 2;
  const path = `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;

  const edgeColor =
    edge.edgeType === 'true'
      ? '#10b981'
      : edge.edgeType === 'false'
      ? '#ef4444'
      : selected
      ? '#3b82f6'
      : theme === 'dark'
      ? '#6b7280'
      : '#9ca3af';

  return (
    <g onClick={() => onSelect(edge.id)} style={{ cursor: 'pointer' }}>
      {/* 边的路径 */}
      <path
        d={path}
        fill="none"
        stroke={edgeColor}
        strokeWidth={selected ? 3 : 2}
        style={{ transition: 'stroke-width 0.2s' }}
      />
      {/* 箭头 */}
      <polygon
        points={`${targetX - 8},${targetY - 4} ${targetX},${targetY} ${targetX - 8},${targetY + 4}`}
        fill={edgeColor}
      />
      {/* 标签 */}
      {edge.label && (
        <text
          x={midX}
          y={(sourceY + targetY) / 2 - 10}
          textAnchor="middle"
          fill={edgeColor}
          fontSize={12}
        >
          {edge.label}
        </text>
      )}
    </g>
  );
};

/**
 * 工具栏组件
 */
interface ToolbarProps {
  onAddNode: (type: NodeType) => void;
  onDeleteSelected: () => void;
  onValidate: () => void;
  onExecute: () => void;
  onSave: () => void;
  onAutoLayout: () => void;
  hasSelection: boolean;
  isDirty: boolean;
  isExecuting: boolean;
  theme: 'light' | 'dark';
}

const Toolbar: React.FC<ToolbarProps> = ({
  onAddNode,
  onDeleteSelected,
  onValidate,
  onExecute,
  onSave,
  onAutoLayout,
  hasSelection,
  isDirty,
  isExecuting,
  theme,
}) => {
  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    marginRight: 8,
    border: 'none',
    borderRadius: 6,
    backgroundColor: theme === 'dark' ? '#374151' : '#e5e7eb',
    color: theme === 'dark' ? '#f9fafb' : '#111827',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'background-color 0.2s',
  };

  const primaryButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: '#ffffff',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        backgroundColor: theme === 'dark' ? '#1f2937' : '#f9fafb',
      }}
    >
      {/* 添加节点 */}
      <div style={{ marginRight: 16 }}>
        <select
          style={buttonStyle}
          onChange={(e) => {
            if (e.target.value) {
              onAddNode(e.target.value as NodeType);
              e.target.value = '';
            }
          }}
          defaultValue=""
        >
          <option value="" disabled>
            + 添加节点
          </option>
          <option value={NodeType.TASK}>任务节点</option>
          <option value={NodeType.CONDITION}>条件节点</option>
          <option value={NodeType.PARALLEL}>并行节点</option>
          <option value={NodeType.SEQUENCE}>串行节点</option>
          <option value={NodeType.TRIGGER}>触发器</option>
          <option value={NodeType.END}>结束节点</option>
        </select>
      </div>

      {/* 操作按钮 */}
      <button
        style={buttonStyle}
        onClick={onDeleteSelected}
        disabled={!hasSelection}
      >
        删除
      </button>
      <button style={buttonStyle} onClick={onAutoLayout}>
        自动布局
      </button>
      <button style={buttonStyle} onClick={onValidate}>
        验证
      </button>

      <div style={{ flex: 1 }} />

      {/* 状态指示 */}
      {isDirty && (
        <span
          style={{
            marginRight: 16,
            color: '#f59e0b',
            fontSize: 13,
          }}
        >
          未保存
        </span>
      )}

      {/* 主要操作 */}
      <button
        style={primaryButtonStyle}
        onClick={onExecute}
        disabled={isExecuting}
      >
        {isExecuting ? '执行中...' : '▶ 执行'}
      </button>
      <button
        style={{
          ...buttonStyle,
          marginLeft: 8,
          backgroundColor: '#10b981',
          color: '#ffffff',
        }}
        onClick={onSave}
        disabled={!isDirty}
      >
        保存
      </button>
    </div>
  );
};

/**
 * 属性面板组件
 */
interface PropertiesPanelProps {
  node: DAGVisualNode | null;
  pipeline: PipelineDefinition | null;
  onUpdateNode: (nodeId: string, updates: Partial<PipelineNodeConfig>) => void;
  onClose: () => void;
  theme: 'light' | 'dark';
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  node,
  pipeline,
  onUpdateNode,
  onClose,
  theme,
}) => {
  const [localName, setLocalName] = useState(node?.name || '');
  const [localDescription, setLocalDescription] = useState(node?.data.description || '');
  const [localTimeout, setLocalTimeout] = useState(node?.data.timeout?.toString() || '');
  const [localRetries, setLocalRetries] = useState(node?.data.retries?.toString() || '0');
  const [localAllowFailure, setLocalAllowFailure] = useState(node?.data.allowFailure || false);

  useEffect(() => {
    if (node) {
      setLocalName(node.name);
      setLocalDescription(node.data.description || '');
      setLocalTimeout(node.data.timeout?.toString() || '');
      setLocalRetries(node.data.retries?.toString() || '0');
      setLocalAllowFailure(node.data.allowFailure || false);
    }
  }, [node]);

  if (!node) {
    return null;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    marginBottom: 12,
    border: `1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'}`,
    borderRadius: 6,
    backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
    color: theme === 'dark' ? '#f9fafb' : '#111827',
    fontSize: 13,
  };

  return (
    <div
      style={{
        width: 280,
        height: '100%',
        borderLeft: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          属性
        </h3>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: theme === 'dark' ? '#9ca3af' : '#6b7280',
          }}
        >
          ×
        </button>
      </div>

      <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
        节点名称
      </label>
      <input
        style={inputStyle}
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={() => onUpdateNode(node.id, { name: localName })}
      />

      <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
        描述
      </label>
      <textarea
        style={{ ...inputStyle, height: 60, resize: 'vertical' }}
        value={localDescription}
        onChange={(e) => setLocalDescription(e.target.value)}
        onBlur={() => onUpdateNode(node.id, { description: localDescription })}
      />

      <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
        超时时间 (ms)
      </label>
      <input
        style={inputStyle}
        type="number"
        value={localTimeout}
        onChange={(e) => setLocalTimeout(e.target.value)}
        onBlur={() =>
          onUpdateNode(node.id, {
            timeout: localTimeout ? parseInt(localTimeout) : undefined,
          })
        }
      />

      <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'block' }}>
        重试次数
      </label>
      <input
        style={inputStyle}
        type="number"
        min="0"
        value={localRetries}
        onChange={(e) => setLocalRetries(e.target.value)}
        onBlur={() =>
          onUpdateNode(node.id, {
            retries: localRetries ? parseInt(localRetries) : undefined,
          })
        }
      />

      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={localAllowFailure}
          onChange={(e) => {
            setLocalAllowFailure(e.target.checked);
            onUpdateNode(node.id, { allowFailure: e.target.checked });
          }}
          style={{ marginRight: 8 }}
        />
        <span style={{ fontSize: 13 }}>允许失败</span>
      </label>
    </div>
  );
};

/**
 * 流水线编辑器组件
 */
export const PipelineEditor: React.FC<PipelineEditorProps> = ({
  initialPipeline,
  initialYamlOrJson,
  readOnly = false,
  height = 600,
  width = '100%',
  showToolbar = true,
  showPropertiesPanel = true,
  theme = 'light',
  className,
  style,
  onExecute,
  onSave,
  onChange,
}) => {
  const editorApiRef = useRef<PipelineEditorApi | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [nodes, setNodes] = useState<DAGVisualNode[]>([]);
  const [edges, setEdges] = useState<DAGVisualEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{ sourceId: string } | null>(null);

  // 初始化编辑器
  useEffect(() => {
    const api = new PipelineEditorApi();

    if (initialYamlOrJson) {
      api.loadPipeline(initialYamlOrJson);
    } else if (initialPipeline) {
      const yaml = JSON.stringify(initialPipeline);
      api.loadPipeline(yaml);
    } else {
      api.createPipeline();
    }

    editorApiRef.current = api;

    // 订阅状态变化
    const unsubscribe = api.subscribe((state) => {
      setNodes(state.dagData.nodes);
      setEdges(state.dagData.edges);
      setIsDirty(state.isDirty);
    });

    return () => unsubscribe();
  }, []);

  // 通知变更
  useEffect(() => {
    if (onChange && editorApiRef.current) {
      const pipeline = editorApiRef.current.exportPipeline();
      if (pipeline) {
        onChange(pipeline);
      }
    }
  }, [nodes, edges, onChange]);

  // 添加节点
  const handleAddNode = useCallback(
    (type: NodeType) => {
      if (!editorApiRef.current || readOnly) return;

      const centerX = (window.innerWidth / 2 - pan.x) / zoom;
      const centerY = ((height as number) / 2 - pan.y) / zoom;

      editorApiRef.current.addNode({
        type,
        name: `新${getNodeTypeName(type)}`,
        position: { x: centerX, y: centerY },
      });
    },
    [readOnly, zoom, pan, height]
  );

  // 删除选中
  const handleDeleteSelected = useCallback(() => {
    if (!editorApiRef.current || readOnly) return;

    if (selectedNodeId) {
      editorApiRef.current.deleteNode(selectedNodeId);
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      const edge = edges.find((e) => e.id === selectedEdgeId);
      if (edge) {
        editorApiRef.current.deleteEdge(edge.source, edge.target);
        setSelectedEdgeId(null);
      }
    }
  }, [readOnly, selectedNodeId, selectedEdgeId, edges]);

  // 验证
  const handleValidate = useCallback(() => {
    if (!editorApiRef.current) return;
    const result = editorApiRef.current.validate();
    if (!result.valid) {
      alert(`验证失败:\n${result.errors.map((e) => e.message).join('\n')}`);
    } else {
      alert('验证通过!');
    }
  }, []);

  // 执行
  const handleExecute = useCallback(async () => {
    if (!editorApiRef.current) return;

    setIsExecuting(true);
    try {
      const state = await editorApiRef.current.execute();
      onExecute?.(state);
    } catch (error) {
      alert(`执行失败: ${error}`);
    } finally {
      setIsExecuting(false);
    }
  }, [onExecute]);

  // 保存
  const handleSave = useCallback(() => {
    if (!editorApiRef.current) return;
    const pipeline = editorApiRef.current.exportPipeline();
    if (pipeline) {
      onSave?.(pipeline);
    }
  }, [onSave]);

  // 自动布局
  const handleAutoLayout = useCallback(() => {
    if (!editorApiRef.current || readOnly) return;
    editorApiRef.current.autoLayout();
  }, [readOnly]);

  // 更新节点
  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<PipelineNodeConfig>) => {
      if (!editorApiRef.current || readOnly) return;
      editorApiRef.current.updateNode(nodeId, updates);
    },
    [readOnly]
  );

  // 节点拖拽开始
  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    setIsDragging(true);
    setDragNodeId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  // 鼠标移动
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && dragNodeId && editorApiRef.current) {
        const dx = (e.clientX - dragStart.x) / zoom;
        const dy = (e.clientY - dragStart.y) / zoom;

        const node = nodes.find((n) => n.id === dragNodeId);
        if (node) {
          editorApiRef.current.updateNodePosition(dragNodeId, {
            x: node.position.x + dx,
            y: node.position.y + dy,
          });
          setDragStart({ x: e.clientX, y: e.clientY });
        }
      }
    },
    [isDragging, dragNodeId, dragStart, zoom, nodes]
  );

  // 鼠标释放
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragNodeId(null);
  }, []);

  // 节点选择
  const handleNodeSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      editorApiRef.current?.selectNode(nodeId);
    },
    []
  );

  // 边选择
  const handleEdgeSelect = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
  }, []);

  // 滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(3, z * delta)));
  }, []);

  // 计算边的路径
  const renderEdges = () => {
    return edges.map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);
      if (!sourceNode || !targetNode) return null;

      return (
        <EdgeComponent
          key={edge.id}
          edge={edge}
          sourceNode={sourceNode}
          targetNode={targetNode}
          selected={selectedEdgeId === edge.id}
          onSelect={handleEdgeSelect}
          theme={theme}
        />
      );
    });
  };

  const containerStyle: React.CSSProperties = {
    width,
    height,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: theme === 'dark' ? '#111827' : '#f3f4f6',
    borderRadius: 8,
    border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
    ...style,
  };

  return (
    <div style={containerStyle} className={className}>
      {/* 工具栏 */}
      {showToolbar && (
        <Toolbar
          onAddNode={handleAddNode}
          onDeleteSelected={handleDeleteSelected}
          onValidate={handleValidate}
          onExecute={handleExecute}
          onSave={handleSave}
          onAutoLayout={handleAutoLayout}
          hasSelection={!!selectedNodeId || !!selectedEdgeId}
          isDirty={isDirty}
          isExecuting={isExecuting}
          theme={theme}
        />
      )}

      {/* 主画布区域 */}
      <div
        style={{
          display: 'flex',
          height: showToolbar ? 'calc(100% - 52px)' : '100%',
        }}
      >
        {/* 画布 */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
          onWheel={handleWheel}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* SVG 层（边） */}
          <svg
            ref={svgRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {renderEdges()}
            </g>
          </svg>

          {/* 节点层 */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          >
            {nodes.map((node) => (
              <NodeComponent
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={handleNodeSelect}
                onDragStart={handleNodeDragStart}
                readOnly={readOnly}
                theme={theme}
              />
            ))}
          </div>

          {/* 空状态 */}
          {nodes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: theme === 'dark' ? '#9ca3af' : '#6b7280',
              }}
            >
              <p style={{ fontSize: 16, marginBottom: 8 }}>暂无节点</p>
              <p style={{ fontSize: 13 }}>点击上方「添加节点」开始创建流水线</p>
            </div>
          )}
        </div>

        {/* 属性面板 */}
        {showPropertiesPanel && selectedNodeId && (
          <PropertiesPanel
            node={nodes.find((n) => n.id === selectedNodeId) || null}
            pipeline={editorApiRef.current?.exportPipeline() || null}
            onUpdateNode={handleUpdateNode}
            onClose={() => setSelectedNodeId(null)}
            theme={theme}
          />
        )}
      </div>
    </div>
  );
};

export default PipelineEditor;
