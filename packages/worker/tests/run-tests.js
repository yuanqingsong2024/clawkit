const { runOpenCodeClientTests } = require('./open-code-client.test');
const { runProjectContextReaderTests } = require('./project-context-reader.test');
const { runWorkerPromptCompilerTests } = require('./worker-prompt-compiler.test');
const { runOpenCodeExecutorTests } = require('./open-code-executor.test');
const { runResultSubmitServiceTests } = require('./result-submit-service.test');

async function main() {
  try {
    await runOpenCodeClientTests();
    await runProjectContextReaderTests();
    runWorkerPromptCompilerTests();
    await runOpenCodeExecutorTests();
    await runResultSubmitServiceTests();
    console.log('worker 测试通过');
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('worker 测试失败');
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
