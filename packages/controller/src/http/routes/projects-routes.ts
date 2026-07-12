import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ProjectRegistry } from '../../services/project-registry';
import type { ManifestManager } from '../../services/manifest-manager';
import { sendSuccess, sendFailure } from '../types/api-response';
import { 
  checkGitInstalled, 
  isGitRepository, 
  getGitRepoInfo,
  cloneRepository,
  validateRemoteUrl,
  extractRepoName,
  type GitRepoInfo,
} from '@clawkit/shared';

// 添加项目请求 Schema
const AddProjectSchema = z.object({
  key: z.string().min(1, '项目 key 不能为空'),
  mode: z.enum(['local', 'remote']),
  // 本地模式字段
  path: z.string().optional(),
  // 远程模式字段
  remoteUrl: z.string().optional(),
  cloneDir: z.string().optional(),
  // 通用字段
  baseBranch: z.string().default('main'),
  autoExecute: z.boolean().default(false),
  dangerousOps: z.array(z.string()).default([]),
  openCodePort: z.number().int().min(1).max(65535).default(4096),
});

// 更新项目请求 Schema
const UpdateProjectSchema = z.object({
  path: z.string().optional(),
  baseBranch: z.string().optional(),
  autoExecute: z.boolean().optional(),
  dangerousOps: z.array(z.string()).optional(),
  openCodePort: z.number().int().min(1).max(65535).optional(),
});

