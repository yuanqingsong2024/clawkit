const assert = require('node:assert/strict');

const { formatValidationIssue, ManifestSchema } = require('../dist/index');
const { z } = require('zod');

function runFormatValidationIssueTests() {
  const MissingSchema = z.object({ name: z.string() });
  const missingResult = MissingSchema.safeParse({});
  assert.equal(missingResult.success, false);
  const missingIssue = missingResult.error.issues[0];
  assert.equal(
    formatValidationIssue(missingIssue),
    '必填字段缺失',
    `必填字段缺失分支失败，实际返回：${formatValidationIssue(missingIssue)}`
  );
  console.log('✓ formatValidationIssue：必填字段缺失返回正确中文描述');

  const TypeSchema = z.object({ age: z.number() });
  const typeResult = TypeSchema.safeParse({ age: 'not-a-number' });
  assert.equal(typeResult.success, false);
  const typeIssue = typeResult.error.issues[0];
  assert.equal(
    formatValidationIssue(typeIssue),
    '字段类型不正确',
    `字段类型不正确分支失败，实际返回：${formatValidationIssue(typeIssue)}`
  );
  console.log('✓ formatValidationIssue：字段类型不正确返回正确中文描述');

  const SmallSchema = z.object({ name: z.string().min(5) });
  const smallResult = SmallSchema.safeParse({ name: 'ab' });
  assert.equal(smallResult.success, false);
  const smallIssue = smallResult.error.issues[0];
  assert.equal(
    formatValidationIssue(smallIssue),
    '字段值过小或内容过短',
    `too_small 分支失败，实际返回：${formatValidationIssue(smallIssue)}`
  );
  console.log('✓ formatValidationIssue：too_small 返回正确中文描述');

  const CustomSchema = z.object({ val: z.string() }).superRefine((data, ctx) => {
    ctx.addIssue({ code: 'custom', path: ['val'], message: '自定义错误消息' });
  });
  const customResult = CustomSchema.safeParse({ val: 'x' });
  assert.equal(customResult.success, false);
  const customIssue = customResult.error.issues[0];
  assert.equal(
    formatValidationIssue(customIssue),
    '自定义错误消息',
    `custom 分支失败，实际返回：${formatValidationIssue(customIssue)}`
  );
  console.log('✓ formatValidationIssue：custom 错误返回原始 message');
}

function runManifestSchemaTests() {
  const validManifest = {
    profile: { name: 'test', version: '1.0.0', topology: 'all-in-one' },
    nodes: { local: { type: 'local', workDir: '/tmp/test' } },
    services: {
      controller: { node: 'local', port: 8787, apiPrefix: '/api' },
      openClaw: { node: 'local', publicUrl: 'http://127.0.0.1:8787' },
    },
    workers: [{
      id: 'w1',
      node: 'local',
      connectMode: 'pull',
      tags: [],
      projects: [{
        key: 'proj',
        repoPath: '/tmp/proj',
        baseBranch: 'main',
        openCode: { port: 4096, agent: 'build', mode: 'default' },
      }],
    }],
    runtime: {
      promptEngine: { mode: 'template' },
      memory: { enabled: false, provider: 'local', path: './data/memory' },
    },
  };

  const result = ManifestSchema.safeParse(validManifest);
  assert.equal(
    result.success,
    true,
    `合法 manifest 应通过校验，实际错误：${JSON.stringify(result.error?.issues)}`
  );
  console.log('✓ ManifestSchema：合法 manifest 通过校验');

  const missingProfile = { ...validManifest, profile: undefined };
  const failResult = ManifestSchema.safeParse(missingProfile);
  assert.equal(failResult.success, false, '缺少 profile 的 manifest 应校验失败');
  console.log('✓ ManifestSchema：缺少必填字段时正确报错');

  const badTopology = {
    ...validManifest,
    profile: { ...validManifest.profile, topology: 'unknown' },
  };
  const topoResult = ManifestSchema.safeParse(badTopology);
  assert.equal(topoResult.success, false, '非法 topology 应校验失败');
  console.log('✓ ManifestSchema：非法 topology 值被正确拒绝');
}

async function main() {
  try {
    runFormatValidationIssueTests();
    runManifestSchemaTests();
    console.log('shared 测试全部通过');
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('shared 测试失败');
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
