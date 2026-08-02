/**
 * 节点执行器
 * 负责执行不同类型的流水线节点
 */

import {
  PipelineNodeConfig,
  NodeType,
  NodeStatus,
  NodeExecutionResult,
  NodeExecutionContext,
} from '../types/pipeline.types';

/**
 * 执行器接口
 */
export interface Executor {
  /** 执行类型 */
  type: string;
  /** 执行节点 */
  execute(context: NodeExecutionContext): Promise<NodeExecutionResult>;
}

/**
 * 内置执行器注册表
 */
const executorRegistry: Map<string, Executor> = new Map();

/**
 * 注册执行器
 */
export function registerExecutor(executor: Executor): void {
  executorRegistry.set(executor.type, executor);
}

/**
 * 获取执行器
 */
export function getExecutor(type: string): Executor | undefined {
  return executorRegistry.get(type);
}

/**
 * 节点执行器
 */
export class NodeExecutor {
  private executors: Map<string, Executor> = new Map();
  private pluginManager?: unknown;

  constructor(pluginManager?: unknown) {
    this.pluginManager = pluginManager;
    this.registerBuiltinExecutors();
  }

  /**
   * 注册内置执行器
   */
  private registerBuiltinExecutors(): void {
    // 任务执行器
    this.executors.set('task', {
      type: 'task',
      execute: this.executeTask.bind(this),
    });

    // 条件执行器
    this.executors.set('condition', {
      type: 'condition',
      execute: this.executeCondition.bind(this),
    });

    // 并行执行器
    this.executors.set('parallel', {
      type: 'parallel',
      execute: this.executeParallel.bind(this),
    });

    // 串行执行器
    this.executors.set('sequence', {
      type: 'sequence',
      execute: this.executeSequence.bind(this),
    });

    // 触发器执行器
    this.executors.set('trigger', {
      type: 'trigger',
      execute: this.executeTrigger.bind(this),
    });

    // 结束执行器
    this.executors.set('end', {
      type: 'end',
      execute: this.executeEnd.bind(this),
    });
  }

  /**
   * 注册自定义执行器
   */
  registerCustomExecutor(type: string, executor: Executor): void {
    this.executors.set(type, executor);
  }

  /**
   * 执行节点
   */
  async execute(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node } = context;

    // 获取执行器
    let executor = this.executors.get(node.type);
    
    // 如果没有内置执行器，尝试从插件管理器获取
    if (!executor && this.pluginManager) {
      executor = await this.getPluginExecutor(node.executor || node.type);
    }

    if (!executor) {
      return {
        nodeId: node.id,
        status: NodeStatus.FAILED,
        startTime: Date.now(),
        endTime: Date.now(),
        retryCount: 0,
        error: `未找到执行器: ${node.type}`,
      };
    }

