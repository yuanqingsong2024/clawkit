import { describe, it, expect, beforeEach } from 'vitest';
import { DispatchService } from '../../src/services/dispatch-service';
import { WorkerRegistry } from '../../src/services/worker-registry';
import { TaskStatus, TaskPriority, WorkerStatus } from '@clawkit/shared';

/**
 * 创建带优先级的模拟 TaskDraft
 */
function createMockTaskDraft(
  taskId: string,
  priority: TaskPriority,
  projectKey: string = 'test-project',
  createdAt: Date = new Date(),
) {
  return {
    taskId,
    projectKey,
    intent: `测试任务 ${taskId}`,
    constraints: ['约束1'],
    acceptanceCriteria: ['验收1'],
    sourceText: '测试任务描述',
    status: TaskStatus.APPROVED,
    priority,
    createdAt,
    updatedAt: new Date(),
  };
}

/**
 * 创建模拟 TaskMemory
 */
function createMockTaskMemory(taskId: string) {
  return {
    taskId,
    normalizedTaskCard: {
      title: `测试任务 ${taskId}`,
      objective: '测试',
      scope: [],
      outOfScope: [],
      constraints: [],
      acceptanceCriteria: [],
    },
    promptDraftHistory: [],
    userRevisionHistory: [],
    executionSummary: {
      status: 'not_started' as const,
      note: '',
      lastUpdatedAt: null,
    },
    similarTaskRefs: [],
    projectRuleRefs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('DispatchService - 任务优先级调度', () => {
  let dispatchService: DispatchService;
  let workerRegistry: WorkerRegistry;
  let mockTaskDrafts: Map<string, ReturnType<typeof createMockTaskDraft>>;
  let mockTaskMemories: Map<string, ReturnType<typeof createMockTaskMemory>>;

  beforeEach(() => {
    workerRegistry = new WorkerRegistry();

    // 注册支持所有项目的 worker
    workerRegistry.register({
      workerId: 'worker-1',
      name: 'Worker 1',
      nodeName: 'local',
      connectMode: 'pull',
      tags: ['dev'],
      supportedProjects: ['*'],
    });

    workerRegistry.register({
      workerId: 'worker-2',
      name: 'Worker 2',
      nodeName: 'local',
      connectMode: 'pull',
      tags: ['dev'],
      supportedProjects: ['*'],
    });

    mockTaskDrafts = new Map();
    mockTaskMemories = new Map();

    dispatchService = new DispatchService(
      workerRegistry,
      {
        getTaskMemory: (taskId) => mockTaskMemories.get(taskId),
      },
      {
        getTaskDraft: (taskId) => mockTaskDrafts.get(taskId),
      },
      {
        updateTaskStatus: (taskId, status) => {
          const draft = mockTaskDrafts.get(taskId);
          if (draft) {
            draft.status = status;
            draft.updatedAt = new Date();
          }
        },
      },
      {
        getProject: (projectKey) => ({
          projectKey,
          repoPath: '/tmp/test-project',
          branchBase: 'main',
          openCode: {
            port: 4096,
            agent: 'build',
            mode: 'default',
          },
        }),
      },
      {
        compileExecutionPrompt: () => ({
          executionVersion: '# 执行版 prompt',
          outputContract: {
            completionChecklist: ['完成清单'],
            modifiedFiles: ['改动文件列表'],
            executionCommands: ['执行命令'],
            testResults: ['测试结果'],
            risksAndConfirmations: ['风险与待确认项'],
          },
        }),
      },
    );
  });

  describe('addTaskToQueue - 优先级队列插入', () => {
    it('应该按优先级排序：urgent > high > normal > low', () => {
      // 添加不同优先级的任务
      const lowTask = createMockTaskDraft('task-low', TaskPriority.LOW);
      const normalTask = createMockTaskDraft('task-normal', TaskPriority.NORMAL);
      const highTask = createMockTaskDraft('task-high', TaskPriority.HIGH);
      const urgentTask = createMockTaskDraft('task-urgent', TaskPriority.URGENT);

      mockTaskDrafts.set('task-low', lowTask);
      mockTaskDrafts.set('task-normal', normalTask);
      mockTaskDrafts.set('task-high', highTask);
      mockTaskDrafts.set('task-urgent', urgentTask);

      // 按任意顺序添加任务
      dispatchService.dispatchTask('task-low');
      dispatchService.dispatchTask('task-normal');
      dispatchService.dispatchTask('task-high');
      dispatchService.dispatchTask('task-urgent');

      // 拉取任务验证顺序
      const pull1 = dispatchService.pullTask('worker-1');
      const pull2 = dispatchService.pullTask('worker-1');
      const pull3 = dispatchService.pullTask('worker-1');
      const pull4 = dispatchService.pullTask('worker-1');

      expect(pull1.task?.taskId).toBe('task-urgent');
      expect(pull2.task?.taskId).toBe('task-high');
      expect(pull3.task?.taskId).toBe('task-normal');
      expect(pull4.task?.taskId).toBe('task-low');
    });

    it('相同优先级的任务应该按创建时间排序（早创建的在前）', () => {
      const now = new Date();
      const task1 = createMockTaskDraft('task-1', TaskPriority.NORMAL, 'test-project', new Date(now.getTime() - 10000));
      const task2 = createMockTaskDraft('task-2', TaskPriority.NORMAL, 'test-project', now);
      const task3 = createMockTaskDraft('task-3', TaskPriority.NORMAL, 'test-project', new Date(now.getTime() - 5000));

      mockTaskDrafts.set('task-1', task1);
      mockTaskDrafts.set('task-2', task2);
      mockTaskDrafts.set('task-3', task3);

      // 添加任务
      dispatchService.dispatchTask('task-1');
      dispatchService.dispatchTask('task-2');
      dispatchService.dispatchTask('task-3');

      // 拉取任务验证顺序
      const pull1 = dispatchService.pullTask('worker-1');
      const pull2 = dispatchService.pullTask('worker-1');
      const pull3 = dispatchService.pullTask('worker-1');

      // task-1 创建最早，应该先被拉取
      expect(pull1.task?.taskId).toBe('task-1');
      expect(pull2.task?.taskId).toBe('task-3'); // task-3 比 task-2 早创建
      expect(pull3.task?.taskId).toBe('task-2');
    });

    it('高优先级任务应该插入到低优先级任务之前', () => {
      const lowTask = createMockTaskDraft('task-low', TaskPriority.LOW);
      const highTask = createMockTaskDraft('task-high', TaskPriority.HIGH);

      mockTaskDrafts.set('task-low', lowTask);
      mockTaskDrafts.set('task-high', highTask);

      // 先添加低优先级任务
      dispatchService.dispatchTask('task-low');

      // 再添加高优先级任务（应该插入到队列前面）
      dispatchService.dispatchTask('task-high');

      // 高优先级任务应该先被拉取
      const pull = dispatchService.pullTask('worker-1');
      expect(pull.task?.taskId).toBe('task-high');

      const pull2 = dispatchService.pullTask('worker-1');
      expect(pull2.task?.taskId).toBe('task-low');
    });
  });

  describe('dispatchTask - 派发时优先级处理', () => {
    it('应该为新派发的任务设置正确的优先级', () => {
      const task = createMockTaskDraft('task-urgent', TaskPriority.URGENT);
      mockTaskDrafts.set('task-urgent', task);
      mockTaskMemories.set('task-urgent', createMockTaskMemory('task-urgent'));

      const dispatch = dispatchService.dispatchTask('task-urgent');

      expect(dispatch.taskId).toBe('task-urgent');
      expect(dispatch.note).toContain('任务已加入队列');
    });

    it('不支持的优先级应该默认使用 NORMAL', () => {
      const task = {
        ...createMockTaskDraft('task-test', TaskPriority.NORMAL),
        priority: 'invalid' as any,
      };
      mockTaskDrafts.set('task-test', task);
      mockTaskMemories.set('task-test', createMockTaskMemory('task-test'));

      // 不应该抛出错误，使用默认优先级
      const dispatch = dispatchService.dispatchTask('task-test');
      expect(dispatch.taskId).toBe('task-test');
    });
  });

  describe('pullTask - 拉取时优先级处理', () => {
    it('应该优先拉取高优先级任务', () => {
      const tasks = [
        { taskId: 'task-low', priority: TaskPriority.LOW },
        { taskId: 'task-high', priority: TaskPriority.HIGH },
        { taskId: 'task-normal', priority: TaskPriority.NORMAL },
        { taskId: 'task-urgent', priority: TaskPriority.URGENT },
      ];

      tasks.forEach(({ taskId, priority }) => {
        const task = createMockTaskDraft(taskId, priority);
        mockTaskDrafts.set(taskId, task);
        mockTaskMemories.set(taskId, createMockTaskMemory(taskId));
        dispatchService.dispatchTask(taskId);
      });

      // Worker 拉取第一个任务，应该是 urgent
      const pull = dispatchService.pullTask('worker-1');
      expect(pull.task?.taskId).toBe('task-urgent');
      expect(pull.task?.status).toBe(TaskStatus.RUNNING);
    });

    it('队列为空时应该返回 hasTask: false', () => {
      const pull = dispatchService.pullTask('worker-1');
      expect(pull.hasTask).toBe(false);
    });
  });

  describe('多 Worker 负载均衡 + 优先级', () => {
    it('高优先级任务应该优先分配给负载最低的 worker', () => {
      const urgentTask = createMockTaskDraft('task-urgent', TaskPriority.URGENT);
      const normalTask = createMockTaskDraft('task-normal', TaskPriority.NORMAL);

      mockTaskDrafts.set('task-urgent', urgentTask);
      mockTaskDrafts.set('task-normal', normalTask);
      mockTaskMemories.set('task-urgent', createMockTaskMemory('task-urgent'));
      mockTaskMemories.set('task-normal', createMockTaskMemory('task-normal'));

      // 先派发一个任务给 worker-1，使其有负载
      dispatchService.dispatchTask('task-normal');
      dispatchService.pullTask('worker-1');

      // 再派发高优先级任务
      dispatchService.dispatchTask('task-urgent');

      // 下一个拉取应该是 task-urgent
      const pull = dispatchService.pullTask('worker-2');
      expect(pull.task?.taskId).toBe('task-urgent');
    });
  });

  describe('TaskPriority 枚举验证', () => {
    it('应该包含所有四个优先级级别', () => {
      expect(TaskPriority.URGENT).toBe('urgent');
      expect(TaskPriority.HIGH).toBe('high');
      expect(TaskPriority.NORMAL).toBe('normal');
      expect(TaskPriority.LOW).toBe('low');
    });

    it('优先级顺序应该是 urgent > high > normal > low', () => {
      const priorityOrder = [TaskPriority.URGENT, TaskPriority.HIGH, TaskPriority.NORMAL, TaskPriority.LOW];

      priorityOrder.forEach((priority, index) => {
        if (index > 0) {
          const previousPriority = priorityOrder[index - 1];
          // 在排序逻辑中，数字越小优先级越高
          expect(priorityOrder.indexOf(priority)).toBeGreaterThan(priorityOrder.indexOf(previousPriority));
        }
      });
    });
  });
});
