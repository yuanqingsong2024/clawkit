import type { TaskExecutionContext, TaskExecutionParseStatus, TaskExecutionResult } from '@clawkit/shared';

export interface NormalizeExecutionResultInput {
  context: TaskExecutionContext;
  workerId: string;
  rawOutput: string;
  logs: string[];
  sessionId?: string;
  failed?: boolean;
}

export class ExecutionResultNormalizer {
  normalize(input: NormalizeExecutionResultInput): TaskExecutionResult {
    const sections = this.extractSections(input.rawOutput);
    const changedFiles = this.toList(sections.get('改动文件列表'));
    const commands = this.toList(sections.get('执行命令'));
    const risks = this.toList(sections.get('风险与待确认项'));
    const completionChecklist = this.toList(sections.get('完成清单'));
    const testLines = this.toList(sections.get('测试结果'));
    const summary = completionChecklist[0] ?? this.fallbackSummary(input.context.intent, input.failed ?? false);
    const parseStatus: TaskExecutionParseStatus = sections.size > 0 ? 'structured' : 'text_only';

    return {
      taskId: input.context.taskId,
      workerId: input.workerId,
      projectKey: input.context.projectKey,
      status: input.failed ? 'failed' : 'done',
      summary,
      placeholderExecution: false,
      logs: input.logs,
      changedFiles,
      commands,
      testResult: testLines.join('；') || '未提供测试结果',
      rawOutputSummary: input.rawOutput.trim(),
      parseStatus,
      sessionId: input.sessionId,
      risks,
      updatedAt: new Date().toISOString(),
    };
  }

  private fallbackSummary(intent: string, failed: boolean): string {
    return failed ? `任务执行失败：${intent}` : `任务执行完成：${intent}`;
  }

  private extractSections(rawOutput: string): Map<string, string[]> {
    const sections = new Map<string, string[]>();
    const lines = rawOutput.split(/\r?\n/);
    let currentSection: string | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      const sectionMatch = line.match(/^#+\s*(完成清单|改动文件列表|执行命令|测试结果|风险与待确认项)$/);

      if (sectionMatch) {
        currentSection = sectionMatch[1];
        sections.set(currentSection, []);
        continue;
      }

      if (currentSection === null || line.length === 0) {
        continue;
      }

      sections.get(currentSection)?.push(line);
    }

    return sections;
  }

  private toList(lines: string[] | undefined): string[] {
    if (!lines) {
      return [];
    }

    return lines
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }
}
