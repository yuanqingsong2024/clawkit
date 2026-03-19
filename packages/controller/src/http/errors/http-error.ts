export class HttpError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details: unknown;

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
  }
}
