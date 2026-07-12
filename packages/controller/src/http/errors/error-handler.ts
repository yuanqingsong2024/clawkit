import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { buildFailureResponse } from '../types/api-response';
import { HttpError } from './http-error';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof HttpError) {
      const errorData = error.toJSON();
      reply
        .status(error.statusCode)
        .send(buildFailureResponse(
          error.errorCode,
          errorData.message,
          {
            ...(error.details || {}),
            suggestion: errorData.suggestion,
            technical: errorData.technical,
          }
        ));
      return;
    }

    request.log.error(error);
    const fallbackMessage = error.statusCode !== undefined && error.statusCode < 500 ? error.message : '服务内部错误';
    const fallbackCode = error.code ?? 'controller.internal_error';

    reply
      .status(error.statusCode ?? 500)
      .send(buildFailureResponse(fallbackCode, fallbackMessage, { cause: error.message }));
  });
}
