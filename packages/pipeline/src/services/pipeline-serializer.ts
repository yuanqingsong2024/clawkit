/**
 * 流水线序列化器
 * 负责流水线的导入/导出（YAML/JSON）
 */

import {
  NodeType,
  PipelineDefinition,
  PipelineNodeConfig,
  PipelineParameter,
  PipelineTrigger,
  DAGVisualData,
} from '../types/pipeline.types';

/**
 * 流水线序列化器
 */
export class PipelineSerializer {
  /**
   * 从 YAML 解析流水线定义
   */
  parseFromYaml(yaml: string): PipelineDefinition {
    // 简单的 YAML 解析（实际应该使用 js-yaml 库）
    const data = this.parseYamlToObject(yaml);
    return this.normalizePipelineData(data);
  }

  /**
   * 从 JSON 解析流水线定义
   */
  parseFromJson(json: string): PipelineDefinition {
    const data = JSON.parse(json);
    return this.normalizePipelineData(data);
  }

  /**
   * 将流水线序列化为 JSON
   */
  toJson(pipeline: PipelineDefinition): string {
    return JSON.stringify(pipeline, null, 2);
  }

  /**
   * 将流水线序列化为 YAML
   */
  toYaml(pipeline: PipelineDefinition): string {
    // 简化的 YAML 序列化
    const lines: string[] = [];
    
    lines.push(`id: ${pipeline.id}`);
    lines.push(`name: ${pipeline.name}`);
    lines.push(`version: ${pipeline.version}`);
    
    if (pipeline.description) {
      lines.push(`description: ${this.escapeYamlString(pipeline.description)}`);
    }
    
    lines.push('');
    lines.push('nodes:');
    
    for (const node of pipeline.nodes) {
      lines.push(`  - id: ${node.id}`);
      lines.push(`    name: ${this.escapeYamlString(node.name)}`);
      lines.push(`    type: ${node.type}`);
      
      if (node.description) {
        lines.push(`    description: ${this.escapeYamlString(node.description)}`);
      }
      
      if (node.executor) {
        lines.push(`    executor: ${node.executor}`);
      }
      
      if (node.condition) {
        lines.push(`    condition: ${this.escapeYamlString(node.condition)}`);
      }
      
      if (node.dependsOn && node.dependsOn.length > 0) {
        lines.push('    dependsOn:');
        for (const dep of node.dependsOn) {
          lines.push(`      - ${dep}`);
        }
      }
      
      if (node.timeout) {
        lines.push(`    timeout: ${node.timeout}`);
      }
      
      if (node.retries !== undefined) {
        lines.push(`    retries: ${node.retries}`);
      }
      
      if (node.allowFailure) {
        lines.push('    allowFailure: true');
      }
      
      lines.push('');
    }
    
    lines.push(`entryNodeId: ${pipeline.entryNodeId}`);
    
    if (pipeline.parameters && pipeline.parameters.length > 0) {
      lines.push('');
      lines.push('parameters:');
      for (const param of pipeline.parameters) {
        lines.push(`  - name: ${param.name}`);
        lines.push(`    type: ${param.type}`);
        if (param.defaultValue !== undefined) {
          lines.push(`    defaultValue: ${JSON.stringify(param.defaultValue)}`);
        }
        if (param.required) {
          lines.push('    required: true');
        }
        if (param.description) {
          lines.push(`    description: ${this.escapeYamlString(param.description)}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * 从 DAG 可视化数据转换
   */
  fromDAGVisualData(visualData: DAGVisualData, pipelineId: string): PipelineDefinition {
    const nodes: PipelineNodeConfig[] = [];
    let entryNodeId = '';

    // 转换节点
    for (const visualNode of visualData.nodes) {
      const node: PipelineNodeConfig = {
        ...visualNode.data,
        id: visualNode.id,
        name: visualNode.name,
        type: visualNode.type,
      };

      nodes.push(node);

      // 找到入度为 0 的节点作为入口
      const hasIncoming = visualData.edges.some(e => e.target === visualNode.id);
      if (!hasIncoming) {
        entryNodeId = visualNode.id;
      }
    }

    // 转换边为依赖关系
    for (const edge of visualData.edges) {
      const targetNode = nodes.find(n => n.id === edge.target);
      if (targetNode) {
        if (!targetNode.dependsOn) {
          targetNode.dependsOn = [];
        }
        if (!targetNode.dependsOn.includes(edge.source)) {
          targetNode.dependsOn.push(edge.source);
        }
      }
    }

    return {
      id: pipelineId,
      name: `Pipeline ${pipelineId}`,
      version: 1,
      nodes,
      entryNodeId: entryNodeId || nodes[0]?.id || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * 转换为 DAG 可视化数据
   */
  toDAGVisualData(pipeline: PipelineDefinition): DAGVisualData {
    const nodes = pipeline.nodes.map((node, index) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      position: this.calculateNodePosition(pipeline, node.id, index),
      data: node,
    }));

    const edges: DAGVisualData['edges'] = [];

    // 从依赖关系生成边
    const nodeIds = new Set(pipeline.nodes.map(n => n.id));

    for (const node of pipeline.nodes) {
      if (node.dependsOn) {
        for (const depId of node.dependsOn) {
          if (nodeIds.has(depId)) {
            edges.push({
              id: `edge-${depId}-${node.id}`,
              source: depId,
              target: node.id,
              edgeType: 'normal',
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 计算节点位置（简单的层级布局）
   */
  private calculateNodePosition(
    pipeline: PipelineDefinition,
    nodeId: string,
    index: number
  ): { x: number; y: number } {
    const node = pipeline.nodes.find(n => n.id === nodeId);
    if (!node) {
      return { x: 0, y: index * 100 };
    }

    // 计算深度
    const depth = this.calculateNodeDepth(pipeline, nodeId);
    const sameLevelNodes = pipeline.nodes.filter(
      n => this.calculateNodeDepth(pipeline, n.id) === depth
    );
    const levelIndex = sameLevelNodes.findIndex(n => n.id === nodeId);

    const nodeWidth = 200;
    const nodeHeight = 80;
    const horizontalGap = 100;
    const verticalGap = 100;

    return {
      x: depth * (nodeWidth + horizontalGap),
      y: levelIndex * (nodeHeight + verticalGap),
    };
  }

  /**
   * 计算节点深度
   */
  private calculateNodeDepth(pipeline: PipelineDefinition, nodeId: string): number {
    const node = pipeline.nodes.find(n => n.id === nodeId);
    if (!node || !node.dependsOn || node.dependsOn.length === 0) {
      return 0;
    }

    let maxDepth = 0;
    for (const depId of node.dependsOn) {
      maxDepth = Math.max(maxDepth, this.calculateNodeDepth(pipeline, depId) + 1);
    }

    return maxDepth;
  }

  /**
   * 标准化流水线数据
   */
  private normalizePipelineData(data: Record<string, unknown>): PipelineDefinition {
    const now = Date.now();

    return {
      id: (data.id as string) || `pipeline-${now}`,
      name: (data.name as string) || 'Unnamed Pipeline',
      description: data.description as string | undefined,
      version: (data.version as number) || 1,
      nodes: this.normalizeNodes((data.nodes as Record<string, unknown>[]) || []),
      entryNodeId: (data.entryNodeId as string) || '',
      parameters: this.normalizeParameters((data.parameters as Record<string, unknown>[]) || []),
      triggers: this.normalizeTriggers((data.triggers as Record<string, unknown>[]) || []),
      createdAt: (data.createdAt as number) || now,
      updatedAt: (data.updatedAt as number) || now,
    };
  }

  /**
   * 标准化节点
   */
  private normalizeNodes(nodes: Record<string, unknown>[]): PipelineNodeConfig[] {
    return nodes.map(node => ({
      id: (node.id as string) || '',
      name: (node.name as string) || 'Unnamed Node',
      type: (node.type as NodeType) || NodeType.TASK,
      description: node.description as string | undefined,
      executor: node.executor as string | undefined,
      executorConfig: node.executorConfig as Record<string, unknown> | undefined,
      condition: node.condition as string | undefined,
      trueBranch: node.trueBranch as string[] | undefined,
      falseBranch: node.falseBranch as string[] | undefined,
      dependsOn: node.dependsOn as string[] | undefined,
      timeout: node.timeout as number | undefined,
      retries: node.retries as number | undefined,
      retryDelay: node.retryDelay as number | undefined,
      allowFailure: node.allowFailure as boolean | undefined,
      parallelCount: node.parallelCount as number | undefined,
    }));
  }

  /**
   * 标准化参数
   */
  private normalizeParameters(params: Record<string, unknown>[]): PipelineParameter[] {
    return params.map(param => ({
      name: (param.name as string) || '',
      type: (param.type as PipelineParameter['type']) || 'string',
      defaultValue: param.defaultValue,
      required: param.required as boolean | undefined,
      description: param.description as string | undefined,
    }));
  }

  /**
   * 标准化触发器
   */
  private normalizeTriggers(triggers: Record<string, unknown>[]): PipelineTrigger[] {
    return triggers.map(trigger => ({
      id: (trigger.id as string) || `trigger-${Date.now()}`,
      type: (trigger.type as PipelineTrigger['type']) || 'manual',
      config: (trigger.config as Record<string, unknown>) || {},
      enabled: trigger.enabled !== false,
    }));
  }

  /**
   * 简单的 YAML 解析
   */
  private parseYamlToObject(yaml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yaml.split('\n');
    let currentKey = '';
    let currentArray: unknown[] | null = null;
    let currentObject: Record<string, unknown> | null = null;
    let indentLevel = 0;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, ''); // 移除 Windows 行尾
      if (!line.trim() || line.trim().startsWith('#')) continue;

      const indent = line.search(/\S/);
      const trimmedLine = line.trim();

      if (indent < indentLevel && currentObject) {
        // 结束当前对象
        if (currentArray) {
          result[currentKey] = currentArray;
          currentArray = null;
        } else {
          result[currentKey] = currentObject;
        }
        currentObject = null;
      }

      if (trimmedLine.startsWith('- ')) {
        // 数组项
        const value = trimmedLine.substring(2).trim();
        
        if (!currentArray) {
          currentArray = [];
          currentKey = 'nodes';
        }

        if (value.includes(':')) {
          // 对象
          const obj = this.parseYamlObject(value);
          currentArray.push(obj);
        } else {
          currentArray.push(value);
        }
      } else if (trimmedLine.includes(':')) {
        // 键值对
        const [key, ...valueParts] = trimmedLine.split(':');
        const value = valueParts.join(':').trim();

        if (!currentObject) {
          result[key.trim()] = value || '';
        } else {
          result[key.trim()] = value || '';
        }
        currentKey = key.trim();
      }

      indentLevel = indent >= 0 ? indent : indentLevel + 2;
    }

    return result;
  }

  /**
   * 解析 YAML 对象字符串
   */
  private parseYamlObject(str: string): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const pairs = str.split(',');

    for (const pair of pairs) {
      const [key, ...valueParts] = pair.split(':');
      if (key && valueParts.length > 0) {
        obj[key.trim()] = valueParts.join(':').trim();
      }
    }

    return obj;
  }

  /**
   * 转义 YAML 字符串
   */
  private escapeYamlString(str: string): string {
    if (str.includes('\n') || str.includes(':') || str.includes('#')) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  }
}
