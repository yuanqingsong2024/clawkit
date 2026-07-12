import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ControllerErrorCode } from '@clawkit/shared';

import { buildFailureResponse } from '../types/api-response';

function readToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const apiKey = request.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
    return apiKey.trim();
  }

  const authToken = request.headers['x-auth-token'];
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.trim();
  }

  return null;
}

function sendUnauthorized(reply: FastifyReply, message: string): FastifyReply {
  return reply.status(401).send(buildFailureResponse(ControllerErrorCode.AUTH_UNAUTHORIZED, message, null));
}

function isProtectedRuntimePath(pathname: string): boolean {
  return [
    '/status',
    '/version',
    '/capabilities',
    '/workers',
    '/workers/status',
    '/task-drafts',
    '/dispatch',
    '/dispatch/dry-run',
    '/dispatches',
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function registerRuntimeAuth(app: FastifyInstance): void {
  const controllerToken = process.env.CLAWKIT_CONTROLLER_TOKEN?.trim();
  if (!controllerToken) {
    return;
  }

  app.addHook('preHandler', async (request, reply) => {
    const pathname = new URL(request.raw.url ?? request.url, 'http://localhost').pathname;
    if (pathname === '/health' || pathname === '/api/health') {
      return;
    }

    if (!isProtectedRuntimePath(pathname)) {
      return;
    }

    const token = readToken(request);
    if (!token) {
      sendUnauthorized(reply, '缺少 CLAWKIT_CONTROLLER_TOKEN 对应的访问令牌');
      return;
    }

    if (token !== controllerToken) {
      sendUnauthorized(reply, '访问令牌无效');
      return;
    }
  });
}
