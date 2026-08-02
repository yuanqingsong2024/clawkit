/**
 * 流水线验证器
 * 负责验证流水线定义的有效性
 */

import {
  PipelineDefinition,
  PipelineNodeConfig,
  NodeType,
} from '../types/pipeline.types';

/**
 * 验证错误
 */
export interface ValidationError {
  /** 错误类型 */
  type: ValidationErrorType;
  /** 错误消息 */
  message: string;
  /** 节点 ID（如果涉及节点） */
  nodeId?: string;
  /** 字段路径 */
  path?: string;
}

/**
 * 验证错误类型
 */
export enum ValidationErrorType {
  /** 缺少必需字段 */
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  /** 无效的字段值 */
  INVALID_FIELD_VALUE = 'invalid_field_value',
  /** 循环依赖 */
  CYCLE_DETECTED = 'cycle_detected',
  /** 孤立的节点 */
  ORPHAN_NODE = 'orphan_node',
  /** 缺少入口节点 */
  MISSING_ENTRY_NODE = 'missing_entry_node',
  /** 节点类型错误 */
  INVALID_NODE_TYPE = 'invalid_node_type',
  /** 依赖节点不存在 */
  DEPENDENCY_NOT_FOUND = 'dependency_not_found',
  /** 配置错误 */
  INVALID_CONFIG = 'invalid_config',
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
  /** 警告列表 */
  warnings: ValidationError[];
}

/**
 * 流水线验证器
 */
