/**
 * Pipeline 验证器测试
 */

import { describe, it, expect } from 'vitest';
import { PipelineValidator } from '../src/services/pipeline-validator';
import { PipelineDefinition, PipelineNodeConfig, NodeType } from '../src/types/pipeline.types';

describe('PipelineValidator', () => {
  const validator = new PipelineValidator();

  describe('validate', () => {
    it('应通过有效流水线', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
            config: { prompt: '构建项目' },
          },
          {
            id: 'test',
            name: '测试',
            type: NodeType.TASK,
            dependsOn: ['build'],
            executor: 'opencode',
            config: { prompt: '运行测试' },
          },
        ],
        entryNodeId: 'build',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应拒绝没有节点的流水线', () => {
      const pipeline = {
        id: 'empty-pipeline',
        name: '空流水线',
        version: 1,
        nodes: [],
        entryNodeId: 'build',
      } as PipelineDefinition;

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应拒绝没有入口节点的流水线', () => {
      const pipeline: PipelineDefinition = {
        id: 'no-entry-pipeline',
        name: '无入口流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('入口节点'))).toBe(true);
    });

    it('应检测不存在的依赖', () => {
      const pipeline: PipelineDefinition = {
        id: 'invalid-dep-pipeline',
        name: '无效依赖流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
          {
            id: 'test',
            name: '测试',
            type: NodeType.TASK,
            dependsOn: ['nonexistent'],
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('不存在'))).toBe(true);
    });

    it('应验证条件节点的条件表达式', () => {
      const pipeline: PipelineDefinition = {
        id: 'condition-pipeline',
        name: '条件流水线',
        version: 1,
        nodes: [
          {
            id: 'check',
            name: '检查',
            type: NodeType.CONDITION,
            condition: 'result.success == true',
            trueBranch: ['deploy'],
          },
          {
            id: 'deploy',
            name: '部署',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'check',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(true);
    });

    it('应拒绝没有条件表达式的条件节点', () => {
      const pipeline: PipelineDefinition = {
        id: 'no-condition-pipeline',
        name: '无条件流水线',
        version: 1,
        nodes: [
          {
            id: 'check',
            name: '检查',
            type: NodeType.CONDITION,
          },
        ],
        entryNodeId: 'check',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('条件表达式'))).toBe(true);
    });

    it('应检测重复的节点 ID', () => {
      const pipeline: PipelineDefinition = {
        id: 'duplicate-id-pipeline',
        name: '重复ID流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建1',
            type: NodeType.TASK,
            executor: 'opencode',
          },
          {
            id: 'build',
            name: '构建2',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('重复'))).toBe(true);
    });

    it('应验证超时配置', () => {
      const pipeline: PipelineDefinition = {
        id: 'timeout-pipeline',
        name: '超时流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
            timeout: -1, // 无效的超时
          },
        ],
        entryNodeId: 'build',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('超时'))).toBe(true);
    });

    it('应验证重试配置', () => {
      const pipeline: PipelineDefinition = {
        id: 'retry-pipeline',
        name: '重试流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
            retries: -5, // 无效的重试次数
          },
        ],
        entryNodeId: 'build',
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('重试'))).toBe(true);
    });
  });

  describe('quickCheck', () => {
    it('应快速检查通过有效流水线', () => {
      const pipeline: PipelineDefinition = {
        id: 'test-pipeline',
        name: '测试流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
      };

      expect(validator.quickCheck(pipeline)).toBe(true);
    });

    it('应快速检查拒绝无效流水线', () => {
      const pipeline: PipelineDefinition = {
        id: '',
        name: '测试流水线',
        version: 1,
        nodes: [],
        entryNodeId: 'build',
      };

      expect(validator.quickCheck(pipeline)).toBe(false);
    });
  });

  describe('触发器验证', () => {
    it('应验证有效的触发器类型', () => {
      const pipeline: PipelineDefinition = {
        id: 'trigger-pipeline',
        name: '触发器流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
        triggers: [
          { id: 'webhook-1', type: 'webhook', config: {} },
          { id: 'schedule-1', type: 'schedule', config: { cron: '0 * * * *' } },
          { id: 'manual-1', type: 'manual', config: {} },
        ],
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(true);
    });

    it('应拒绝无效的触发器类型', () => {
      const pipeline: PipelineDefinition = {
        id: 'invalid-trigger-pipeline',
        name: '无效触发器流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
        triggers: [
          { id: 'invalid-1', type: 'invalid-type' as any, config: {} },
        ],
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('触发器类型'))).toBe(true);
    });
  });

  describe('参数验证', () => {
    it('应验证有效的参数定义', () => {
      const pipeline: PipelineDefinition = {
        id: 'param-pipeline',
        name: '参数流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
        parameters: [
          { name: 'env', type: 'string', required: true },
          { name: 'timeout', type: 'number', required: false },
        ],
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(true);
    });

    it('应拒绝重复的参数名称', () => {
      const pipeline: PipelineDefinition = {
        id: 'duplicate-param-pipeline',
        name: '重复参数流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
        parameters: [
          { name: 'env', type: 'string' },
          { name: 'env', type: 'string' },
        ],
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('重复'))).toBe(true);
    });

    it('应拒绝无效的参数类型', () => {
      const pipeline: PipelineDefinition = {
        id: 'invalid-param-type-pipeline',
        name: '无效参数类型流水线',
        version: 1,
        nodes: [
          {
            id: 'build',
            name: '构建',
            type: NodeType.TASK,
            executor: 'opencode',
          },
        ],
        entryNodeId: 'build',
        parameters: [
          { name: 'custom', type: 'invalid-type' as any },
        ],
      };

      const result = validator.validate(pipeline);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('参数类型'))).toBe(true);
    });
  });
});
