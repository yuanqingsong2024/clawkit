import type { TaskExecutionBoundary, TaskExecutionContext } from '@clawkit/shared';

import type { ProjectExecutionContext } from './project-context-reader';

export class WorkerPromptCompiler {
  compile(context: TaskExecutionContext, projectContext: ProjectExecutionContext, boundary: TaskExecutionBoundary): string {
    const sections: string[] = [];

    sections.push('# 最终执行指令');
    sections.push('');
    sections.push('## 项目标识');
    sections.push(`- projectKey: ${context.projectKey}`);
    sections.push(`- 仓库路径: ${context.repoPath}`);
    sections.push(`- 基线分支: ${context.branchBase}`);
    sections.push('');
    sections.push('## 任务目标');
    sections.push(context.intent);
    sections.push('');
    sections.push('## 验收标准');
    if (context.acceptanceCriteria.length === 0) {
      sections.push('- 无明确验收标准，请严格按照输出契约回报执行证据');
    } else {
      context.acceptanceCriteria.forEach((criterion) => sections.push(`- ${criterion}`));
    }
    sections.push('');
    sections.push('## 禁止事项');
    boundary.forbiddenActions.forEach((item) => sections.push(`- ${item}`));
    sections.push(`- ${boundary.highRiskHandling}`);
    sections.push('');
    sections.push('## 输出契约');
    sections.push('- 完成清单');
    sections.push('- 改动文件列表');
    sections.push('- 执行命令');
    sections.push('- 测试结果');
    sections.push('- 风险与待确认项');
    sections.push('');
    sections.push('## 当前执行边界');
    boundary.allowedActions.forEach((item) => sections.push(`- 允许：${item}`));
    boundary.forbiddenActions.forEach((item) => sections.push(`- 禁止：${item}`));
    sections.push('');
    sections.push('## 项目规则提示');
    if (projectContext.agentsExists) {
      sections.push(`- 已读取 AGENTS.md：${projectContext.agentsPath}`);
      sections.push('');
      sections.push('### AGENTS.md 摘要');
      sections.push(this.limitBlock(projectContext.agentsContent ?? '', 4000));
    } else {
      sections.push('- 未找到 AGENTS.md，请显式说明并继续执行');
    }
    sections.push('');
    sections.push(`- commands 目录：${projectContext.commandsExists ? '存在' : '不存在'}`);
    if (projectContext.commandEntries.length > 0) {
      sections.push(`- commands 列表：${projectContext.commandEntries.join('、')}`);
    }
    sections.push(`- skills 目录：${projectContext.skillsExists ? '存在' : '不存在'}`);
    if (projectContext.skillEntries.length > 0) {
      sections.push(`- skills 列表：${projectContext.skillEntries.join('、')}`);
    }
    sections.push(`- oh-my-opencode 配置：${projectContext.ohMyOpencodeExists ? '存在' : '不存在'}`);
    if (projectContext.ohMyOpencodeExists) {
      sections.push('');
      sections.push('### .opencode/oh-my-opencode.jsonc 摘要');
      sections.push(this.limitBlock(projectContext.ohMyOpencodeContent ?? '', 2000));
    }
    sections.push('');
    sections.push('## controller 执行版 prompt');
    sections.push(context.executionPrompt);

    return sections.join('\n');
  }

  private limitBlock(input: string, maxLength: number): string {
    if (input.length <= maxLength) {
      return input;
    }

    return `${input.slice(0, maxLength)}\n...（已截断）`;
  }
}
