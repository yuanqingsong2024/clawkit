const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { OpenCodeExecutor } = require('../dist');

async function runOpenCodeExecutorTests() {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-executor-'));
  fs.writeFileSync(path.join(repoPath, 'AGENTS.md'), '# 规则', 'utf8');

  try {
    const executor = new OpenCodeExecutor({
      workerId: 'worker-test-1',
      name: 'worker',
      nodeName: 'local',
      connectMode: 'pull',
      tags: [],
      supportedProjects: ['clawkit'],
      controllerUrl: 'http://localhost:8787',
      heartbeatIntervalMs: 1000,
      pollIntervalMs: 1000,
      manifestPath: undefined,
      openCode: {
        server: { baseUrl: 'http://127.0.0.1:4096' },
        mode: 'sdk',
        timeoutMs: 5000,
        fallbackToPlaceholder: false,
      },
    });

    executor.client = {
      checkAvailability: async () => {},
      run: async () => ({
        rawOutput: '## 完成清单\n- 已完成 OpenCodeExecutor 接入\n## 改动文件列表\n- packages/worker/src/executors/open-code-executor.ts\n## 执行命令\n- pnpm build\n## 测试结果\n- 测试通过\n## 风险与待确认项\n- 无',
        logs: ['执行成功'],
        sessionId: 'ses-001',
      }),
      buildServerUnavailableHint: () => 'hint',
    };

    const success = await executor.execute({
      taskId: 'task-001',
      projectKey: 'clawkit',
      repoPath,
      branchBase: 'main',
      openCode: { port: 4096, agent: 'build', mode: 'default' },
      intent: '接入 OpenCodeExecutor',
      constraints: ['禁止 git push'],
      acceptanceCriteria: ['返回真实执行摘要'],
      sourceText: 'source',
      status: 'running',
      executionPrompt: '# prompt',
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
    });

    assert.equal(success.status, 'done');
    assert.deepEqual(success.changedFiles, ['packages/worker/src/executors/open-code-executor.ts']);
    assert.equal(success.sessionId, 'ses-001');

    executor.client = {
      checkAvailability: async () => {
        const error = new Error('OpenCode server 不可用');
        error.structuredError = {
          errorCode: 'opencode.server_unavailable',
          message: 'OpenCode server 不可用',
          stage: 'server_check',
          rawErrorSummary: 'health failed',
        };
        throw error;
      },
      buildServerUnavailableHint: () => '请先启动 opencode serve',
    };

    const failed = await executor.execute({
      taskId: 'task-002',
      projectKey: 'clawkit',
      repoPath,
      branchBase: 'main',
      openCode: { port: 4096, agent: 'build', mode: 'default' },
      intent: '检查失败路径',
      constraints: [],
      acceptanceCriteria: [],
      sourceText: 'source',
      status: 'running',
      executionPrompt: '# prompt',
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
    });

    assert.equal(failed.status, 'failed');
    assert.equal(failed.structuredError.errorCode, 'opencode.server_unavailable');
    assert.equal(failed.logs[1].includes('opencode serve'), true);
    console.log('✓ OpenCodeExecutor：成功与失败路径均可返回结构化结果');
  } finally {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
}

module.exports = { runOpenCodeExecutorTests };