export function buildProjectsRoutes(
  projectRegistry: ProjectRegistry,
  manifestManager: ManifestManager | null
): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    // 获取所有项目列表
    app.get('/', async (_request, reply) => {
      const projects = projectRegistry.getAllProjects();
      sendSuccess(reply, {
        code: 'controller.projects.fetched',
        message: '项目列表查询成功',
        data: {
          projects: projects.map(p => ({
            key: p.projectKey,
            path: p.repoPath,
            baseBranch: p.branchBase,
            autoExecute: false,
            dangerousOps: [],
            openCodePort: p.openCode.port ?? 4096,
            // 运行时统计暂时返回空值，后续可以从任务系统获取
            totalTasks: 0,
            runningTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
          })),
          total: projects.length,
        },
      });
    });

    // 检查 git 环境
    app.get('/git/check', async (_request, reply) => {
      const installed = checkGitInstalled();
      sendSuccess(reply, {
        code: 'controller.projects.git.checked',
        message: installed ? 'Git 已安装' : 'Git 未安装',
        data: { installed },
      });
    });

    // 获取 git 仓库信息
    app.post<{ Body: { path: string } }>('/git/info', async (request, reply) => {
      const { path } = request.body;

      if (!path) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.projects.git.path_required',
          message: '路径不能为空',
          details: null,
        });
      }

      try {
        if (!isGitRepository(path)) {
          return sendFailure(reply, {
            statusCode: 400,
            code: 'controller.projects.git.not_repo',
            message: '路径不是有效的 git 仓库',
            details: null,
          });
        }

        const info = getGitRepoInfo(path);
        sendSuccess(reply, {
          code: 'controller.projects.git.info_fetched',
          message: 'Git 信息获取成功',
          data: info,
        });
      } catch (error) {
        return sendFailure(reply, {
          statusCode: 500,
          code: 'controller.projects.git.info_failed',
          message: error instanceof Error ? error.message : '获取 git 信息失败',
          details: null,
        });
      }
    });

    // 验证远程仓库 URL
    app.post<{ Body: { remoteUrl: string } }>('/git/validate', async (request, reply) => {
      const { remoteUrl } = request.body;

      if (!remoteUrl) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.projects.git.url_required',
          message: '远程仓库 URL 不能为空',
          details: null,
        });
      }

      try {
        const valid = validateRemoteUrl(remoteUrl);
        sendSuccess(reply, {
          code: 'controller.projects.git.validated',
          message: valid ? '远程仓库有效' : '远程仓库无效或无法访问',
          data: { valid },
        });
      } catch (error) {
        return sendFailure(reply, {
          statusCode: 500,
          code: 'controller.projects.git.validate_failed',
          message: error instanceof Error ? error.message : '验证远程仓库失败',
          details: null,
        });
      }
    });

    // 添加项目
    app.post<{ Body: z.infer<typeof AddProjectSchema> }>('/', async (request, reply) => {
      if (!manifestManager) {
        return sendFailure(reply, {
          statusCode: 503,
          code: 'controller.projects.manifest_unavailable',
          message: '项目管理功能不可用（未配置 manifest）',
          details: null,
        });
      }

      // 验证请求体
      const parseResult = AddProjectSchema.safeParse(request.body);
      if (!parseResult.success) {
        return sendFailure(reply, {
          statusCode: 400,
          code: 'controller.projects.invalid_request',
          message: '请求参数错误',
          details: { errors: parseResult.error.issues },
        });
      }

      const data = parseResult.data;

      try {
        let finalPath: string;

        if (data.mode === 'local') {
          // 本地模式：验证路径
          if (!data.path) {
            return sendFailure(reply, {
              statusCode: 400,
              code: 'controller.projects.path_required',
              message: '本地模式需要提供项目路径',
              details: null,
            });
          }

          if (!isGitRepository(data.path)) {
            return sendFailure(reply, {
              statusCode: 400,
              code: 'controller.projects.not_git_repo',
              message: '路径不是有效的 git 仓库',
              details: null,
            });
          }

          finalPath = data.path;
        } else {
          // 远程模式：克隆仓库
          if (!data.remoteUrl) {
            return sendFailure(reply, {
              statusCode: 400,
              code: 'controller.projects.remote_url_required',
              message: '远程模式需要提供仓库 URL',
              details: null,
            });
          }

          if (!data.cloneDir) {
            return sendFailure(reply, {
              statusCode: 400,
              code: 'controller.projects.clone_dir_required',
              message: '远程模式需要提供克隆目标目录',
              details: null,
            });
          }

          // 克隆仓库
          cloneRepository({
            remoteUrl: data.remoteUrl,
            targetDir: data.cloneDir,
            branch: data.baseBranch !== 'main' ? data.baseBranch : undefined,
          });

          finalPath = data.cloneDir;
        }

        // 添加到 manifest
        manifestManager.addProject({
          key: data.key,
          path: finalPath,
          baseBranch: data.baseBranch,
          autoExecute: data.autoExecute,
          dangerousOps: data.dangerousOps,
          openCodePort: data.openCodePort,
        });

        // 重新加载 ProjectRegistry
        if (projectRegistry.manifestPath) {
          projectRegistry.reload(projectRegistry.manifestPath);
        }

        sendSuccess(reply, {
          code: 'controller.projects.created',
          message: '项目添加成功',
          data: { key: data.key, path: finalPath },
        });
      } catch (error) {
        return sendFailure(reply, {
          statusCode: 500,
          code: 'controller.projects.create_failed',
          message: error instanceof Error ? error.message : '添加项目失败',
          details: null,
        });
      }
    });

    // 更新项目
    app.put<{ Params: { key: string }; Body: z.infer<typeof UpdateProjectSchema> }>(
      '/:key',
      async (request, reply) => {
        if (!manifestManager) {
          return sendFailure(reply, {
            statusCode: 503,
            code: 'controller.projects.manifest_unavailable',
            message: '项目管理功能不可用（未配置 manifest）',
            details: null,
          });
        }

        const { key } = request.params;

        // 验证请求体
        const parseResult = UpdateProjectSchema.safeParse(request.body);
        if (!parseResult.success) {
          return sendFailure(reply, {
            statusCode: 400,
            code: 'controller.projects.invalid_request',
            message: '请求参数错误',
            details: { errors: parseResult.error.issues },
          });
        }

        const updates = parseResult.data;

        try {
          // 如果更新了路径，验证是否是 git 仓库
          if (updates.path && !isGitRepository(updates.path)) {
            return sendFailure(reply, {
              statusCode: 400,
              code: 'controller.projects.not_git_repo',
              message: '路径不是有效的 git 仓库',
              details: null,
            });
          }

          // 更新 manifest
          manifestManager.updateProject(key, updates);

          // 重新加载 ProjectRegistry
          if (projectRegistry.manifestPath) {
            projectRegistry.reload(projectRegistry.manifestPath);
          }

          sendSuccess(reply, {
            code: 'controller.projects.updated',
            message: '项目更新成功',
            data: { key },
          });
        } catch (error) {
          return sendFailure(reply, {
            statusCode: 500,
            code: 'controller.projects.update_failed',
            message: error instanceof Error ? error.message : '更新项目失败',
            details: null,
          });
        }
      }
    );

    // 删除项目
    app.delete<{ Params: { key: string } }>('/:key', async (request, reply) => {
      if (!manifestManager) {
        return sendFailure(reply, {
          statusCode: 503,
          code: 'controller.projects.manifest_unavailable',
          message: '项目管理功能不可用（未配置 manifest）',
          details: null,
        });
      }

      const { key } = request.params;

      try {
        // 删除 manifest 中的项目
        manifestManager.deleteProject(key);

        // 重新加载 ProjectRegistry
        if (projectRegistry.manifestPath) {
          projectRegistry.reload(projectRegistry.manifestPath);
        }

        sendSuccess(reply, {
          code: 'controller.projects.deleted',
          message: '项目删除成功',
          data: { key },
        });
      } catch (error) {
        return sendFailure(reply, {
          statusCode: 500,
          code: 'controller.projects.delete_failed',
          message: error instanceof Error ? error.message : '删除项目失败',
          details: null,
        });
      }
    });
  };
}
