import { TaskStatus } from '@clawkit/shared';

import type { TaskStatusSnapshot } from '../../services/controller-flow-service';
import type { OpenClawWebhookResponseData } from './openclaw-response';

interface ResultFormatterContext {
  requestId: string;
  sessionKey?: string;
  dispatchErrorMessage?: string;
}

export class ResultResponseFormatter {
  format(statusSnapshot: TaskStatusSnapshot, context: ResultFormatterContext): OpenClawWebhookResponseData {
    const latestSummary = this.buildLatestSummary(statusSnapshot, context.dispatchErrorMessage);
    const suggestedReplies = this.buildSuggestedReplies(statusSnapshot.taskId, statusSnapshot.status);

    return {
      taskId: statusSnapshot.taskId,
      projectKey: statusSnapshot.projectKey,
      status: statusSnapshot.status,
      userMessage: this.buildUserMessage(statusSnapshot, context.dispatchErrorMessage),
      suggestedReplies,
      latestSummary,
      latestDraftSummary: statusSnapshot.latestPromptDraftSummary,
      executionSummary: statusSnapshot.executionSummary,
      dispatchInfo: statusSnapshot.dispatchInfo,
      workerInfo: statusSnapshot.workerInfo,
      metadata: {
        source: 'openclaw',
        requestId: context.requestId,
        sessionKey: context.sessionKey,
        phase: this.resolvePhase(statusSnapshot.status),
      },
    };
  }

  private buildUserMessage(statusSnapshot: TaskStatusSnapshot, dispatchErrorMessage?: string): string {
    const lines: string[] = [];

    switch (statusSnapshot.status) {
      case TaskStatus.APPROVED:
        lines.push(dispatchErrorMessage
          ? `草稿已确认，但暂时无法开始执行：${dispatchErrorMessage}`
          : '草稿已确认，等待进入执行链路。');
        break;
      case TaskStatus.DISPATCHED:
        lines.push('草稿已确认，开始执行。任务已派发给 worker。');
        break;
      case TaskStatus.RUNNING:
        lines.push('任务正在执行中，请稍后查询状态。');
        break;
      case TaskStatus.DONE:
        lines.push('任务执行完成。');
        break;
      case TaskStatus.FAILED:
        lines.push('任务执行失败。');
        break;
      case TaskStatus.CANCELLED:
        lines.push('任务已取消。');
        break;
      default:
        lines.push(`任务当前状态：${statusSnapshot.status}`);
        break;
    }

    if (statusSnapshot.dispatchInfo) {
      lines.push(`派发：${statusSnapshot.dispatchInfo.workerId} / ${statusSnapshot.dispatchInfo.dispatchStatus}`);
    }

    if (statusSnapshot.workerInfo) {
      lines.push(`执行节点：${statusSnapshot.workerInfo.name}（${statusSnapshot.workerInfo.status}）`);
    }

    if (statusSnapshot.executionSummary?.summary) {
      lines.push(`摘要：${statusSnapshot.executionSummary.summary}`);
    } else if (statusSnapshot.readableSummary.summary) {
      lines.push(`摘要：${statusSnapshot.readableSummary.summary}`);
    }

    if (statusSnapshot.executionSummary?.testResult) {
      lines.push(`测试：${statusSnapshot.executionSummary.testResult}`);
    }

    if (statusSnapshot.status === TaskStatus.FAILED) {
      lines.push(`建议下一步：${statusSnapshot.executionSummary?.nextStageHint ?? '先检查 OpenCode 服务、worker 状态和任务仓库路径，再重新发起任务。'}`);
    }

    return lines.join('\n');
  }

  private buildLatestSummary(statusSnapshot: TaskStatusSnapshot, dispatchErrorMessage?: string): string {
    if (statusSnapshot.executionSummary?.summary) {
      return statusSnapshot.executionSummary.summary;
    }

    if (dispatchErrorMessage) {
      return dispatchErrorMessage;
    }

    return statusSnapshot.readableSummary.summary;
  }

  private buildSuggestedReplies(taskId: string, status: TaskStatus): string[] {
    if (status === TaskStatus.FAILED) {
      return [`#任务状态 ${taskId}`];
    }

    if (status === TaskStatus.CANCELLED || status === TaskStatus.DONE) {
      return [`#任务状态 ${taskId}`];
    }

    return [`#任务状态 ${taskId}`, `#取消任务 ${taskId}`];
  }

  private resolvePhase(status: TaskStatus): OpenClawWebhookResponseData['metadata']['phase'] {
    switch (status) {
      case TaskStatus.APPROVED:
        return 'approved';
      case TaskStatus.DISPATCHED:
        return 'dispatched';
      case TaskStatus.RUNNING:
        return 'running';
      case TaskStatus.DONE:
        return 'done';
      case TaskStatus.FAILED:
        return 'failed';
      case TaskStatus.CANCELLED:
        return 'cancelled';
      default:
        return 'draft';
    }
  }
}
