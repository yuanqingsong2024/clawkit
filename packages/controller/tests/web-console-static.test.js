const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildHttpServer } = require('../dist');

async function run(name, handler) {
  await handler();
  console.log(`✓ ${name}`);
}

function createWebDistFixture() {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clawkit-web-dist-'));
  const assetsDir = path.join(distDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, 'index.html'),
    '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>clawkit 控制台</title></head><body><div id="root"></div></body></html>',
    'utf8',
  );
  fs.writeFileSync(path.join(assetsDir, 'app.js'), 'console.log("web console ok");', 'utf8');
  return distDir;
}

async function withWebDist(handler) {
  const distDir = createWebDistFixture();
  const previousDir = process.env.WEB_CONSOLE_DIST_DIR;
  const previousPersistence = process.env.CONTROLLER_ENABLE_PERSISTENCE;
  process.env.WEB_CONSOLE_DIST_DIR = distDir;
  process.env.CONTROLLER_ENABLE_PERSISTENCE = 'false';

  try {
    await handler(distDir);
  } finally {
    if (previousPersistence === undefined) {
      delete process.env.CONTROLLER_ENABLE_PERSISTENCE;
    } else {
      process.env.CONTROLLER_ENABLE_PERSISTENCE = previousPersistence;
    }
    if (previousDir === undefined) {
      delete process.env.WEB_CONSOLE_DIST_DIR;
    } else {
      process.env.WEB_CONSOLE_DIST_DIR = previousDir;
    }
    fs.rmSync(distDir, { recursive: true, force: true });
  }
}

async function runWebConsoleStaticTests() {
  await run('Web Console 静态托管：根路径返回 index.html', async () => {
    await withWebDist(async () => {
      const app = await buildHttpServer();
      try {
        const response = await app.inject({ method: 'GET', url: '/' });
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['content-type'].includes('text/html'), true);
        assert.equal(response.body.includes('clawkit 控制台'), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('Web Console 静态托管：前端路由直达返回 SPA fallback', async () => {
    await withWebDist(async () => {
      const app = await buildHttpServer();
      try {
        const response = await app.inject({ method: 'GET', url: '/tasks/demo-task' });
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['content-type'].includes('text/html'), true);
        assert.equal(response.body.includes('<div id="root"></div>'), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('Web Console 静态托管：静态资源文件可直接访问', async () => {
    await withWebDist(async () => {
      const app = await buildHttpServer();
      try {
        const response = await app.inject({ method: 'GET', url: '/assets/app.js' });
        assert.equal(response.statusCode, 200);
        assert.equal(response.headers['content-type'].includes('application/javascript'), true);
        assert.equal(response.body.includes('web console ok'), true);
      } finally {
        await app.close();
      }
    });
  });

  await run('Web Console 静态托管：API 路径不被前端 fallback 抢占', async () => {
    await withWebDist(async () => {
      const app = await buildHttpServer();
      try {
        const healthResponse = await app.inject({ method: 'GET', url: '/api/health' });
        assert.equal(healthResponse.statusCode, 200);
        assert.equal(healthResponse.json().success, true);

        const notFoundResponse = await app.inject({ method: 'GET', url: '/api/not-found' });
        assert.equal(notFoundResponse.statusCode, 404);
        assert.equal(notFoundResponse.headers['content-type'].includes('application/json'), true);
      } finally {
        await app.close();
      }
    });
  });
}

module.exports = {
  runWebConsoleStaticTests,
};
