import { z } from 'zod';
import { ProfileSchema } from './profile';
import { ControllerSchema } from './controller';
import { NodesSchema } from './node';
import { WorkersSchema } from './worker';
import { PromptEngineSchema } from './prompt-engine';
import { MemorySchema } from './memory';

/**
 * OpenClaw 配置 Schema
 */
export const OpenClawSchema = z.object({
  node: z.string().min(1, 'OpenClaw 节点引用不能为空').describe('OpenClaw 所在节点的引用'),
  publicUrl: z.string().url({ message: 'OpenClaw 对外地址必须是有效的 URL' }).describe('OpenClaw 对外访问地址'),
  apiKey: z.string().optional().describe('OpenClaw API Key（如果需要）'),
  // local：由 clawkit 负责在本地节点部署；external：外部自建/托管；skip：不由 clawkit 负责部署
  deployMode: z.enum(['local', 'external', 'skip']).default('skip').describe('OpenClaw 部署模式'),
});

/**
 * OpenCode Service 配置 Schema
 */
export const OpenCodeServiceSchema = z.object({
  node: z.string().min(1),
  publicUrl: z.string().url().optional(),
  indices: z.array(z.number().int().min(0)).optional(),
  allocation: z.enum(['exclusive', 'shared']).optional(),
  binaryPath: z.string().optional().describe('OpenCode 二进制路径（可选）'),
  workspace: z.string().optional().describe('OpenCode 工作空间路径（可选）'),
  env: z.record(z.string(), z.string()).optional().describe('额外环境变量（可选）'),
  installMode: z
    .enum(['local', 'external', 'skip'])
    .default('skip')
    .describe(
      'OpenCode 安装模式：local 表示由 clawkit 自动通过官方脚本安装并启动 serve，external 表示使用外部已运行的 OpenCode 服务，skip 表示不由 clawkit 负责安装与启动',
    ),
});

export const ServicesSchema = z.object({
  controller: ControllerSchema.describe('Controller 配置'),
  openClaw: OpenClawSchema.describe('OpenClaw 配置'),
  openCode: OpenCodeServiceSchema.optional().describe('OpenCode 配置（可选）'),
});

export const RuntimeSchema = z.object({
  promptEngine: PromptEngineSchema.describe('提示词引擎配置'),
  memory: MemorySchema.describe('记忆配置'),
});

/**
 * Notify 配置 Schema
 */
export const NotifySchema = z.object({
  enabled: z.boolean().default(false).describe('是否启用通知'),
  channels: z.array(z.enum(['email', 'webhook', 'slack'])).default([]).describe('通知渠道'),
  webhook: z.string().url({ message: 'Webhook 地址必须是有效的 URL' }).optional().describe('Webhook URL'),
  email: z.object({
    smtp: z.string().optional(),
    from: z.string().email({ message: '发件人邮箱格式不正确' }).optional(),
    to: z.array(z.string().email({ message: '收件人邮箱格式不正确' })).optional(),
  }).optional().describe('邮件配置'),
}).superRefine((notify, ctx) => {
  if (!notify.enabled) {
    return;
  }

  if (notify.channels.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['channels'],
      message: '启用通知时至少需要配置一个通知渠道',
    });
  }

  if (notify.channels.includes('webhook') && !notify.webhook) {
    ctx.addIssue({
      code: 'custom',
      path: ['webhook'],
      message: '通知渠道包含 webhook 时必须提供 webhook 地址',
    });
  }

  if (notify.channels.includes('email')) {
    if (!notify.email?.smtp) {
      ctx.addIssue({
        code: 'custom',
        path: ['email', 'smtp'],
        message: '通知渠道包含 email 时必须提供 SMTP 服务地址',
      });
    }

    if (!notify.email?.from) {
      ctx.addIssue({
        code: 'custom',
        path: ['email', 'from'],
        message: '通知渠道包含 email 时必须提供发件人邮箱',
      });
    }

    if (!notify.email?.to || notify.email.to.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['email', 'to'],
        message: '通知渠道包含 email 时必须至少提供一个收件人邮箱',
      });
    }
  }
});

/**
 * Deploy 配置 Schema
 */
export const DeploySchema = z.object({
  timeout: z.number().int().min(1).default(300).describe('部署超时时间（秒）'),
  retryCount: z.number().int().min(0).default(3).describe('失败重试次数'),
  healthCheck: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().int().min(1).default(30).describe('健康检查间隔（秒）'),
  }).optional().describe('健康检查配置'),
});

/**
 * Manifest 配置 Schema（主配置）
 */
