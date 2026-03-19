import type { PromptDraft } from '../../models/prompt-draft';
import type { TaskDraft } from '../../models/task-draft';
import type { TaskStatusSnapshot } from '../../services/controller-flow-service';
import type { OpenClawWebhookResponseData } from './openclaw-response';

interface DraftFormatterContext {
  requestId: string;
  sessionKey?: string;
}

export class DraftResponseFormatter {
  formatCreated(
    taskDraft: TaskDraft,
    promptDraft: PromptDraft,
    statusSnapshot: TaskStatusSnapshot,
    context: DraftFormatterContext,
  ): OpenClawWebhookResponseData {
    return this.formatDraft('created', taskDraft, promptDraft, statusSnapshot, context);
  }

  formatRevised(
    taskDraft: TaskDraft,
    promptDraft: PromptDraft,
    statusSnapshot: TaskStatusSnapshot,
    context: DraftFormatterContext,
  ): OpenClawWebhookResponseData {
    return this.formatDraft('revised', taskDraft, promptDraft, statusSnapshot, context);
  }

  formatStatus(
    taskDraft: TaskDraft,
    promptDraft: PromptDraft,
    statusSnapshot: TaskStatusSnapshot,
    context: DraftFormatterContext,
  ): OpenClawWebhookResponseData {
    return this.formatDraft('status', taskDraft, promptDraft, statusSnapshot, context);
  }

  private formatDraft(
    mode: 'created' | 'revised' | 'status',
    taskDraft: TaskDraft,
    promptDraft: PromptDraft,
    statusSnapshot: TaskStatusSnapshot,
    context: DraftFormatterContext,
  ): OpenClawWebhookResponseData {
    const summary = promptDraft.summaryView;
    const latestSummary = [
      `目标：${summary.goal}`,
      `范围：${summary.scope.join('；') || '未提供'}`,
      `约束：${summary.constraints.join('；') || '未提供'}`,
      `验收：${summary.acceptanceCriteria.join('；') || '未提供'}`,
    ].join('｜');

    const actionMessage = mode === 'created'
      ? '研发任务已创建，已生成草稿摘要。'
      : mode === 'revised'
        ? '草稿已修改，以下是新的草稿摘要。'
        : '任务当前仍在草稿确认阶段，以下是最新草稿摘要。';

    const userMessage = [
      actionMessage,
      `项目：${taskDraft.projectKey}`,
      `任务：${taskDraft.intent}`,
      `目标：${summary.goal}`,
      `范围：${summary.scope.join('；') || '未提供'}`,
      `约束：${summary.constraints.join('；') || '未提供'}`,
      `验收：${summary.acceptanceCriteria.join('；') || '未提供'}`,
      `确认清单：${summary.confirmationChecklist.join('；') || '未提供'}`,
    ].join('\n');

    return {
      taskId: taskDraft.taskId,
      projectKey: taskDraft.projectKey,
      status: statusSnapshot.status,
      userMessage,
      suggestedReplies: [
        `#确认派发 ${taskDraft.taskId}`,
        `#修改草案 ${taskDraft.taskId}`,
        `#取消任务 ${taskDraft.taskId}`,
        `#任务状态 ${taskDraft.taskId}`,
      ],
      latestSummary,
      latestDraftSummary: promptDraft.summaryView,
      executionSummary: statusSnapshot.executionSummary,
      metadata: {
        source: 'openclaw',
        requestId: context.requestId,
        sessionKey: context.sessionKey,
        phase: 'draft',
      },
    };
  }
}