export class PipelineValidator {
  /**
   * 验证流水线定义
   */
  validate(pipeline: PipelineDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // 验证基本结构
    this.validateBasicStructure(pipeline, errors, warnings);

    // 验证节点
    if (errors.length === 0) {
      this.validateNodes(pipeline, errors, warnings);
    }

    // 验证依赖关系
    if (errors.length === 0) {
      this.validateDependencies(pipeline, errors, warnings);
    }

    // 验证配置
    if (errors.length === 0) {
      this.validateConfigurations(pipeline, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证基本结构
   */
  private validateBasicStructure(
    pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // 验证 ID
    if (!pipeline.id) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        message: '流水线 ID 不能为空',
        path: 'id',
      });
    }

    // 验证名称
    if (!pipeline.name) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        message: '流水线名称不能为空',
        path: 'name',
      });
    }

    // 验证版本
    if (typeof pipeline.version !== 'number' || pipeline.version < 1) {
      errors.push({
        type: ValidationErrorType.INVALID_FIELD_VALUE,
        message: '流水线版本必须是大于等于 1 的数字',
        path: 'version',
      });
    }

    // 验证节点列表
    if (!pipeline.nodes || !Array.isArray(pipeline.nodes)) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        message: '流水线必须包含节点列表',
        path: 'nodes',
      });
      return;
    }

    if (pipeline.nodes.length === 0) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED_FIELD,
        message: '流水线必须至少包含一个节点',
        path: 'nodes',
      });
    }

    // 验证入口节点
    if (!pipeline.entryNodeId) {
      errors.push({
        type: ValidationErrorType.MISSING_ENTRY_NODE,
        message: '流水线必须指定入口节点',
        path: 'entryNodeId',
      });
    } else {
      const hasEntryNode = pipeline.nodes.some(n => n.id === pipeline.entryNodeId);
      if (!hasEntryNode) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          message: `入口节点 ${pipeline.entryNodeId} 不存在`,
          path: 'entryNodeId',
          nodeId: pipeline.entryNodeId,
        });
      }
    }
  }

  /**
   * 验证节点
   */
  private validateNodes(
    pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const nodeIds = new Set<string>();

    for (const node of pipeline.nodes) {
      // 验证节点 ID
      if (!node.id) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          message: '节点 ID 不能为空',
          path: `nodes[?].id`,
        });
        continue;
      }

      // 检查重复 ID
      if (nodeIds.has(node.id)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          message: `节点 ID ${node.id} 重复`,
          path: `nodes[${node.id}].id`,
          nodeId: node.id,
        });
      }
      nodeIds.add(node.id);

      // 验证节点名称
      if (!node.name) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED_FIELD,
          message: '节点名称不能为空',
          path: `nodes[${node.id}].name`,
          nodeId: node.id,
        });
      }

      // 验证节点类型
      if (!Object.values(NodeType).includes(node.type)) {
        errors.push({
          type: ValidationErrorType.INVALID_NODE_TYPE,
          message: `无效的节点类型: ${node.type}`,
          path: `nodes[${node.id}].type`,
          nodeId: node.id,
        });
      }

      // 验证条件节点配置
      if (node.type === NodeType.CONDITION) {
        if (!node.condition) {
          errors.push({
            type: ValidationErrorType.INVALID_CONFIG,
            message: '条件节点必须指定条件表达式',
            path: `nodes[${node.id}].condition`,
            nodeId: node.id,
          });
        }

        if (!node.trueBranch || node.trueBranch.length === 0) {
          warnings.push({
            type: ValidationErrorType.INVALID_CONFIG,
            message: '条件节点建议指定条件为真时的分支',
            path: `nodes[${node.id}].trueBranch`,
            nodeId: node.id,
          });
        }
      }

      // 验证超时配置
      if (node.timeout !== undefined && (typeof node.timeout !== 'number' || node.timeout <= 0)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          message: '超时时间必须是正数',
          path: `nodes[${node.id}].timeout`,
          nodeId: node.id,
        });
      }

      // 验证重试配置
      if (node.retries !== undefined && (typeof node.retries !== 'number' || node.retries < 0)) {
        errors.push({
          type: ValidationErrorType.INVALID_FIELD_VALUE,
          message: '重试次数必须是非负数',
          path: `nodes[${node.id}].retries`,
          nodeId: node.id,
        });
      }
    }
  }

  /**
   * 验证依赖关系
   */
  private validateDependencies(
    pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    const nodeIds = new Set(pipeline.nodes.map(n => n.id));
    const hasEntry = new Set<string>();

    for (const node of pipeline.nodes) {
      // 验证依赖节点存在
      if (node.dependsOn) {
        for (const depId of node.dependsOn) {
          if (!nodeIds.has(depId)) {
            errors.push({
              type: ValidationErrorType.DEPENDENCY_NOT_FOUND,
              message: `依赖的节点 ${depId} 不存在`,
              path: `nodes[${node.id}].dependsOn`,
              nodeId: node.id,
            });
          } else {
            hasEntry.add(depId);
          }
        }
      } else {
        // 没有依赖的节点是入口节点
        hasEntry.add(node.id);
      }
    }

    // 检查是否有孤立节点（除了入口节点）
    for (const node of pipeline.nodes) {
      if (!hasEntry.has(node.id) && node.id !== pipeline.entryNodeId) {
        warnings.push({
          type: ValidationErrorType.ORPHAN_NODE,
          message: `节点 ${node.id} 不可达（没有前置依赖且不是入口节点）`,
          path: `nodes[${node.id}]`,
          nodeId: node.id,
        });
      }
    }

    // 检测循环依赖
    if (this.hasCycle(pipeline)) {
      errors.push({
        type: ValidationErrorType.CYCLE_DETECTED,
        message: '流水线存在循环依赖',
      });
    }
  }

  /**
   * 验证配置
   */
  private validateConfigurations(
    pipeline: PipelineDefinition,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): void {
    // 验证参数定义
    if (pipeline.parameters) {
      const paramNames = new Set<string>();
      for (const param of pipeline.parameters) {
        if (!param.name) {
          errors.push({
            type: ValidationErrorType.MISSING_REQUIRED_FIELD,
            message: '参数名称不能为空',
            path: `parameters[?].name`,
          });
          continue;
        }

        if (paramNames.has(param.name)) {
          errors.push({
            type: ValidationErrorType.INVALID_FIELD_VALUE,
            message: `参数名称 ${param.name} 重复`,
            path: `parameters[${param.name}].name`,
          });
        }
        paramNames.add(param.name);

        // 验证参数类型
        const validTypes = ['string', 'number', 'boolean', 'object', 'array'];
        if (!validTypes.includes(param.type)) {
          errors.push({
            type: ValidationErrorType.INVALID_FIELD_VALUE,
            message: `参数类型 ${param.type} 无效`,
            path: `parameters[${param.name}].type`,
          });
        }
      }
    }

    // 验证触发器配置
    if (pipeline.triggers) {
      for (const trigger of pipeline.triggers) {
        if (!trigger.id) {
          errors.push({
            type: ValidationErrorType.MISSING_REQUIRED_FIELD,
            message: '触发器 ID 不能为空',
            path: `triggers[?].id`,
          });
        }

        const validTypes = ['webhook', 'schedule', 'manual', 'event'];
        if (!validTypes.includes(trigger.type)) {
          errors.push({
            type: ValidationErrorType.INVALID_FIELD_VALUE,
            message: `触发器类型 ${trigger.type} 无效`,
            path: `triggers[${trigger.id}].type`,
          });
        }
      }
    }
  }

  /**
   * 检测循环依赖（简单版本）
   */
  private hasCycle(pipeline: PipelineDefinition): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = pipeline.nodes.find(n => n.id === nodeId);
      if (!node || !node.dependsOn) {
        recStack.delete(nodeId);
        return false;
      }

      for (const depId of node.dependsOn) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recStack.has(depId)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of pipeline.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }

    return false;
  }

  /**
   * 快速检查（仅检查明显的错误）
   */
  quickCheck(pipeline: PipelineDefinition): boolean {
    if (!pipeline.id || !pipeline.name) return false;
    if (!pipeline.nodes || pipeline.nodes.length === 0) return false;
    if (!pipeline.entryNodeId) return false;

    const nodeIds = new Set(pipeline.nodes.map(n => n.id));
    if (!nodeIds.has(pipeline.entryNodeId)) return false;

    for (const node of pipeline.nodes) {
      if (!node.id || !node.name) return false;
      if (!Object.values(NodeType).includes(node.type)) return false;

      if (node.dependsOn) {
        for (const depId of node.dependsOn) {
          if (!nodeIds.has(depId)) return false;
        }
      }
    }

    return true;
  }
}
