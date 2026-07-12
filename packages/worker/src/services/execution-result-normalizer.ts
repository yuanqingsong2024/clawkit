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
    const cleanedOutput = this.cleanRawOutput(input.rawOutput);
    const sections = this.extractSections(cleanedOutput);
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
      rawOutputSummary: cleanedOutput,
      parseStatus,
      sessionId: input.sessionId,
      risks,
      updatedAt: new Date().toISOString(),
    };
  }

  private cleanRawOutput(rawOutput: string): string {
    const trimmed = rawOutput.trim();
    if (trimmed.length === 0) {
      return trimmed;
    }

    const lastSummaryBlock = this.extractLastSummaryBlock(trimmed);
    if (lastSummaryBlock !== null) {
      return lastSummaryBlock;
    }

    const preferredMarkers = [
      '好的,我来',
      '好的，我来',
      '## 执行摘要',
      '### 完成清单',
      '# 完成清单',
    ];

    let candidate = trimmed;
    for (const marker of preferredMarkers) {
      const index = candidate.indexOf(marker);
      if (index >= 0) {
        candidate = candidate.slice(index).trim();
        break;
      }
    }

    candidate = this.removeKnownNoise(candidate);
    candidate = this.deduplicateRepeatedTail(candidate);

    return candidate.trim();
  }

  private extractLastSummaryBlock(input: string): string | null {
    const marker = '## 执行摘要';
    const lastIndex = input.lastIndexOf(marker);
    if (lastIndex < 0) {
      return null;
    }

    return input.slice(lastIndex).trim();
  }

  private removeKnownNoise(input: string): string {
    const lines = input.split(/\r?\n/);
    const filtered: string[] = [];
    let skippingPromptBlock = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line === '## controller 执行版 prompt') {
        skippingPromptBlock = true;
        continue;
      }

      if (skippingPromptBlock) {
        if (line === '好的,我来读取 README.md 的第一段并返回中文摘要。' || line === '好的，我来读取 README.md 的第一段并返回中文摘要。') {
          skippingPromptBlock = false;
          filtered.push(rawLine);
        }
        continue;
      }

      if (
        line === '[search-mode]' ||
        line === '[analyze-mode]' ||
        line.startsWith('MAXIMIZE SEARCH EFFORT.') ||
        line.startsWith('ANALYSIS MODE.') ||
        line.startsWith('CONTEXT GATHERING') ||
        line.startsWith('MANDATORY delegate_task params:') ||
        line.startsWith('Example: delegate_task(') ||
        line === '---'
      ) {
        continue;
      }

      filtered.push(rawLine);
    }

    return filtered.join('\n').trim();
  }

  private deduplicateRepeatedTail(input: string): string {
    const marker = '## 执行摘要';
    const firstIndex = input.indexOf(marker);
    if (firstIndex < 0) {
      return input;
    }

    const secondIndex = input.indexOf(marker, firstIndex + marker.length);
    if (secondIndex < 0) {
      return input;
    }

    return input.slice(0, secondIndex).trim();
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
