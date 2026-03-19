import type { FastifyReply } from 'fastify';

export interface ApiSuccessResponse<T> {
  success: true;
  code: string;
  message: string;
  data: T;
}

export interface ApiFailureResponse {
  success: false;
  code: string;
  message: string;
  details: unknown;
}

export function buildSuccessResponse<T>(code: string, message: string, data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    code,
    message,
    data,
  };
}

export function buildFailureResponse(code: string, message: string, details: unknown): ApiFailureResponse {
  return {
    success: false,
    code,
    message,
    details,
  };
}

export function sendSuccess<T>(
  reply: FastifyReply,
  options: {
    statusCode?: number;
    code: string;
    message: string;
    data: T;
  },
): FastifyReply {
  const statusCode = options.statusCode ?? 200;
  return reply.status(statusCode).send(buildSuccessResponse(options.code, options.message, options.data));
}
