/**
 * HTTP 请求工具
 * 基于 axios 的 HTTP 客户端封装
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ApiResponse, ClawKitClientOptions } from '../types';
import { ClawKitError } from '../types';

/**
 * 创建错误对象
 */
function createError(response: AxiosResponse): ClawKitError {
  const data = response.data as ApiResponse | undefined;
  return new ClawKitError(
    data?.message || response.statusText,
    data?.code || 'unknown.error',
    response.status,
    data?.data
  );
}

/**
 * HTTP 客户端类
 */
export class HttpClient {
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(options: ClawKitClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
    this.apiKey = options.apiKey;

    const config: AxiosRequestConfig = {
      baseURL: this.baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    this.client = axios.create(config);

    // 请求拦截器：添加认证头
    this.client.interceptors.request.use(
      (config) => {
        if (this.apiKey) {
          config.headers['X-API-Key'] = this.apiKey;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器：统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // 服务器返回错误状态码
          throw createError(error.response);
        } else if (error.request) {
          // 请求已发送但没有收到响应
          throw new ClawKitError(
            'Network error: No response received',
            'network.error',
            0
          );
        } else {
          // 请求配置出错
          throw new ClawKitError(
            error.message || 'Request configuration error',
            'request.error',
            0
          );
        }
      }
    );
  }

  /**
   * GET 请求
   */
  async get<T = unknown>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(path, { params });
    return response.data.data;
  }

  /**
   * POST 请求
   */
  async post<T = unknown>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(path, data);
    return response.data.data;
  }

  /**
   * PUT 请求
   */
  async put<T = unknown>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(path, data);
    return response.data.data;
  }

  /**
   * DELETE 请求
   */
  async delete<T = unknown>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(path, { data });
    return response.data.data;
  }

  /**
   * PATCH 请求
   */
  async patch<T = unknown>(path: string, data?: unknown): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(path, data);
    return response.data.data;
  }

  /**
   * 获取原始响应（包含完整的 ApiResponse）
   */
  async request<T = unknown>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.client.request<ApiResponse<T>>(config);
    return response.data;
  }

  /**
   * 获取基础 URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
