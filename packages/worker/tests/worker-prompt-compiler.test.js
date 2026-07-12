const assert = require('node:assert/strict');

const { WorkerPromptCompiler } = require('../dist');

function runWorkerPromptCompilerTests() {
  const compiler = new WorkerPromptCompiler();
  const result = compiler.compile(
    {
      taskId: 'task-001',
      projectKey: 'clawkit',
      repoPath: '/repo',
      branchBase: 'main',
      openCode: { port: 4096, agent: 'build', mode: 'default' },
      intent: '实现 OpenCodeExecutor',
      constraints: ['禁止 git push'],
      acceptanceCriteria: ['输出真实执行摘要'],
      sourceText: 'source',
      status: 'running',
      executionPrompt: '# controller prompt',
      outputContract: {
        completionChecklist: ['完成清单'],
        modifiedFiles: ['改动文件列表'],
        executionCommands: ['执行命令'],
        testResults: ['测试结果'],
        risksAndConfirmations: ['风险与待确认项'],
      },
      executionBoundary: {
        allowedActions: ['查看代码'],
        forbiddenActions: ['git push'],
        highRiskHandling: '报告高风险操作',
      },
    },
    {
      projectKey: 'clawkit',
      repoPath: '/repo',
      branchBase: 'main',
      agentsPath: '/repo/AGENTS.md',
      agentsExists: true,
      agentsContent: '# 规则',
      commandsPath: '/repo/.opencode/commands',
      commandsExists: true,
      commandEntries: ['fix.md'],
      skillsPath: '/repo/skills',
      skillsExists: true,
      skillEntries: ['custom.md'],
      ohMyOpencodePath: '/repo/.opencode/oh-my-opencode.jsonc',
      ohMyOpencodeExists: false,
      ohMyOpencodeContent: null,
    },
    {
      allowedActions: ['查看代码'],
      forbiddenActions: ['git push'],
      highRiskHandling: '报告高风险操作',
    },
  );

  assert.equal(result.includes('项目标识'), true);
  assert.equal(result.includes('仓库路径: /repo'), true);
  assert.equal(result.includes('禁止事项'), true);
  assert.equal(result.includes('输出契约'), true);
  assert.equal(result.includes('# controller prompt'), true);
  console.log('✓ WorkerPromptCompiler：可以编译最终执行 prompt');
}

module.exports = { runWorkerPromptCompilerTests };