export const ManifestSchema = z.object({
  profile: ProfileSchema.describe('配置文件元信息'),
  nodes: NodesSchema.describe('节点配置'),
  services: ServicesSchema.describe('服务配置'),
  workers: WorkersSchema.describe('Worker 配置'),
  runtime: RuntimeSchema.describe('运行时配置'),
  notify: NotifySchema.optional().describe('通知配置'),
  deploy: DeploySchema.optional().describe('部署配置'),
}).superRefine((manifest, ctx) => {
  const nodeNames = Object.keys(manifest.nodes);
  const nodeSet = new Set(nodeNames);

  if (nodeNames.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['nodes'],
      message: '至少需要定义一个节点',
    });
  }

  for (const [nodeName, node] of Object.entries(manifest.nodes)) {
    if (node.type === 'ssh' && !node.keyPath && !node.password) {
      ctx.addIssue({
        code: 'custom',
        path: ['nodes', nodeName],
        message: 'SSH 节点至少需要提供 keyPath 或 password 其中之一',
      });
    }
  }

  const checkNodeRef = (nodeRef: string, path: (string | number)[], label: string): void => {
    if (!nodeSet.has(nodeRef)) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `${label}引用了未定义的节点：${nodeRef}`,
      });
    }
  };

  checkNodeRef(manifest.services.controller.node, ['services', 'controller', 'node'], 'Controller');
  checkNodeRef(manifest.services.openClaw.node, ['services', 'openClaw', 'node'], 'OpenClaw');
  if (manifest.services.openCode) {
    checkNodeRef(manifest.services.openCode.node, ['services', 'openCode', 'node'], 'OpenCode');
  }

  const workerIds = new Set<string>();
  const projectKeys = new Set<string>();

  manifest.workers.forEach((worker, workerIndex) => {
    checkNodeRef(worker.node, ['workers', workerIndex, 'node'], `Worker ${worker.id}`);

    if (workerIds.has(worker.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['workers', workerIndex, 'id'],
        message: `Worker ID 重复：${worker.id}`,
      });
    }

    workerIds.add(worker.id);

    worker.projects.forEach((project, projectIndex) => {
      if (projectKeys.has(project.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['workers', workerIndex, 'projects', projectIndex, 'key'],
          message: `项目 key 重复：${project.key}`,
        });
      }

      projectKeys.add(project.key);
    });
  });

  const controllerNode = manifest.services.controller.node;
  const openClawNode = manifest.services.openClaw.node;
  const openCodeNode = manifest.services.openCode?.node;
  const workerNodes = manifest.workers.map((worker) => worker.node);
  const involvedNodeCount = new Set(
    [controllerNode, openClawNode, openCodeNode, ...workerNodes].filter((node): node is string => Boolean(node)),
  ).size;

  // deployMode 为 local 时，明确要求 OpenClaw 运行在本地节点上，避免“本地部署但指向远程节点”的歧义配置
  if (manifest.services.openClaw.deployMode === 'local' && manifest.nodes[openClawNode]?.type !== 'local') {
    ctx.addIssue({
      code: 'custom',
      path: ['services', 'openClaw', 'deployMode'],
      message: 'deployMode 为 local 时，openClaw 必须部署在 local 类型节点上',
    });
  }

  // installMode 为 local 时，明确要求 OpenCode 运行在本地节点上，避免“本地安装但指向远程节点”的歧义配置
  if (
    manifest.services.openCode?.installMode === 'local' &&
    openCodeNode &&
    manifest.nodes[openCodeNode]?.type !== 'local'
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['services', 'openCode', 'installMode'],
      message: 'installMode 为 local 时，openCode 必须部署在 local 类型节点上',
    });
  }

  if (manifest.profile.topology === 'all-in-one' && involvedNodeCount !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['profile', 'topology'],
      message: 'all-in-one 拓扑要求 Controller、OpenClaw 与全部 Worker 位于同一个节点',
    });
  }

  if (manifest.profile.topology === 'hybrid') {
    if (controllerNode !== openClawNode) {
      ctx.addIssue({
        code: 'custom',
        path: ['services', 'openClaw', 'node'],
        message: 'hybrid 拓扑要求 OpenClaw 与 Controller 位于同一个云端节点',
      });
    }

    if (manifest.nodes[controllerNode]?.type !== 'ssh') {
      ctx.addIssue({
        code: 'custom',
        path: ['services', 'controller', 'node'],
        message: 'hybrid 拓扑要求 Controller 部署在 SSH 远程节点上',
      });
    }

    if (involvedNodeCount < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['profile', 'topology'],
        message: 'hybrid 拓扑至少需要一个云端节点和一个本地执行节点',
      });
    }

    if (manifest.workers.some((worker) => manifest.nodes[worker.node]?.type !== 'local')) {
      ctx.addIssue({
        code: 'custom',
        path: ['workers'],
        message: 'hybrid 拓扑要求所有 Worker 部署在本地节点上',
      });
    }
  }

  if (manifest.profile.topology === 'split') {
    if (controllerNode !== openClawNode) {
      ctx.addIssue({
        code: 'custom',
        path: ['services', 'openClaw', 'node'],
        message: 'split 拓扑要求 OpenClaw 与 Controller 位于同一个控制面节点',
      });
    }

    if (involvedNodeCount < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['profile', 'topology'],
        message: 'split 拓扑至少需要一个控制面节点和一个执行节点',
      });
    }

    if (workerNodes.every((workerNode) => workerNode === controllerNode)) {
      ctx.addIssue({
        code: 'custom',
        path: ['workers'],
        message: 'split 拓扑要求至少有一个 Worker 部署在独立于控制面的节点上',
      });
    }
  }
});

export type OpenClaw = z.infer<typeof OpenClawSchema>;
export type Services = z.infer<typeof ServicesSchema>;
export type Runtime = z.infer<typeof RuntimeSchema>;
export type Notify = z.infer<typeof NotifySchema>;
export type Deploy = z.infer<typeof DeploySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
