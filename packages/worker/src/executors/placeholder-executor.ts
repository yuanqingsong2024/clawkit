import type { TaskExecutionContext, TaskExecutionResult, TaskExecutor } from '@clawkit/shared';

/**
 * 占位执行器
 * 用于开发和测试场景，不执行真实任务
 */
export class PlaceholderExecutor implements TaskExecutor {
  /** 执行器名称 */
  readonly name = 'placeholder';

  constructor(private readonly workerId = 'worker-unknown') {}

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    console.log(`[占位执行器] 开始执行任务 ${context.taskId}`);
    console.log(`[占位执行器] 项目: ${context.projectKey}`);
    console.log(`[占位执行器] 意图: ${context.intent}`);

    await this.simulateExecution();

    const logs = [
      `[${new Date().toISOString()}] 任务开始执行`,
      `[${new Date().toISOString()}] 项目: ${context.projectKey}`,
      `[${new Date().toISOString()}] 意图: ${context.intent}`,
      `[${new Date().toISOString()}] 约束条件: ${context.constraints.join(', ')}`,
      `[${new Date().toISOString()}] 验收标准: ${context.acceptanceCriteria.join(', ')}`,
      `[${new Date().toISOString()}] 占位执行完成`,
    ];

    const result: TaskExecutionResult = {
      taskId: context.taskId,
      workerId: this.workerId,
      projectKey: context.projectKey,
      status: 'done',
      summary: `占位执行完成：${context.intent}`,
      placeholderExecution: true,
      logs,
      changedFiles: [],
      commands: [],
      testResult: '未执行真实测试',
      rawOutputSummary: '当前为占位执行，未调用真实执行器',
      parseStatus: 'text_only',
      risks: ['当前为占位执行，未进行真实代码修改'],
      nextStageHint: '下一阶段将接入真实执行器',
      updatedAt: new Date().toISOString(),
    };

    console.log(`[占位执行器] 任务 ${context.taskId} 执行完成`);
    return result;
  }

  private async simulateExecution(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  }
}
