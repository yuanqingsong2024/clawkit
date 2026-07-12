import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

// OpenAPI 3.0 文档生成器
// 用于生成 API 文档和 Swagger UI 支持

export interface OpenApiRouteOptions {
  title?: string;
  version?: string;
  description?: string;
  enableSwaggerUi?: boolean;
}

/**
 * OpenAPI 文档生成器
 * 根据 Fastify 路由自动生成 OpenAPI 3.0 规范
 */
export class OpenApiGenerator {
  private readonly title: string;
  private readonly version: string;
  private readonly description: string;
  private readonly enableSwaggerUi: boolean;
  private readonly paths: Record<string, unknown> = {};
  private readonly components: Record<string, unknown> = {
    schemas: {},
    securitySchemes: {},
  };

  constructor(options: OpenApiRouteOptions = {}) {
    this.title = options.title ?? 'ClawKit API';
    this.version = options.version ?? '1.0.0';
    this.description = options.description ?? 'ClawKit 控制器服务 API 文档';
    this.enableSwaggerUi = options.enableSwaggerUi ?? true;
  }

  /**
   * 添加 API 路径（路由）
   */
  addPath(method: string, path: string, operation: {
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: unknown[];
    requestBody?: unknown;
    responses?: Record<string, unknown>;
    security?: unknown[];
  }): void {
    const pathKey = path.startsWith('/') ? path : `/${path}`;
    
    if (!this.paths[pathKey]) {
      this.paths[pathKey] = {};
    }

    (this.paths[pathKey] as Record<string, unknown>)[method.toLowerCase()] = {
      summary: operation.summary,
      description: operation.description,
      tags: operation.tags,
      parameters: operation.parameters,
      requestBody: operation.requestBody,
      responses: operation.responses,
      security: operation.security,
    };
  }

  /**
   * 添加 Schema 定义
   */
  addSchema(name: string, schema: unknown): void {
    (this.components.schemas as Record<string, unknown>)[name] = schema;
  }

  /**
   * 添加安全方案
   */
  addSecurityScheme(name: string, scheme: unknown): void {
    (this.components.securitySchemes as Record<string, unknown>)[name] = scheme;
  }

  /**
   * 生成完整的 OpenAPI 文档
   */
  generate(): unknown {
    return {
      openapi: '3.0.3',
      info: {
        title: this.title,
        version: this.version,
        description: this.description,
        contact: {
          name: 'ClawKit Team',
          url: 'https://github.com/clawkit/clawkit',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: '/',
          description: '当前服务器',
        },
      ],
      paths: this.paths,
      components: this.components,
      tags: [
        { name: 'tasks', description: '任务管理' },
        { name: 'drafts', description: '草稿管理' },
        { name: 'approval', description: '审批流程' },
        { name: 'workers', description: 'Worker 管理' },
        { name: 'dispatches', description: '任务派发' },
        { name: 'health', description: '健康检查' },
        { name: 'overview', description: '总览信息' },
        { name: 'manifest', description: '配置管理' },
        { name: 'system', description: '系统管理' },
        { name: 'metrics', description: '指标监控' },
      ],
    };
  }
}

