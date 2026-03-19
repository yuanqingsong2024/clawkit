import * as fs from 'fs';
import * as yaml from 'yaml';
import {
  ManifestSchema,
  formatValidationIssue,
  StepType,
} from '@clawkit/shared';
import type {
  Manifest,
  ExecutionPlan,
  ExecutionStep,
} from '@clawkit/shared';

interface PlanAction {
  category: string;
  description: string;
  node: string;
  implemented: boolean;
}

export interface DryRunPlan {
  name: string;
  topology: string;
  nodes: Array<{ name: string; type: string; host?: string }>;
  roles: Array<{ role: string; node: string }>;
  configs: string[];
  dependencies: string[];
  actions: PlanAction[];
  placeholders: string[];
  executionPlan: ExecutionPlan;
}

export class PlanServiceImpl {
  /**
   * 从文件读取并校验 manifest
   * @param filePath manifest 文件路径
   * @returns 校验后的 manifest，校验失败时返回错误信息列表
   */
  loadManifest(filePath: string): { manifest?: Manifest; errors?: string[] } {
    if (!fs.existsSync(filePath)) {
      return { errors: [`配置文件不存在：${filePath}`] };
    }

    let raw: unknown;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      raw = yaml.parse(content);
    } catch (error) {
      return { errors: [`YAML 解析失败：${(error as Error).message}`] };
    }

    const result = ManifestSchema.safeParse(raw);
    if (!result.success) {
      const errors = result.error.issues.map(
        (issue) => `字段 [${issue.path.join('.')}]: ${formatValidationIssue(issue)}`,
      );
      return { errors };
    }

