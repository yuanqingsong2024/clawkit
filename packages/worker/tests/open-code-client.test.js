const assert = require('node:assert/strict');

const { OpenCodeClient } = require('../dist');

async function runOpenCodeClientTests() {
  const client = new OpenCodeClient({
    server: {
      baseUrl: 'http://127.0.0.1:4096',
      username: 'tester',
      passwordEnv: 'OPENCODE_SERVER_PASSWORD',
    },
    mode: 'sdk',
    timeoutMs: 5000,
    fallbackToPlaceholder: false,
  });

  client.loadSdkModule = async () => ({
    createOpencodeClient: () => ({
      global: {
        health: async () => ({ data: { healthy: true, version: '1.0.0' } }),
      },
      session: {},
    }),
  });

  await client.checkAvailability('http://127.0.0.1:4096');
  assert.equal(client.buildServerUnavailableHint('http://127.0.0.1:4096').includes('opencode serve'), true);
  console.log('✓ OpenCodeClient：可以完成 server 连接检查');
}

module.exports = { runOpenCodeClientTests };
