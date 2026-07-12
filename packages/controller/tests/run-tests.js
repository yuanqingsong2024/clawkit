const { runProtocolParserTests } = require('./protocol-parser.test');
const { runStateMachineTests } = require('./state-machine.test');
const { runTaskDraftServiceTests } = require('./task-draft-service.test');
const { runTaskMemoryServiceTests } = require('./task-memory-service.test');
const { runPromptCompilerTests } = require('./prompt-compiler.test');
const { runPromptEngineTests } = require('./prompt-engine.test');
const { runIntegrationTests } = require('./integration.test');
const { runControllerFlowServiceTests } = require('./controller-flow-service.test');
const { runDispatchRoutesTests } = require('./dispatch-routes.test');
const { runHttpRoutesTests } = require('./http-routes.test');
const { runExecutionStatusTests } = require('./execution-status.test');
const { runOpenClawAdapterTests } = require('./openclaw-adapter.test');
const { runDraftResponseFormatterTests } = require('./draft-response-formatter.test');
const { runResultResponseFormatterTests } = require('./result-response-formatter.test');
const { runOpenClawWebhookRouteTests } = require('./openclaw-webhook-route.test');
const { runRuntimeRoutesTests } = require('./runtime-routes.test');
const { runWebConsoleStaticTests } = require('./web-console-static.test');
const { runSqliteTaskStoreTests } = require('./sqlite-task-store.test');

async function main() {
  try {
    runProtocolParserTests();
    runStateMachineTests();
    runTaskDraftServiceTests();
    runTaskMemoryServiceTests();
    runPromptCompilerTests();
    runPromptEngineTests();
    runIntegrationTests();
    await runControllerFlowServiceTests();
    await runDispatchRoutesTests();
    await runHttpRoutesTests();
    await runExecutionStatusTests();
    await runOpenClawAdapterTests();
    runDraftResponseFormatterTests();
    runResultResponseFormatterTests();
    await runOpenClawWebhookRouteTests();
    await runRuntimeRoutesTests();
    await runWebConsoleStaticTests();
    runSqliteTaskStoreTests();
    console.log('全部测试通过');
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error('测试失败');
    console.error(message);
    process.exitCode = 1;
  }
}

void main();