    return { manifest: result.data };
  }

  /**
   * 根据 manifest 生成 dry-run 计划
   */
  generateDryRunPlan(manifest: Manifest, manifestPath: string): DryRunPlan {
    const nodes = this.collectNodes(manifest);
    const roles = this.collectRoles(manifest);
    const configs = this.collectConfigs(manifest);
    const dependencies = this.collectDependencies(manifest);
    const actions = this.collectActions(manifest);
    const placeholders = this.collectPlaceholders();
    const executionPlan = this.buildExecutionPlan(manifest, manifestPath);

    return {
      name: manifest.profile.name,
      topology: manifest.profile.topology,
      nodes,
      roles,
      configs,
      dependencies,
      actions,
      placeholders,
      executionPlan,
    };
  }

  /**
   * 收集所有涉及的节点
   */
  private collectNodes(manifest: Manifest): Array<{ name: string; type: string; host?: string }> {
    return Object.entries(manifest.nodes).map(([name, node]) => ({
      name,
      type: node.type,
      host: node.type === 'ssh' ? node.host : undefined,
    }));
  }

  /**
   * 收集将要部署的角色
   */
  private collectRoles(manifest: Manifest): Array<{ role: string; node: string }> {
    const roles: Array<{ role: string; node: string }> = [];

    // Controller
    roles.push({
      role: 'Controller',
      node: manifest.services.controller.node,
    });

    // OpenClaw
    roles.push({
      role: 'OpenClaw',
      node: manifest.services.openClaw.node,
    });

    // Workers
    for (const worker of manifest.workers) {
      roles.push({
        role: `Worker [${worker.id}]`,
        node: worker.node,
      });

      // Worker 下的 OpenCode 实例
      for (const project of worker.projects) {
        roles.push({
          role: `OpenCode [${project.key}]`,
          node: worker.node,
        });
      }
    }

    return roles;
  }

  /**
   * 收集将要生成的配置文件列表
   */
  private collectConfigs(manifest: Manifest): string[] {
    const configs: string[] = [
      'openclaw.json — OpenClaw 运行配置',
      'controller.env — Controller 环境变量',
      'systemd/clawkit-controller.service — Controller systemd 文件',
      'scripts/start-controller.sh — Controller 启动脚本',
    ];

    for (const worker of manifest.workers) {
      configs.push(`worker-${worker.id}.env — Worker ${worker.id} 环境变量`);
      configs.push(`systemd/clawkit-worker-${worker.id}.service — Worker ${worker.id} systemd 文件`);
      configs.push(`scripts/start-worker-${worker.id}.sh — Worker ${worker.id} 启动脚本`);

      for (const project of worker.projects) {
        configs.push(`opencode-${project.key}.launch.yaml — OpenCode ${project.key} 启动配置`);
      }
    }

    return configs;
  }

  /**
   * 收集将要检查的依赖
   */
  private collectDependencies(manifest: Manifest): string[] {
    const deps: string[] = [
      `Node.js >= 20.0.0`,
      'pnpm >= 8.0.0',
    ];

    // 根据 runtime 配置添加依赖检查
    if (manifest.runtime.memory.enabled) {
      if (manifest.runtime.memory.provider === 'redis') {
        deps.push('Redis 服务可用');
      } else if (manifest.runtime.memory.provider === 'postgres') {
        deps.push('PostgreSQL 服务可用');
      }
    }

    // SSH 节点需要 SSH 客户端
    const hasSshNodes = Object.values(manifest.nodes).some((n) => n.type === 'ssh');
    if (hasSshNodes) {
      deps.push('SSH 客户端可用');
      deps.push('SSH 目标节点可达');
    }

    if (manifest.runtime.promptEngine.mode === 'template') {
      deps.push('PromptEngine 使用内置 template 模式（无需额外 API Key）');
    } else if (manifest.runtime.promptEngine.provider !== 'custom') {
      deps.push(`${manifest.runtime.promptEngine.provider} API Key 已配置（环境变量: ${manifest.runtime.promptEngine.apiKeyEnv}）`);
    }

    return deps;
  }

  /**
   * 收集执行动作
   */
  private collectActions(manifest: Manifest): PlanAction[] {
    const actions: PlanAction[] = [];

    // 1. 检查节点连通性
    for (const [name, node] of Object.entries(manifest.nodes)) {
      if (node.type === 'ssh') {
        actions.push({
          category: '节点检查',
          description: `检查 SSH 节点 ${name} 的连通性 (${node.host}:${node.port})`,
          node: name,
          implemented: false,
        });
      } else {
        actions.push({
          category: '节点检查',
          description: `检查本地节点 ${name} 的工作目录`,
          node: name,
          implemented: true,
        });
      }
    }

    // 2. 创建工作目录
    for (const [name, node] of Object.entries(manifest.nodes)) {
      const workDir = node.type === 'ssh' ? node.workDir : (node.workDir || '.');
      actions.push({
        category: '目录准备',
        description: `在节点 ${name} 创建工作目录 ${workDir}`,
        node: name,
        implemented: true,
      });
    }

    // 3. 生成配置文件
    actions.push({
      category: '配置生成',
      description: '生成 openclaw.json',
      node: manifest.services.openClaw.node,
      implemented: true,
    });

    actions.push({
      category: '配置生成',
      description: '生成 controller.env',
      node: manifest.services.controller.node,
      implemented: true,
    });

    for (const worker of manifest.workers) {
      actions.push({
        category: '配置生成',
        description: `生成 worker-${worker.id}.env`,
        node: worker.node,
        implemented: true,
      });

      for (const project of worker.projects) {
        actions.push({
          category: '配置生成',
          description: `生成 opencode-${project.key}.launch.yaml`,
          node: worker.node,
          implemented: true,
        });
      }
    }

    // 4. 部署服务
    actions.push({
      category: '服务部署',
      description: `部署 Controller 到节点 ${manifest.services.controller.node}（端口 ${manifest.services.controller.port}）`,
      node: manifest.services.controller.node,
      implemented: false,
    });

    for (const worker of manifest.workers) {
      actions.push({
        category: '服务部署',
        description: `部署 Worker ${worker.id} 到节点 ${worker.node}`,
        node: worker.node,
        implemented: false,
      });
    }

    // 5. 健康检查
    actions.push({
      category: '健康检查',
      description: '执行部署后健康检查',
      node: '*',
      implemented: false,
    });

    return actions;
  }

  /**
   * 收集当前阶段的占位能力
   */
  private collectPlaceholders(): string[] {
    return [
      '真实 SSH 连接与远程命令执行',
      '服务的自动启动与停止',
      'Systemd service 的自动安装与 enable',
      '健康检查的真实执行',
      '部署回滚',
      'Notify 通知发送',
    ];
  }

  /**
   * 构建兼容 shared 接口的执行计划
   */
  private buildExecutionPlan(manifest: Manifest, manifestPath: string): ExecutionPlan {
    const steps: ExecutionStep[] = [];
    let stepIndex = 1;

    // 检查节点
    for (const name of Object.keys(manifest.nodes)) {
      steps.push({
        id: `step-${stepIndex++}`,
        type: StepType.HEALTH_CHECK,
        description: `检查节点 ${name} 可用性`,
        node: name,
        params: {},
        required: true,
      });
    }

    // 创建目录
    for (const [name, node] of Object.entries(manifest.nodes)) {
      const workDir = node.type === 'ssh' ? node.workDir : (node.workDir || '.');
      steps.push({
        id: `step-${stepIndex++}`,
        type: StepType.CREATE_DIR,
        description: `创建工作目录 ${workDir}`,
        node: name,
        params: { path: workDir },
        required: true,
      });
    }

    // 生成配置文件
    steps.push({
      id: `step-${stepIndex++}`,
      type: StepType.COPY_FILE,
      description: '生成 openclaw.json',
      node: manifest.services.openClaw.node,
      params: { target: 'openclaw.json' },
      required: true,
    });

    steps.push({
      id: `step-${stepIndex++}`,
      type: StepType.COPY_FILE,
      description: '生成 controller.env',
      node: manifest.services.controller.node,
      params: { target: 'controller.env' },
      required: true,
    });

    for (const worker of manifest.workers) {
      steps.push({
        id: `step-${stepIndex++}`,
        type: StepType.COPY_FILE,
        description: `生成 worker-${worker.id}.env`,
        node: worker.node,
        params: { target: `worker-${worker.id}.env` },
        required: true,
      });
    }

    // 启动服务
    steps.push({
      id: `step-${stepIndex++}`,
      type: StepType.START_SERVICE,
      description: '启动 Controller',
      node: manifest.services.controller.node,
      params: { service: 'controller' },
      required: true,
    });

    for (const worker of manifest.workers) {
      steps.push({
        id: `step-${stepIndex++}`,
        type: StepType.START_SERVICE,
        description: `启动 Worker ${worker.id}`,
        node: worker.node,
        params: { service: `worker-${worker.id}` },
        required: true,
      });
    }

    // 健康检查
    steps.push({
      id: `step-${stepIndex++}`,
      type: StepType.HEALTH_CHECK,
      description: '执行部署后健康检查',
      node: manifest.services.controller.node,
      params: {},
      required: false,
    });

    return {
      id: `plan-${Date.now()}`,
      name: manifest.profile.name,
      createdAt: new Date(),
      manifestPath,
      steps,
      estimatedDuration: this.estimateDuration(steps),
    };
  }

  /**
   * 估算执行时间
   */
  private estimateDuration(steps: ExecutionStep[]): number {
    // 简单估算：每步 15 秒
    return steps.length * 15;
  }
}
