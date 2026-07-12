import fs from 'node:fs';
import path from 'node:path';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const MIME_TYPE_MAP: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveWebConsoleDistDir(): string | null {
  const configuredDir = process.env.WEB_CONSOLE_DIST_DIR?.trim();
  const candidates = configuredDir && configuredDir.length > 0
    ? [configuredDir]
    : [
        path.resolve(__dirname, '../../../web/dist'),
        path.resolve(process.cwd(), 'packages/web/dist'),
      ];

  for (const candidate of candidates) {
    const resolvedDir = path.resolve(candidate);
    const indexFilePath = path.join(resolvedDir, 'index.html');
    if (fs.existsSync(indexFilePath) && fs.statSync(indexFilePath).isFile()) {
      return resolvedDir;
    }
  }

  return null;
}

function toRequestPath(request: FastifyRequest): string {
  const url = new URL(request.url, 'http://127.0.0.1');
  return decodeURIComponent(url.pathname);
}

function resolveStaticFilePath(distDir: string, requestPath: string): { type: 'file'; filePath: string } | { type: 'fallback' } | { type: 'not-found' } {
  if (requestPath === '/' || requestPath.length === 0) {
    return { type: 'fallback' };
  }

  const relativePath = requestPath.replace(/^\/+/, '');
  const absolutePath = path.resolve(distDir, relativePath);
  const allowedPrefix = `${distDir}${path.sep}`;
  if (absolutePath !== distDir && !absolutePath.startsWith(allowedPrefix)) {
    return { type: 'not-found' };
  }

  if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
    return { type: 'file', filePath: absolutePath };
  }

  if (path.extname(relativePath).length > 0) {
    return { type: 'not-found' };
  }

  return { type: 'fallback' };
}

function replyWithStaticFile(reply: FastifyReply, filePath: string): FastifyReply {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPE_MAP[extension] ?? 'application/octet-stream';
  const isFingerprintedAsset = /\/assets\/.+[-.][A-Za-z0-9]{6,}\./.test(filePath);

  reply.type(mimeType);
  reply.header('cache-control', isFingerprintedAsset ? 'public, max-age=31536000, immutable' : 'no-cache');
  return reply.send(fs.readFileSync(filePath));
}

export async function registerWebConsoleStatic(app: FastifyInstance): Promise<void> {
  const distDir = resolveWebConsoleDistDir();
  if (distDir === null) {
    return;
  }

  const handleRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    const requestPath = toRequestPath(request);

    if (requestPath === '/api' || requestPath.startsWith('/api/')) {
      return reply.callNotFound();
    }

    const resolved = resolveStaticFilePath(distDir, requestPath);
    if (resolved.type === 'not-found') {
      return reply.callNotFound();
    }

    if (resolved.type === 'fallback') {
      return replyWithStaticFile(reply, path.join(distDir, 'index.html'));
    }

    return replyWithStaticFile(reply, resolved.filePath);
  };

  app.get('/', handleRequest);
  app.get('/*', handleRequest);
}