    try {
      return await executor.execute(context);
    } catch (error) {
      return {
        nodeId: node.id,
        status: NodeStatus.FAILED,
        startTime: Date.now(),
        endTime: Date.now(),
        retryCount: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 从插件管理器获取执行器
   */
  private async getPluginExecutor(executorType: string): Promise<Executor | undefined> {
    if (!this.pluginManager) return undefined;

    // 尝试获取插件执行器
    // 这里简化处理，实际可以从 pluginManager 获取
    return undefined;
  }

  /**
   * 执行任务节点
   */
  private async executeTask(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node, upstreamResults } = context;
    const startTime = Date.now();

    // 收集上游节点的输出
    const upstreamOutputs: Record<string, unknown> = {};
    for (const [nodeId, result] of upstreamResults) {
      if (result.output) {
        upstreamOutputs[nodeId] = result.output;
      }
    }

    // 如果配置了执行器，执行自定义任务
    if (node.executor && node.executorConfig) {
      return await this.executeCustomTask(node, upstreamOutputs, startTime);
    }

    // 默认任务执行（模拟）
    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        message: `任务 ${node.name} 执行完成`,
        upstreamOutputs,
      },
      retryCount: 0,
    };
  }

  /**
   * 执行自定义任务
   */
  private async executeCustomTask(
    node: PipelineNodeConfig,
    upstreamOutputs: Record<string, unknown>,
    startTime: number
  ): Promise<NodeExecutionResult> {
    const executorType = node.executor || 'default';

    try {
      // 根据执行器类型执行
      switch (executorType) {
        case 'shell':
          return await this.executeShellTask(node, upstreamOutputs, startTime);
        
        case 'script':
          return await this.executeScriptTask(node, upstreamOutputs, startTime);
        
        case 'opencode':
          return await this.executeOpenCodeTask(node, upstreamOutputs, startTime);
        
        default:
          return {
            nodeId: node.id,
            status: NodeStatus.SUCCESS,
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            output: {
              executor: executorType,
              config: node.executorConfig,
              upstreamOutputs,
            },
            retryCount: 0,
          };
      }
    } catch (error) {
      return {
        nodeId: node.id,
        status: NodeStatus.FAILED,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        retryCount: 0,
      };
    }
  }

  /**
   * 执行 Shell 任务
   */
  private async executeShellTask(
    node: PipelineNodeConfig,
    upstreamOutputs: Record<string, unknown>,
    startTime: number
  ): Promise<NodeExecutionResult> {
    const config = node.executorConfig || {};
    const command = typeof config.command === 'string' ? config.command : '';

    // 简单的命令执行（实际应该使用 child_process）
    console.log(`[NodeExecutor] 执行 Shell 命令: ${command}`);

    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        command,
        exitCode: 0,
        stdout: '命令执行成功',
        stderr: '',
      },
      retryCount: 0,
    };
  }

  /**
   * 执行脚本任务
   */
  private async executeScriptTask(
    node: PipelineNodeConfig,
    upstreamOutputs: Record<string, unknown>,
    startTime: number
  ): Promise<NodeExecutionResult> {
    const config = node.executorConfig || {};
    const script = typeof config.script === 'string' ? config.script : '';
    const interpreter = (config.interpreter as string) || 'node';

    console.log(`[NodeExecutor] 执行脚本 (${interpreter}): ${script.substring(0, 50)}...`);

    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        script,
        interpreter,
        result: '脚本执行成功',
      },
      retryCount: 0,
    };
  }

  /**
   * 执行 OpenCode 任务
   */
  private async executeOpenCodeTask(
    node: PipelineNodeConfig,
    upstreamOutputs: Record<string, unknown>,
    startTime: number
  ): Promise<NodeExecutionResult> {
    const config = node.executorConfig || {};
    const prompt = typeof config.prompt === 'string' ? config.prompt : '';

    console.log(`[NodeExecutor] 执行 OpenCode 任务: ${prompt.substring(0, 50)}...`);

    // 这里应该调用 OpenCode API
    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        prompt,
        result: 'OpenCode 任务执行成功',
      },
      retryCount: 0,
    };
  }

  /**
   * 执行条件节点
   */
  private async executeCondition(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node, upstreamResults } = context;
    const startTime = Date.now();

    // 收集上游节点的输出
    const upstreamOutputs: Record<string, unknown> = {};
    for (const [nodeId, result] of upstreamResults) {
      if (result.output) {
        upstreamOutputs[nodeId] = result.output;
      }
    }

    // 计算条件
    const condition = node.condition || 'true';
    const result = this.evaluateCondition(condition, upstreamOutputs);

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        condition,
        evaluated: result,
        trueBranch: node.trueBranch || [],
        falseBranch: node.falseBranch || [],
      },
      retryCount: 0,
    };
  }

  /**
   * 评估条件表达式
   */
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      // 简单条件评估（支持基本的比较和逻辑运算）
      // 实际应该使用安全的表达式求值器
      const safeContext: Record<string, unknown> = {};
      
      // 提取顶层属性
      for (const [key, value] of Object.entries(context)) {
        if (typeof value === 'object' && value !== null) {
          safeContext[key] = value;
        }
      }

      // 使用 Function 构造（仅用于演示，实际应使用安全的表达式解析器）
      const func = new Function('context', `
        with (context) {
          return !!(${condition});
        }
      `);

      return func(safeContext);
    } catch {
      console.warn(`[NodeExecutor] 条件评估失败: ${condition}`);
      return false;
    }
  }

  /**
   * 执行并行节点
   */
  private async executeParallel(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node, upstreamResults } = context;
    const startTime = Date.now();

    // 收集子节点配置
    const childNodes = node.executorConfig?.children as PipelineNodeConfig[] || [];
    const parallelCount = node.parallelCount || childNodes.length;

    console.log(`[NodeExecutor] 执行并行节点 ${node.name}，子节点数: ${parallelCount}`);

    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        parallelCount,
        childrenCount: childNodes.length,
      },
      retryCount: 0,
    };
  }

  /**
   * 执行串行节点
   */
  private async executeSequence(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node, upstreamResults } = context;
    const startTime = Date.now();

    // 收集子节点配置
    const childNodes = node.executorConfig?.children as PipelineNodeConfig[] || [];

    console.log(`[NodeExecutor] 执行串行节点 ${node.name}，子节点数: ${childNodes.length}`);

    // 模拟执行
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        childrenCount: childNodes.length,
      },
      retryCount: 0,
    };
  }

  /**
   * 执行触发器节点
   */
  private async executeTrigger(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node } = context;
    const startTime = Date.now();

    const triggerConfig = node.trigger || { type: 'manual', config: {} };

    console.log(`[NodeExecutor] 执行触发器节点 ${node.name}，类型: ${triggerConfig.type}`);

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        triggerType: triggerConfig.type,
        triggered: true,
      },
      retryCount: 0,
    };
  }

  /**
   * 执行结束节点
   */
  private async executeEnd(context: NodeExecutionContext): Promise<NodeExecutionResult> {
    const { node } = context;
    const startTime = Date.now();

    console.log(`[NodeExecutor] 执行结束节点 ${node.name}`);

    return {
      nodeId: node.id,
      status: NodeStatus.SUCCESS,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      output: {
        message: '流水线结束',
      },
      retryCount: 0,
    };
  }
}
