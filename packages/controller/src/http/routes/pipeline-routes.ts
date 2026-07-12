/**
 * 流水线 API 路由
 * 提供流水线的 CRUD 和执行 API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { PipelineService } from '@clawkit/pipeline';
import type { PipelineDefinition, PipelineExecution } from '@clawkit/pipeline';

export function createPipelineRoutes(pipelineService: PipelineService) {
  return async function (app: FastifyInstance): Promise<void> {

    // ========== 流水线管理 ==========

    /**
     * 获取所有流水线
     */
    app.get('/', async (_req: FastifyRequest, reply: FastifyReply) => {
      try {
        const pipelines = await pipelineService.list();
        return reply.send({
          success: true,
          data: pipelines,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '获取流水线列表失败',
        });
      }
    });

    /**
     * 获取单个流水线
     */
    app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const pipeline = await pipelineService.get(req.params.id);
        if (!pipeline) {
          return reply.status(404).send({
            success: false,
            error: `流水线不存在: ${req.params.id}`,
          });
        }
        return reply.send({
          success: true,
          data: pipeline,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '获取流水线失败',
        });
      }
    });

    /**
     * 创建流水线
     */
    app.post('/', async (req: FastifyRequest<{
      Body: {
        name?: string;
        description?: string;
        nodes?: PipelineDefinition['nodes'];
        variables?: Record<string, unknown>;
      };
    }>, reply: FastifyReply) => {
      try {
        const { name, description, nodes, variables } = req.body || {};
        
        if (!name || !nodes) {
          return reply.status(400).send({
            success: false,
            error: '缺少必填参数: name, nodes',
          });
        }

        const pipeline = await pipelineService.create({
          name,
          description,
          nodes,
          version: '1.0.0',
          projectKey: 'default',
          executionMode: 'dag',
          variables,
        });

        return reply.status(201).send({
          success: true,
          data: pipeline,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : '创建流水线失败',
        });
      }
    });

    /**
     * 更新流水线
     */
    app.put('/:id', async (req: FastifyRequest<{
      Params: { id: string };
      Body: Partial<PipelineDefinition>;
    }>, reply: FastifyReply) => {
      try {
        const pipeline = await pipelineService.update(req.params.id, req.body);
        return reply.send({
          success: true,
          data: pipeline,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : '更新流水线失败',
        });
      }
    });

    /**
     * 删除流水线
     */
    app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const deleted = await pipelineService.delete(req.params.id);
        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: `流水线不存在: ${req.params.id}`,
          });
        }
        return reply.send({
          success: true,
          message: '流水线已删除',
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '删除流水线失败',
        });
      }
    });

    /**
     * 验证流水线
     */
    app.post('/validate', async (req: FastifyRequest<{ Body: PipelineDefinition }>, reply: FastifyReply) => {
      try {
        const validation = pipelineService.validate(req.body);
        return reply.send({
          success: true,
          data: validation,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : '验证流水线失败',
        });
      }
    });

    // ========== 流水线执行 ==========

    /**
     * 执行流水线
     */
    app.post('/:id/execute', async (req: FastifyRequest<{
      Params: { id: string };
      Body: { trigger?: PipelineExecution['trigger']; variables?: Record<string, unknown> };
    }>, reply: FastifyReply) => {
      try {
        const { trigger, variables } = req.body || {};
        const execution = await pipelineService.execute(req.params.id, trigger, variables);
        return reply.status(201).send({
          success: true,
          data: execution,
        });
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: error instanceof Error ? error.message : '执行流水线失败',
        });
      }
    });

    /**
     * 取消执行
     */
    app.post('/:pipelineId/cancel/:executionId', async (req: FastifyRequest<{
      Params: { pipelineId: string; executionId: string };
    }>, reply: FastifyReply) => {
      try {
        const cancelled = await pipelineService.cancelExecution(req.params.executionId);
        if (!cancelled) {
          return reply.status(404).send({
            success: false,
            error: `执行不存在或无法取消: ${req.params.executionId}`,
          });
        }
        return reply.send({
          success: true,
          message: '执行已取消',
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '取消执行失败',
        });
      }
    });

    /**
     * 获取执行记录
     */
    app.get('/:pipelineId/executions', async (req: FastifyRequest<{ Params: { pipelineId: string } }>, reply: FastifyReply) => {
      try {
        const executions = await pipelineService.getExecutionHistory(req.params.pipelineId);
        return reply.send({
          success: true,
          data: executions,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '获取执行历史失败',
        });
      }
    });

    /**
     * 获取执行详情
     */
    app.get('/:pipelineId/executions/:executionId', async (req: FastifyRequest<{
      Params: { pipelineId: string; executionId: string };
    }>, reply: FastifyReply) => {
      try {
        const execution = await pipelineService.getExecution(req.params.executionId);
        if (!execution) {
          return reply.status(404).send({
            success: false,
            error: `执行不存在: ${req.params.executionId}`,
          });
        }
        return reply.send({
          success: true,
          data: execution,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '获取执行详情失败',
        });
      }
    });

    // ========== 统计 ==========

    /**
     * 获取统计信息
     */
    app.get('/:pipelineId/stats', async (req: FastifyRequest<{ Params: { pipelineId: string } }>, reply: FastifyReply) => {
      try {
        const stats = await pipelineService.getStats(req.params.pipelineId);
        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : '获取统计信息失败',
        });
      }
    });
  };
}