// 默认的 API Schema 定义
export const API_SCHEMAS = {
  // 通用响应
  ApiResponse: {
    type: 'object',
    properties: {
      code: { type: 'string', description: '响应代码' },
      message: { type: 'string', description: '响应消息' },
      data: { type: 'object', description: '响应数据' },
    },
  },
  ErrorResponse: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      error: { type: 'string' },
    },
  },
  PaginationInfo: {
    type: 'object',
    properties: {
      page: { type: 'integer', description: '当前页码' },
      pageSize: { type: 'integer', description: '每页数量' },
      total: { type: 'integer', description: '总数' },
      totalPages: { type: 'integer', description: '总页数' },
    },
  },
  PaginationResponse: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          items: { type: 'array', items: {} },
          pagination: { $ref: '#/components/schemas/PaginationInfo' },
        },
      },
    },
  },

  // 任务相关
  TaskStatus: {
    type: 'string',
    enum: ['draft', 'pending_approval', 'approved', 'rejected', 'executing', 'completed', 'failed', 'cancelled'],
  },
  TaskPriority: {
    type: 'string',
    enum: ['urgent', 'high', 'normal', 'low'],
  },
  Task: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '任务 ID' },
      projectKey: { type: 'string', description: '项目标识' },
      intent: { type: 'string', description: '任务意图' },
      status: { $ref: '#/components/schemas/TaskStatus' },
      priority: { $ref: '#/components/schemas/TaskPriority' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateTaskRequest: {
    type: 'object',
    required: ['text'],
    properties: {
      text: { type: 'string', description: '任务描述文本' },
    },
  },

  // 草稿相关
  DraftStatus: {
    type: 'string',
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
  },
  Draft: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '草稿 ID' },
      taskId: { type: 'string', description: '关联任务 ID' },
      content: { type: 'string', description: '草稿内容' },
      status: { $ref: '#/components/schemas/DraftStatus' },
      version: { type: 'integer', description: '版本号' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  // Worker 相关
  WorkerStatus: {
    type: 'string',
    enum: ['online', 'offline', 'busy', 'error'],
  },
  Worker: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Worker ID' },
      name: { type: 'string', description: 'Worker 名称' },
      status: { $ref: '#/components/schemas/WorkerStatus' },
      tags: { type: 'array', items: { type: 'string' } },
      supportedProjects: { type: 'array', items: { type: 'string' } },
      lastHeartbeat: { type: 'string', format: 'date-time' },
    },
  },

  // 健康检查
  HealthStatus: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
      timestamp: { type: 'string', format: 'date-time' },
      uptime: { type: 'number', description: '运行时间（秒）' },
      checks: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },

  // 指标相关
  MetricPoint: {
    type: 'object',
    properties: {
      timestamp: { type: 'string', format: 'date-time' },
      value: { type: 'number' },
      labels: { type: 'object', additionalProperties: { type: 'string' } },
    },
  },
  MetricSeries: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      unit: { type: 'string' },
      type: { type: 'string', enum: ['gauge', 'counter', 'histogram', 'summary'] },
      points: { type: 'array', items: { $ref: '#/components/schemas/MetricPoint' } },
    },
  },

  // 系统信息
  SystemInfo: {
    type: 'object',
    properties: {
      version: { type: 'string', description: '版本号' },
      platform: { type: 'string', description: '平台' },
      arch: { type: 'string', description: '架构' },
      nodeVersion: { type: 'string', description: 'Node.js 版本' },
      uptime: { type: 'number', description: '运行时间' },
      memory: {
        type: 'object',
        properties: {
          rss: { type: 'number' },
          heapTotal: { type: 'number' },
          heapUsed: { type: 'number' },
          external: { type: 'number' },
        },
      },
    },
  },

  // Manifest 配置
  Manifest: {
    type: 'object',
    description: '部署配置清单',
    properties: {
      profile: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
      nodes: { type: 'object', description: '节点配置' },
      services: { type: 'object', description: '服务配置' },
      workers: { type: 'array', items: {}, description: 'Worker 配置' },
    },
  },
};

// 安全方案定义
export const SECURITY_SCHEMES = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: '使用 JWT Token 进行认证',
  },
  apiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: '使用 API Key 进行认证',
  },
};

/**
 * 构建 OpenAPI 路由
 */
export function buildOpenApiRoutes(options: OpenApiRouteOptions = {}): FastifyPluginAsync {
  return async (app: FastifyInstance): Promise<void> => {
    const generator = new OpenApiGenerator(options);

    // 注册默认 Schema
    for (const [name, schema] of Object.entries(API_SCHEMAS)) {
      generator.addSchema(name, schema);
    }

    // 注册安全方案
    for (const [name, scheme] of Object.entries(SECURITY_SCHEMES)) {
      generator.addSecurityScheme(name, scheme);
    }

    // 添加核心 API 路径定义
    addCorePaths(generator);

    // 获取 OpenAPI JSON 文档
    app.get('/openapi.json', async () => {
      return generator.generate();
    });

    // 获取 OpenAPI YAML 文档
    app.get('/openapi.yaml', async (request, reply) => {
      const spec = generator.generate();
      const yamlContent = toYaml(spec);
      reply.type('application/x-yaml').send(yamlContent);
    });

    // Swagger UI
    if (options.enableSwaggerUi) {
      // Swagger UI HTML
      app.get('/docs', async (request, reply) => {
        reply.type('text/html').send(getSwaggerUiHtml(options.title ?? 'ClawKit API'));
      });

      // Swagger UI 静态资源（使用 CDN）
      app.get('/docs/assets/*', async (request, reply) => {
        const assetPath = (request.params as { '*': string })['*'];
        const cdnUrl = `https://unpkg.com/swagger-ui-dist@5.9.0/${assetPath}`;
        
        try {
          const response = await fetch(cdnUrl);
          if (response.ok) {
            const content = await response.text();
            const contentType = assetPath.endsWith('.js') ? 'application/javascript' : 'text/css';
            reply.type(contentType).send(content);
          } else {
            reply.status(404).send('Not found');
          }
        } catch {
          reply.status(500).send('Failed to fetch asset');
        }
      });
    }

    // API 文档根路径重定向
    app.get('/', async (request, reply) => {
      reply.redirect('/docs');
    });
  };
}

