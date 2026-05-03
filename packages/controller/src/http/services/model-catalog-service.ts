import { HttpError } from '../errors/http-error';

export type ModelProvider = 'openai' | 'anthropic' | 'custom';

export interface ListModelsInput {
  provider: ModelProvider;
  apiKey: string;
  baseUrl?: string;
}

export interface ModelSummary {
  id: string;
  label: string;
}

export interface ListModelsResult {
  provider: ModelProvider;
  models: ModelSummary[];
}

interface OpenAIModelItem {
  id?: unknown;
}

interface OpenAIModelsResponse {
  data?: OpenAIModelItem[];
}

export class ModelCatalogService {
  async listModels(input: ListModelsInput): Promise<ListModelsResult> {
    const provider = input.provider;
    const apiKey = input.apiKey.trim();
    if (apiKey.length === 0) {
      throw new HttpError({ statusCode: 400, errorCode: 'controller.models.api_key_missing', message: '模型 API Key 不能为空' });
    }

    if (provider === 'anthropic') {
      return {
        provider,
        models: [
          { id: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
          { id: 'claude-3-5-haiku-latest', label: 'claude-3-5-haiku-latest' },
          { id: 'claude-3-opus-latest', label: 'claude-3-opus-latest' },
        ],
      };
    }

    const baseUrl = this.resolveOpenAICompatibleBaseUrl(provider, input.baseUrl);
    const url = new URL('/v1/models', baseUrl).toString();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new HttpError({
        statusCode: 502,
        errorCode: 'controller.models.fetch_failed',
        message: `获取模型列表失败：HTTP ${response.status}`,
      });
    }

    const body = (await response.json()) as OpenAIModelsResponse;
    const models = (body.data ?? [])
      .map((item): ModelSummary | null => {
        if (typeof item.id !== 'string' || item.id.trim().length === 0) {
          return null;
        }
        return { id: item.id, label: item.id };
      })
      .filter((item): item is ModelSummary => item !== null)
      .sort((left, right) => left.id.localeCompare(right.id));

    return { provider, models };
  }

  private resolveOpenAICompatibleBaseUrl(provider: ModelProvider, baseUrl?: string): string {
    if (provider === 'openai') {
      return baseUrl?.trim() || 'https://api.openai.com';
    }

    const customBaseUrl = baseUrl?.trim();
    if (!customBaseUrl) {
      throw new HttpError({ statusCode: 400, errorCode: 'controller.models.base_url_missing', message: '自定义供应商必须填写 Base URL' });
    }
    return customBaseUrl;
  }
}
