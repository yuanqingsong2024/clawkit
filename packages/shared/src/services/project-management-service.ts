/**
 * 项目管理服务
 * 管理多项目配置和任务隔离
 */

import { createLogger } from '../logger';
import type { SimpleProject } from '../schema/manifest-simple';

const logger = createLogger('ProjectManagementService');

/**
 * 项目运行时信息
 */
export interface ProjectRuntimeInfo {
  key: string;
  path: string;
  baseBranch: string;
  autoExecute: boolean;
  dangerousOps: string[];
  openCodePort: number;
  
  // 运行时统计
  totalTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  lastTaskTime?: Date;
}

/**
 * 项目管理服务
 */
export class ProjectManagementService {
  private projects: Map<string, SimpleProject> = new Map();
  private taskCounts: Map<string, {
    total: number;
    running: number;
    completed: number;
    failed: number;
    lastTaskTime?: Date;
  }> = new Map();

  /**
   * 注册项目
   */
  registerProject(project: SimpleProject): void {
    this.projects.set(project.key, project);
    
    // 初始化任务计数
    if (!this.taskCounts.has(project.key)) {
      this.taskCounts.set(project.key, {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
      });
    }

    logger.info(`注册项目: ${project.key}`, {
      path: project.path,
      autoExecute: project.autoExecute,
    });
  }

  /**
   * 批量注册项目
   */
  registerProjects(projects: SimpleProject[]): void {
    projects.forEach((project) => this.registerProject(project));
  }

  /**
   * 获取项目配置
   */
  getProject(key: string): SimpleProject | undefined {
    return this.projects.get(key);
  }

  /**
   * 获取所有项目
   */
  getAllProjects(): SimpleProject[] {
    return Array.from(this.projects.values());
  }

  /**
   * 检查项目是否存在
   */
  hasProject(key: string): boolean {
    return this.projects.has(key);
  }

  /**
   * 获取项目运行时信息
   */
  getProjectRuntimeInfo(key: string): ProjectRuntimeInfo | undefined {
    const project = this.projects.get(key);
    if (!project) {
      return undefined;
    }

    const counts = this.taskCounts.get(key) || {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    return {
      ...project,
      totalTasks: counts.total,
      runningTasks: counts.running,
      completedTasks: counts.completed,
      failedTasks: counts.failed,
      lastTaskTime: counts.lastTaskTime,
    };
  }

  /**
   * 获取所有项目运行时信息
   */
  getAllProjectRuntimeInfo(): ProjectRuntimeInfo[] {
    return Array.from(this.projects.keys())
      .map((key) => this.getProjectRuntimeInfo(key))
      .filter((info): info is ProjectRuntimeInfo => info !== undefined);
  }

  /**
   * 记录任务创建
   */
  recordTaskCreated(projectKey: string): void {
    const counts = this.taskCounts.get(projectKey);
    if (counts) {
      counts.total++;
      counts.running++;
      counts.lastTaskTime = new Date();
    }
  }

  /**
   * 记录任务完成
   */
  recordTaskCompleted(projectKey: string): void {
    const counts = this.taskCounts.get(projectKey);
    if (counts) {
      counts.running--;
      counts.completed++;
    }
  }

  /**
   * 记录任务失败
   */
  recordTaskFailed(projectKey: string): void {
    const counts = this.taskCounts.get(projectKey);
    if (counts) {
      counts.running--;
      counts.failed++;
    }
  }

  /**
   * 重置项目统计
   */
  resetProjectStats(projectKey: string): void {
    this.taskCounts.set(projectKey, {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
    });
  }

  /**
   * 清空所有项目
   */
  clear(): void {
    this.projects.clear();
    this.taskCounts.clear();
  }
}

/**
 * 全局单例
 */
let globalInstance: ProjectManagementService | null = null;

/**
 * 获取全局项目管理服务实例
 */
export function getProjectManagementService(): ProjectManagementService {
  if (!globalInstance) {
    globalInstance = new ProjectManagementService();
  }
  return globalInstance;
}

/**
 * 重置全局实例（用于测试）
 */
export function resetProjectManagementService(): void {
  globalInstance = null;
}
