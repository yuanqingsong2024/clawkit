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

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly statusCode?: number;

  constructor(options: { code: string; message: string; details?: unknown; statusCode?: number }) {
    super(options.message);
    this.code = options.code;
    this.details = options.details;
    this.statusCode = options.statusCode;
  }
}

const baseURL = '/api';

function normalizePath(path: string): string {
  if (!path) {
    throw new Error('接口路径不能为空');
  }

  return path.startsWith('/') ? path : `/${path}`;
}
export async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<ApiSuccessResponse<T>> {
  const url = `${baseURL}${normalizePath(path)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`网络请求失败：${message}`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const body = (await res.json().catch(() => null)) as Partial<ApiFailureResponse> | null;
      throw new ApiError({
        code: body?.code ? String(body.code) : 'http.request_failed',
        message: body?.message ? String(body.message) : `接口请求失败：${res.status} ${res.statusText}`,
        details: body?.details,
        statusCode: res.status,
      });
    }
    throw new ApiError({
      code: 'http.request_failed',
      message: `接口请求失败：${res.status} ${res.statusText}`,
      statusCode: res.status,
    });
  }

  if (!isJson) {
    throw new ApiError({ code: 'http.invalid_response', message: '接口返回格式不正确：期望 application/json' });
  }

  const body = (await res.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new ApiError({ code: body.code, message: body.message, details: body.details, statusCode: res.status });
  }

  return body;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, { ...init, method: 'GET' });
  return res.data;
}

export async function apiPost<T, B>(path: string, body?: B, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, {
    ...init,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.data;
}

export async function apiPut<T, B>(path: string, body: B, init?: RequestInit): Promise<T> {
  const res = await apiRequest<T>(path, {
    ...init,
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  return res.data;
}
