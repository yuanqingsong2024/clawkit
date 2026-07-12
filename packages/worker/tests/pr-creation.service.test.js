/**
 * PR 创建服务单元测试
 */

const assert = require('node:assert/strict');
const {
  parseRepoUrl,
  renderPrTemplate,
  DEFAULT_PR_CONFIG,
} = require('../dist/services/pr-creation.service');

/**
 * 测试 parseRepoUrl 函数
 */
function testParseRepoUrl() {
  console.log('\n--- 测试 parseRepoUrl ---');

  // GitHub HTTPS
  const result1 = parseRepoUrl('https://github.com/owner/repo.git');
  assert.equal(result1.provider, 'github', 'GitHub HTTPS 应识别为 github');
  assert.equal(result1.owner, 'owner', 'owner 不匹配');
  assert.equal(result1.repo, 'repo', 'repo 不匹配');

  // GitHub SSH
  const result2 = parseRepoUrl('git@github.com:owner/repo.git');
  assert.equal(result2.provider, 'github', 'GitHub SSH 应识别为 github');
  assert.equal(result2.owner, 'owner', 'owner 不匹配');
  assert.equal(result2.repo, 'repo', 'repo 不匹配');

  // GitLab HTTPS
  const result3 = parseRepoUrl('https://gitlab.com/owner/repo.git');
  assert.equal(result3.provider, 'gitlab', 'GitLab HTTPS 应识别为 gitlab');
  assert.equal(result3.owner, 'owner', 'owner 不匹配');
  assert.equal(result3.repo, 'repo', 'repo 不匹配');

  // GitLab SSH
  const result4 = parseRepoUrl('git@gitlab.com:owner/repo.git');
  assert.equal(result4.provider, 'gitlab', 'GitLab SSH 应识别为 gitlab');
  assert.equal(result4.owner, 'owner', 'owner 不匹配');
  assert.equal(result4.repo, 'repo', 'repo 不匹配');

  // 自定义 GitLab 实例
  const result5 = parseRepoUrl('https://gitlab.example.com/team/project.git');
  assert.equal(result5.provider, 'gitlab', '自定义 GitLab 应识别为 gitlab');
  assert.equal(result5.owner, 'team', 'team 不匹配');
  assert.equal(result5.repo, 'project', 'project 不匹配');

  // 无效 URL
  const result6 = parseRepoUrl('invalid-url');
  assert.equal(result6, null, '无效 URL 应返回 null');

  console.log('✓ parseRepoUrl：所有用例通过');
}

/**
 * 测试 renderPrTemplate 函数
 */
function testRenderPrTemplate() {
  console.log('\n--- 测试 renderPrTemplate ---');

  const variables = {
    taskId: 'TASK-123',
    intent: 'refactor-auth',
    summary: '重构认证模块',
    changedFiles: ['src/auth/login.ts', 'src/auth/logout.ts'],
    commands: ['npm test', 'npm run build'],
    testResult: '全部通过 (42 tests)',
    risks: ['需要更新相关文档'],
    repoName: 'clawkit/core',
    sourceBranch: 'feature/refactor-auth',
    targetBranch: 'main',
    executedAt: '2026-07-11 10:00:00',
    workerId: 'worker-1',
  };

  // 测试基本模板
  const title1 = renderPrTemplate('[ClawKit] {{intent}}', variables);
  assert.equal(title1, '[ClawKit] refactor-auth', '基本模板替换失败');

  // 测试多变量替换
  const title2 = renderPrTemplate('Task {{taskId}}: {{intent}}', variables);
  assert.equal(title2, 'Task TASK-123: refactor-auth', '多变量替换失败');

  // 测试列表展开
  const body1 = renderPrTemplate('Changed: {{#each changedFiles}}{{this}}, {{/each}}', variables);
  assert.equal(body1.includes('src/auth/login.ts'), true, '列表展开失败');

  // 测试复杂模板
  const complex = renderPrTemplate(
    '## 任务 #{{taskId}}\n\n**意图**: {{intent}}\n\n### 摘要\n{{summary}}',
    variables,
  );
  assert.equal(complex.includes('任务 #TASK-123'), true, '复杂模板失败');
  assert.equal(complex.includes('refactor-auth'), true, '复杂模板失败');

  console.log('✓ renderPrTemplate：所有用例通过');
}

/**
 * 测试 DEFAULT_PR_CONFIG
 */
function testDefaultPrConfig() {
  console.log('\n--- 测试 DEFAULT_PR_CONFIG ---');

  assert.equal(typeof DEFAULT_PR_CONFIG.enabled, 'boolean', 'enabled 应该是布尔值');
  assert.equal(typeof DEFAULT_PR_CONFIG.baseBranch, 'string', 'baseBranch 应该是字符串');
  assert.equal(typeof DEFAULT_PR_CONFIG.titleTemplate, 'string', 'titleTemplate 应该是字符串');
  assert.equal(typeof DEFAULT_PR_CONFIG.descriptionTemplate, 'string', 'descriptionTemplate 应该是字符串');
  assert.equal(DEFAULT_PR_CONFIG.autoAssignReviewers, false, 'autoAssignReviewers 默认应为 false');
  assert.equal(DEFAULT_PR_CONFIG.autoAddLabels, true, 'autoAddLabels 默认应为 true');

  console.log('✓ DEFAULT_PR_CONFIG：配置正确');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  console.log('========================================');
  console.log('PR 创建服务单元测试');
  console.log('========================================');

  try {
    testParseRepoUrl();
    testRenderPrTemplate();
    testDefaultPrConfig();

    console.log('\n========================================');
    console.log('✅ 所有测试通过!');
    console.log('========================================');
  } catch (error) {
    console.error('\n========================================');
    console.error('❌ 测试失败:', error.message);
    console.error('========================================');
    process.exit(1);
  }
}

// 直接运行
runAllTests();

module.exports = { runAllTests };
