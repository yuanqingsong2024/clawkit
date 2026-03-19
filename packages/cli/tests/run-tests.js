const { runApplyServiceTests } = require('./apply.service.test');
const { runHealServiceTests } = require('./heal.service.test');

async function main() {
  try {
    runApplyServiceTests();
    await runHealServiceTests();
    console.log('CLI 测试全部通过');
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('CLI 测试失败');
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
