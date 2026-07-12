const { runApplyServiceTests } = require('./apply.service.test');
const { runHealServiceTests } = require('./heal.service.test');
const { runInitServiceTests } = require('./init.service.test');
const { runDoctorServiceTests } = require('./doctor.service.test');
const { runPlanServiceTests } = require('./plan.service.test');

async function main() {
  try {
    console.log('=== CLI 测试套件 ===\n');
    
    runInitServiceTests();
    console.log('');
    
    await runDoctorServiceTests();
    console.log('');
    
    runPlanServiceTests();
    console.log('');
    
    runApplyServiceTests();
    console.log('');
    
    await runHealServiceTests();
    
    console.log('\n=== CLI 测试全部通过 ===');
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('\nCLI 测试失败');
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
