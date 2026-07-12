/**
 * DAG 引擎单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DAGExecutionEngine, createDAGExecutionEngine } from '../src/engine/dag-engine';
import type { PipelineDefinition, PipelineExecution } from '../src/types/pipeline.types';

describe('DAGExecutionEngine', () => {
  let engine: DAGExecutionEngine;

  beforeEach(() => {
    engine = createDAGExecutionEngine();
  });

  describe('validatePipeline', () => {
    it('应该验证有效的流水线', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          {
            id: 'node-1',
            name: '节点1',
            type: 'task',
            config: {},
          },
          {
            id: 'node-2',
            name: '节点2',
            type: 'task',
            config: {},
            dependsOn: ['node-1'],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测循环依赖', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          {
            id: 'node-1',
            name: '节点1',
            type: 'task',
            config: {},
            dependsOn: ['node-2'],
          },
          {
            id: 'node-2',
            name: '节点2',
            type: 'task',
            config: {},
            dependsOn: ['node-1'],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('循环依赖'))).toBe(true);
    });

    it('应该检测缺失的依赖节点', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          {
            id: 'node-1',
            name: '节点1',
            type: 'task',
            config: {},
            dependsOn: ['nonexistent'],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('不存在'))).toBe(true);
    });

    it('应该检测重复的节点 ID', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          {
            id: 'node-1',
            name: '节点1',
            type: 'task',
            config: {},
          },
          {
            id: 'node-1',
            name: '节点1重复',
            type: 'task',
            config: {},
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('重复'))).toBe(true);
    });

    it('应该检测自循环依赖', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          {
            id: 'node-1',
            name: '节点1',
            type: 'task',
            config: {},
            dependsOn: ['node-1'],
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('依赖于自身'))).toBe(true);
    });

    it('应该警告孤立节点', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          {
            id: 'node-1',
            name: '节点1',
            type: 'task',
            config: {},
          },
          {
            id: 'node-2',
            name: '节点2',
            type: 'task',
            config: {},
            dependsOn: ['node-1'],
          },
          {
            id: 'isolated',
            name: '孤立节点',
            type: 'task',
            config: {},
          },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.includes('孤立'))).toBe(true);
    });

    it('应该缺少节点时报错', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const result = engine.validatePipeline(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('至少需要一个节点'))).toBe(true);
    });
  });

  describe('buildDAGGraph', () => {
    it('应该正确构建 DAG 图', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          { id: 'a', name: 'A', type: 'task', config: {} },
          { id: 'b', name: 'B', type: 'task', config: {}, dependsOn: ['a'] },
          { id: 'c', name: 'C', type: 'task', config: {}, dependsOn: ['a'] },
          { id: 'd', name: 'D', type: 'task', config: {}, dependsOn: ['b', 'c'] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const graph = engine.buildDAGGraph(pipeline);

      expect(graph.nodes.size).toBe(4);
      expect(graph.topologicalOrder).toBeDefined();
      expect(graph.levels.get('a')).toBe(1);
      expect(graph.levels.get('b')).toBe(2);
      expect(graph.levels.get('c')).toBe(2);
      expect(graph.levels.get('d')).toBe(3);
    });

    it('应该正确处理并行分支', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          { id: 'start', name: 'Start', type: 'task', config: {} },
          { id: 'branch1', name: 'Branch1', type: 'task', config: {}, dependsOn: ['start'] },
          { id: 'branch2', name: 'Branch2', type: 'task', config: {}, dependsOn: ['start'] },
          { id: 'branch3', name: 'Branch3', type: 'task', config: {}, dependsOn: ['start'] },
          { id: 'end', name: 'End', type: 'task', config: {}, dependsOn: ['branch1', 'branch2', 'branch3'] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const graph = engine.buildDAGGraph(pipeline);

      // 同一层级的节点应该有相同的 level
      expect(graph.levels.get('branch1')).toBe(graph.levels.get('branch2'));
      expect(graph.levels.get('branch2')).toBe(graph.levels.get('branch3'));
    });
  });

  describe('execute', () => {
    it('应该顺序执行简单流水线', async () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          { id: 'node-1', name: '节点1', type: 'task', config: {} },
          { id: 'node-2', name: '节点2', type: 'task', config: {}, dependsOn: ['node-1'] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const execution: PipelineExecution = {
        id: 'exec-1',
        pipelineId: 'test-pipeline',
        pipelineVersion: '1.0.0',
        status: 'running',
        nodeResults: new Map(),
        context: {
          executionId: 'exec-1',
          variables: {},
          nodeOutputs: new Map(),
          history: [],
        },
      };

      const executedOrder: string[] = [];
      engine.setNodeExecutor(async (req) => {
        executedOrder.push(req.nodeId);
        return {
          success: true,
          nodeId: req.nodeId,
          result: { done: true },
          startTime: Date.now(),
          endTime: Date.now(),
        };
      });

      const result = await engine.execute(pipeline, execution);

      expect(result.status).toBe('completed');
      expect(executedOrder).toEqual(['node-1', 'node-2']);
    });

    it('应该并行执行无依赖的节点', async () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          { id: 'parallel-1', name: 'Parallel1', type: 'task', config: {} },
          { id: 'parallel-2', name: 'Parallel2', type: 'task', config: {} },
          { id: 'parallel-3', name: 'Parallel3', type: 'task', config: {} },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const execution: PipelineExecution = {
        id: 'exec-1',
        pipelineId: 'test-pipeline',
        pipelineVersion: '1.0.0',
        status: 'running',
        nodeResults: new Map(),
        context: {
          executionId: 'exec-1',
          variables: {},
          nodeOutputs: new Map(),
          history: [],
        },
      };

      const executionTimes: number[] = [];
      const startTime = Date.now();

      engine.setNodeExecutor(async (req) => {
        const delay = 50 + Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, delay));
        executionTimes.push(Date.now() - startTime);
        return {
          success: true,
          nodeId: req.nodeId,
          result: { done: true },
          startTime: Date.now(),
          endTime: Date.now(),
        };
      });

      const result = await engine.execute(pipeline, execution);

      expect(result.status).toBe('completed');
      // 所有并行节点应该在相近的时间完成（最大时间差小于单个节点执行时间）
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      expect(maxTime - minTime).toBeLessThan(100);
    });

    it('节点失败应该导致流水线失败', async () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          { id: 'node-1', name: '节点1', type: 'task', config: {} },
          { id: 'node-2', name: '节点2', type: 'task', config: {}, dependsOn: ['node-1'] },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const execution: PipelineExecution = {
        id: 'exec-1',
        pipelineId: 'test-pipeline',
        pipelineVersion: '1.0.0',
        status: 'running',
        nodeResults: new Map(),
        context: {
          executionId: 'exec-1',
          variables: {},
          nodeOutputs: new Map(),
          history: [],
        },
      };

      engine.setNodeExecutor(async (req) => {
        if (req.nodeId === 'node-1') {
          return {
            success: false,
            nodeId: req.nodeId,
            error: '节点1执行失败',
            startTime: Date.now(),
            endTime: Date.now(),
          };
        }
        return {
          success: true,
          nodeId: req.nodeId,
          result: { done: true },
          startTime: Date.now(),
          endTime: Date.now(),
        };
      });

      const result = await engine.execute(pipeline, execution);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('失败');
    });

    it('应该触发正确的事件', async () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: '1.0.0',
        projectKey: 'test',
        executionMode: 'dag',
        nodes: [
          { id: 'node-1', name: '节点1', type: 'task', config: {} },
        ],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const execution: PipelineExecution = {
        id: 'exec-1',
        pipelineId: 'test-pipeline',
        pipelineVersion: '1.0.0',
        status: 'running',
        nodeResults: new Map(),
        context: {
          executionId: 'exec-1',
          variables: {},
          nodeOutputs: new Map(),
          history: [],
        },
      };

      const events: string[] = [];
      engine.addEventListener('pipeline:started', () => events.push('pipeline:started'));
      engine.addEventListener('pipeline:node:started', () => events.push('pipeline:node:started'));
      engine.addEventListener('pipeline:node:completed', () => events.push('pipeline:node:completed'));
      engine.addEventListener('pipeline:completed', () => events.push('pipeline:completed'));

      await engine.execute(pipeline, execution);

      expect(events).toContain('pipeline:started');
      expect(events).toContain('pipeline:node:started');
      expect(events).toContain('pipeline:node:completed');
      expect(events).toContain('pipeline:completed');
    });
  });
});
