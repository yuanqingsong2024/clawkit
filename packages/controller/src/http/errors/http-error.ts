import { ControllerErrorCode, getErrorMessage } from '@clawkit/shared';

export class HttpError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details: unknown;
  readonly userMessage?: string;
  readonly suggestion?: string;

  constructor(options: {
    statusCode: number;
    errorCode: string;
    message: string;
    details?: unknown;
  }) {
    super(options.message);
    this.name = 'HttpError';
    this.statusCode = options.statusCode;
    this.errorCode = options.errorCode;
    this.details = options.details ?? null;

    if (Object.values(ControllerErrorCode).includes(options.errorCode as ControllerErrorCode)) {
      const friendlyError = getErrorMessage(options.errorCode as ControllerErrorCode, options.message);
      this.userMessage = friendlyError.message;
      this.suggestion = friendlyError.suggestion;
    }
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      message: this.userMessage || this.message,
      suggestion: this.suggestion,
      details: this.details,
      technical: this.userMessage ? this.message : undefined,
    };
  }
}
