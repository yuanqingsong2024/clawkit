import type { TaskDraft } from '../models/task-draft';
import type { TaskMemory } from '../models/task-memory';

/**
 * 输出契约结构
 */
export interface OutputContract {
  completionChecklist: string[];
  modifiedFiles: string[];
  executionCommands: string[];
  testResults: string[];
  risksAndConfirmations: string[];
}

/**
 * 编译后的 Prompt 结构
 */
export interface CompiledPrompt {
  /** 摘要版：给用户确认用 */
  summaryVersion: string;
  /** 执行版：为后续 OpenCode 接入预留 */
  executionVersion: string;
  /** 输出契约 */
  outputContract: OutputContract;
}

/**
 * PromptCompiler 输入
 */
export interface PromptCompilerInput {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory | null;
}

/**
 * PromptCompiler 服务接口
 * 负责将原始研发任务转成规范化任务卡，生成摘要版和为后续接入预留的执行版 prompt
 */
export interface PromptCompiler {
  /**
   * 编译任务草稿为 Prompt
   * @param input 编译输入
   * @returns 编译后的 Prompt（包含摘要版和预留执行版）
   */
  compile(input: PromptCompilerInput): CompiledPrompt;
}

/**
 * PromptCompiler 的默认实现
 */
export class PromptCompilerImpl implements PromptCompiler {
  compile(input: PromptCompilerInput): CompiledPrompt {
    const { taskDraft, taskMemory } = input;

    // 生成输出契约
    const outputContract = this.buildOutputContract();

    // 生成摘要版 prompt
    const summaryVersion = this.buildSummaryVersion(taskDraft, taskMemory);

    // 生成执行版 prompt
    const executionVersion = this.buildExecutionVersion(taskDraft, taskMemory, outputContract);

    return {
      summaryVersion,
      executionVersion,
      outputContract,
    };
  }

  /**
   * 构建输出契约
   */
  private buildOutputContract(): OutputContract {
    return {
      completionChecklist: [
        '所有任务目标已完成',
        '所有验收标准已满足',
        '代码已通过 lsp_diagnostics 检查',
        '相关测试已通过',
      ],
      modifiedFiles: [
        '列出所有新增、修改、删除的文件路径',
      ],
      executionCommands: [
        '列出执行的构建命令',
        '列出执行的测试命令',
      ],
      testResults: [
        '构建结果（成功/失败）',
        '测试结果（通过/失败）',
        'lsp_diagnostics 结果',
      ],
      risksAndConfirmations: [
        '列出潜在风险',
        '列出需要人工确认的事项',
      ],
    };
  }

  /**
   * 构建摘要版 prompt（给用户确认用）
   */
  private buildSummaryVersion(taskDraft: TaskDraft, taskMemory: TaskMemory | null): string {
    const sections: string[] = [];
    const latestRevision = this.getLatestRevisionComment(taskMemory);

    sections.push('# 任务摘要');
    sections.push('');
    sections.push(`**项目**: ${taskDraft.projectKey}`);
    sections.push(`**任务目标**: ${taskDraft.intent}`);
    sections.push('');

    if (taskDraft.constraints.length > 0) {
      sections.push('## 约束条件');
      sections.push('');
      taskDraft.constraints.forEach((constraint) => {
        sections.push(`- ${constraint}`);
      });
      sections.push('');
    }

    if (taskDraft.acceptanceCriteria.length > 0) {
      sections.push('## 验收标准');
      sections.push('');
      taskDraft.acceptanceCriteria.forEach((criterion) => {
        sections.push(`- ${criterion}`);
      });
      sections.push('');
    }

    if (taskMemory?.normalizedTaskCard) {
      const card = taskMemory.normalizedTaskCard;
      
      if (card.scope.length > 0) {
        sections.push('## 范围');
        sections.push('');
        card.scope.forEach((item) => {
          sections.push(`- ${item}`);
        });
        sections.push('');
      }

      if (card.outOfScope.length > 0) {
        sections.push('## 不做的事情');
        sections.push('');
        card.outOfScope.forEach((item) => {
          sections.push(`- ${item}`);
        });
        sections.push('');
      }
    }

    if (latestRevision !== null) {
      sections.push('## 最近修改意见');
      sections.push('');
      sections.push(`- ${latestRevision}`);
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 构建执行版 prompt（为后续 OpenCode 接入预留）
   */
  private buildExecutionVersion(
    taskDraft: TaskDraft,
    taskMemory: TaskMemory | null,
    outputContract: OutputContract
  ): string {
    const sections: string[] = [];
    const latestRevision = this.getLatestRevisionComment(taskMemory);

    sections.push('# 研发任务执行指令');
    sections.push('');
    sections.push(`**项目名称**: ${taskDraft.projectKey}`);
    sections.push('');

    sections.push('## 任务目标');
    sections.push('');
    sections.push(taskDraft.intent);
    sections.push('');

    if (taskMemory?.normalizedTaskCard) {
      const card = taskMemory.normalizedTaskCard;
      
      if (card.scope.length > 0) {
        sections.push('## 实现范围');
        sections.push('');
        card.scope.forEach((item) => {
          sections.push(`- ${item}`);
        });
        sections.push('');
      }

      if (card.outOfScope.length > 0) {
        sections.push('## 明确不做');
        sections.push('');
        card.outOfScope.forEach((item) => {
          sections.push(`- ${item}`);
        });
        sections.push('');
      }
    }

    sections.push('## 约束与禁止事项');
    sections.push('');
    if (taskDraft.constraints.length > 0) {
      taskDraft.constraints.forEach((constraint) => {
        sections.push(`- ${constraint}`);
      });
    } else {
      sections.push('- 无特殊约束');
    }
    sections.push('');

    sections.push('## 验收标准');
    sections.push('');
    if (taskDraft.acceptanceCriteria.length > 0) {
      taskDraft.acceptanceCriteria.forEach((criterion) => {
        sections.push(`- ${criterion}`);
      });
    } else {
      sections.push('- 无明确验收标准');
    }
    sections.push('');

    if (latestRevision !== null) {
      sections.push('## 最近修改意见');
      sections.push('');
      sections.push(`- ${latestRevision}`);
      sections.push('');
    }

    sections.push('## 输出契约');
    sections.push('');
    sections.push('完成任务后，必须提供以下信息：');
    sections.push('');

    sections.push('### 完成清单');
    outputContract.completionChecklist.forEach((item) => {
      sections.push(`- ${item}`);
    });
    sections.push('');

    sections.push('### 改动文件列表');
    outputContract.modifiedFiles.forEach((item) => {
      sections.push(`- ${item}`);
    });
    sections.push('');

    sections.push('### 执行命令');
    outputContract.executionCommands.forEach((item) => {
      sections.push(`- ${item}`);
    });
    sections.push('');

    sections.push('### 测试结果');
    outputContract.testResults.forEach((item) => {
      sections.push(`- ${item}`);
    });
    sections.push('');

    sections.push('### 风险与待确认项');
    outputContract.risksAndConfirmations.forEach((item) => {
      sections.push(`- ${item}`);
    });
    sections.push('');

    return sections.join('\n');
  }

  private getLatestRevisionComment(taskMemory: TaskMemory | null): string | null {
    if (!taskMemory || taskMemory.userRevisionHistory.length === 0) {
      return null;
    }

    return taskMemory.userRevisionHistory[taskMemory.userRevisionHistory.length - 1].comment;
  }
}