/**
 * 添加核心 API 路径定义
 */
function addCorePaths(generator: OpenApiGenerator): void {
  // 任务列表
  generator.addPath('GET', '/api/tasks', {
    summary: '获取任务列表',
    tags: ['tasks'],
    parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
      { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
      { name: 'status', in: 'query', schema: { type: 'string' } },
      { name: 'projectKey', in: 'query', schema: { type: 'string' } },
    ],
    responses: {
      '200': {
        description: '成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/PaginationResponse' },
          },
        },
      },
    },
  });

  // 创建任务
  generator.addPath('POST', '/api/tasks', {
    summary: '创建任务',
    tags: ['tasks'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CreateTaskRequest' },
        },
      },
    },
    responses: {
      '201': { description: '创建成功' },
    },
  });

  // 获取任务详情
  generator.addPath('GET', '/api/tasks/{taskId}', {
    summary: '获取任务详情',
    tags: ['tasks'],
    parameters: [
      { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: {
      '200': { description: '成功' },
      '404': { description: '任务不存在' },
    },
  });

  // 获取任务状态
  generator.addPath('GET', '/api/tasks/{taskId}/status', {
    summary: '获取任务状态',
    tags: ['tasks'],
    parameters: [
      { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } },
    ],
    responses: {
      '200': { description: '成功' },
    },
  });

  // 健康检查
  generator.addPath('GET', '/api/health', {
    summary: '健康检查',
    tags: ['health'],
    responses: {
      '200': {
        description: '健康',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/HealthStatus' },
          },
        },
      },
    },
  });

  // Worker 列表
  generator.addPath('GET', '/api/workers', {
    summary: '获取 Worker 列表',
    tags: ['workers'],
    responses: {
      '200': {
        description: '成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                workers: { type: 'array', items: { $ref: '#/components/schemas/Worker' } },
              },
            },
          },
        },
      },
    },
  });

  // 系统信息
  generator.addPath('GET', '/api/system/info', {
    summary: '获取系统信息',
    tags: ['system'],
    responses: {
      '200': {
        description: '成功',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SystemInfo' },
          },
        },
      },
    },
  });

  // 指标数据
  generator.addPath('GET', '/api/metrics', {
    summary: '获取指标数据',
    tags: ['metrics'],
    parameters: [
      { name: 'name', in: 'query', schema: { type: 'string' } },
      { name: 'start', in: 'query', schema: { type: 'string', format: 'date-time' } },
      { name: 'end', in: 'query', schema: { type: 'string', format: 'date-time' } },
    ],
    responses: {
      '200': {
        description: '成功',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                metrics: { type: 'array', items: { $ref: '#/components/schemas/MetricSeries' } },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * 简单的 YAML 转换（不支持复杂结构）
 */
function toYaml(obj: unknown): string {
  const lines: string[] = [];
  
  function formatValue(value: unknown, indent = 0): string {
    const spaces = '  '.repeat(indent);
    
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      return value.includes('\n') ? `'${value.replace(/'/g, "''")}'` : `'${value}'`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      return value.map((v) => `${spaces}- ${formatValue(v, indent + 1)}`).join('\n');
    }
    
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return '{}';
      return entries.map(([k, v]) => `${spaces}${k}: ${formatValue(v, indent + 1)}`).join('\n');
    }
    
    return String(value);
  }
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    lines.push(`${key}: ${formatValue(value, 0)}`);
  }
  
  return lines.join('\n');
}

/**
 * 获取 Swagger UI HTML
 */
function getSwaggerUiHtml(title: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - API 文档</title>
  <link rel="stylesheet" href="/docs/assets/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/docs/assets/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        docExpansion: "list",
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        onComplete: function() {
          console.log("Swagger UI loaded");
        }
      });
    };
  </script>
</body>
</html>`;
}

// API 文档生成完成
