/**
 * 官方插件注册表
 * 所有官方插件的元数据和默认配置
 */

import type { MarketplaceEntry } from './plugin-marketplace.service';

/**
 * 官方插件列表
 */
export const OFFICIAL_PLUGINS: MarketplaceEntry[] = [
  // ========== 执行器插件 ==========
  {
    meta: {
      name: 'simple-executor',
      version: '1.0.0',
      type: 'executor',
      description: '一个简单的命令执行器插件，支持基本的 Shell 命令执行',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/simple-executor',
    installed: false,
    downloads: 1000,
    publishedAt: Date.parse('2026-07-12'),
    updatedAt: Date.parse('2026-07-12'),
    description: 'Simple Executor 是一个轻量级的执行器插件，适合运行简单的 Shell 命令。它提供基本的命令执行能力，支持超时控制和输出捕获。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['executor', 'shell', 'command'],
    rating: 4.5,
  },
  {
    meta: {
      name: 'custom-script-executor',
      version: '1.0.0',
      type: 'executor',
      description: '自定义脚本执行器，支持 Shell、Python、Node.js 等多种脚本类型',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/custom-script-executor',
    installed: false,
    downloads: 800,
    publishedAt: Date.parse('2026-07-12'),
    updatedAt: Date.parse('2026-07-12'),
    description: 'Custom Script Executor 是一个功能强大的脚本执行器插件，支持多种脚本语言（Shell、Python、Node.js、Ruby、PHP、Go 等）。提供变量替换、命令安全检查、超时控制等高级功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['executor', 'script', 'shell', 'python', 'nodejs'],
    rating: 4.8,
  },
  {
    meta: {
      name: 'claude-code-executor',
      version: '1.0.0',
      type: 'executor',
      description: 'Claude Code CLI 执行器，支持本地和远程 Claude Code API',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/claude-code-executor',
    installed: false,
    downloads: 1500,
    publishedAt: Date.parse('2026-08-01'),
    updatedAt: Date.parse('2026-08-01'),
    description: 'Claude Code Executor 通过 Claude Code CLI 或 API 执行 AI 编程任务。支持多种模型（Sonnet、Opus、Haiku）、代码生成、审查、重构等功能，是 Claude Code 生态的核心执行器。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['executor', 'claude', 'anthropic', 'ai', 'coding', 'opencode'],
    rating: 4.9,
  },
  {
    meta: {
      name: 'github-actions',
      version: '1.0.0',
      type: 'executor',
      description: 'GitHub Actions 集成，支持触发、监控和管理 workflow',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/github-actions',
    installed: false,
    downloads: 950,
    publishedAt: Date.parse('2026-08-03'),
    updatedAt: Date.parse('2026-08-03'),
    description: 'GitHub Actions Executor 与 GitHub Actions 深度集成，支持通过 API 触发 workflow、监控运行状态、获取日志、取消/重新运行等操作，是 CI/CD 自动化的核心组件。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['executor', 'github', 'actions', 'ci', 'cd', 'workflow', 'automation'],
    rating: 4.8,
  },

  // ========== 通知器插件 ==========
  {
    meta: {
      name: 'dingtalk-notifier',
      version: '1.0.0',
      type: 'notifier',
      description: '钉钉 Webhook 通知器，支持 Markdown 消息和 @ 成员',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/dingtalk-notifier',
    installed: false,
    downloads: 1500,
    publishedAt: Date.parse('2026-07-12'),
    updatedAt: Date.parse('2026-07-12'),
    description: 'DingTalk Notifier 允许你将 ClawKit 的任务状态通知发送到钉钉群。支持 Markdown 格式、@ 成员、签名验证等功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['notifier', 'dingtalk', 'webhook', 'notification'],
    rating: 4.6,
  },
  {
    meta: {
      name: 'feishu-notifier',
      version: '1.0.0',
      type: 'notifier',
      description: '飞书 Webhook 通知器，支持文本、卡片等多种消息类型',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/feishu-notifier',
    installed: false,
    downloads: 1200,
    publishedAt: Date.parse('2026-07-29'),
    updatedAt: Date.parse('2026-07-29'),
    description: 'Feishu (Lark) Notifier 允许你将 ClawKit 的任务状态通知发送到飞书群。支持富文本消息、卡片消息、@ 成员、签名验证等功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['notifier', 'feishu', 'lark', 'webhook', 'notification'],
    rating: 4.7,
  },
  {
    meta: {
      name: 'email-notifier',
      version: '1.0.0',
      type: 'notifier',
      description: '邮件通知器，支持通过 SMTP 发送精美的 HTML 邮件',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/email-notifier',
    installed: false,
    downloads: 900,
    publishedAt: Date.parse('2026-07-29'),
    updatedAt: Date.parse('2026-07-29'),
    description: 'Email Notifier 通过 SMTP 服务器发送精美的 HTML 邮件通知。支持多种邮件服务商（QQ 企业邮箱、网易企业邮箱、Gmail 等），提供美观的邮件模板。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['notifier', 'email', 'smtp', 'notification'],
    rating: 4.4,
  },
  {
    meta: {
      name: 'slack-notifier',
      version: '1.0.0',
      type: 'notifier',
      description: 'Slack Webhook 通知器，支持 Block Kit UI 组件和交互式消息',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/slack-notifier',
    installed: false,
    downloads: 750,
    publishedAt: Date.parse('2026-07-29'),
    updatedAt: Date.parse('2026-07-29'),
    description: 'Slack Notifier 通过 Slack Webhook 发送通知消息。支持 Block Kit UI 组件、交互式按钮、emoji 表情等功能，让你的通知更加生动。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['notifier', 'slack', 'webhook', 'block-kit', 'notification'],
    rating: 4.5,
  },
  {
    meta: {
      name: 'wework-notifier',
      version: '1.0.0',
      type: 'notifier',
      description: '企业微信 Webhook 通知器，支持 Markdown 消息和 @成员',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/wework-notifier',
    installed: false,
    downloads: 850,
    publishedAt: Date.parse('2026-08-03'),
    updatedAt: Date.parse('2026-08-03'),
    description: 'WeWork Notifier 通过企业微信 Webhook 发送通知消息。支持 Markdown、文本、图文、模板卡片等多种消息类型，提供 @成员、签名验证等企业级功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['notifier', 'wework', 'wecom', 'webhook', 'notification', '企业微信'],
    rating: 4.7,
  },

  // ========== 触发器插件 ==========
  {
    meta: {
      name: 'gitlab-trigger',
      version: '1.0.0',
      type: 'trigger',
      description: 'GitLab Webhook 触发器，支持 Push、MR、Pipeline 等事件',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/gitlab-trigger',
    installed: false,
    downloads: 1100,
    publishedAt: Date.parse('2026-07-12'),
    updatedAt: Date.parse('2026-07-12'),
    description: 'GitLab Trigger 监听 GitLab Webhook 事件来触发 ClawKit 任务。支持 Push、Merge Request、Pipeline、Tag Push 等多种事件类型，提供项目和分支过滤功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['trigger', 'gitlab', 'webhook', 'ci', 'cd'],
    rating: 4.7,
  },
  {
    meta: {
      name: 'jenkins-trigger',
      version: '1.0.0',
      type: 'trigger',
      description: 'Jenkins Webhook 触发器，支持 Build、Pipeline 等事件',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/jenkins-trigger',
    installed: false,
    downloads: 850,
    publishedAt: Date.parse('2026-07-29'),
    updatedAt: Date.parse('2026-07-29'),
    description: 'Jenkins Trigger 监听 Jenkins 构建事件来触发 ClawKit 任务。支持 Generic Webhook 和 GitHub PR 评论触发，提供 Job 和构建结果过滤功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['trigger', 'jenkins', 'webhook', 'ci', 'cd'],
    rating: 4.3,
  },
  {
    meta: {
      name: 'http-webhook-trigger',
      version: '1.0.0',
      type: 'trigger',
      description: '通用 HTTP Webhook 触发器，支持接收和处理任意 HTTP Webhook',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/http-webhook-trigger',
    installed: false,
    downloads: 950,
    publishedAt: Date.parse('2026-07-29'),
    updatedAt: Date.parse('2026-07-29'),
    description: 'HTTP Webhook Trigger 是一个通用的 Webhook 触发器，可以接收和处理任意 HTTP Webhook 请求。支持签名验证、路径过滤、自定义解析器等功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['trigger', 'webhook', 'http', 'api'],
    rating: 4.6,
  },
  {
    meta: {
      name: 'sentry-trigger',
      version: '1.0.0',
      type: 'trigger',
      description: 'Sentry Webhook 触发器，支持 Error、Issue、Performance 等事件',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/sentry-trigger',
    installed: false,
    downloads: 700,
    publishedAt: Date.parse('2026-07-29'),
    updatedAt: Date.parse('2026-07-29'),
    description: 'Sentry Trigger 监听 Sentry 的告警事件来触发 ClawKit 任务。支持 Error、Issue、Performance 等事件类型，提供项目过滤、级别过滤、用户数和次数阈值等高级功能。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['trigger', 'sentry', 'webhook', 'error', 'monitoring'],
    rating: 4.4,
  },
  {
    meta: {
      name: 'cron-trigger',
      version: '1.0.0',
      type: 'trigger',
      description: 'Cron 定时触发器，支持基于 Cron 表达式的定时任务',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/cron-trigger',
    installed: false,
    downloads: 600,
    publishedAt: Date.parse('2026-08-03'),
    updatedAt: Date.parse('2026-08-03'),
    description: 'Cron Trigger 支持基于 Cron 表达式的定时任务触发。提供标准 5 字段和扩展 6 字段格式支持、时区配置、任务管理等功能，适用于周期性任务调度场景。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['trigger', 'cron', 'schedule', 'timer', '定时任务'],
    rating: 4.6,
  },
  {
    meta: {
      name: 'github-trigger',
      version: '1.0.0',
      type: 'trigger',
      description: 'GitHub Webhook 触发器，支持 Push、PR、Release、Workflow 等事件',
      author: 'ClawKit Team',
      homepage: 'https://github.com/clawkit/clawkit',
    },
    source: 'examples/plugins/github-trigger',
    installed: false,
    downloads: 1300,
    publishedAt: Date.parse('2026-08-01'),
    updatedAt: Date.parse('2026-08-01'),
    description: 'GitHub Trigger 监听 GitHub Webhook 事件来触发 ClawKit 任务。支持 Push、Pull Request、Issue、Release、Check Run、Workflow Run 等多种事件类型，提供仓库、分支、Action 级别的精细过滤。',
    author: {
      name: 'ClawKit Team',
      email: 'team@clawkit.dev',
      homepage: 'https://github.com/clawkit',
    },
    license: 'MIT',
    keywords: ['trigger', 'github', 'webhook', 'ci', 'cd', 'actions', 'pull-request'],
    rating: 4.8,
  },
];

/**
 * 按类型分组插件
 */
export function getPluginsByType(type: string): MarketplaceEntry[] {
  return OFFICIAL_PLUGINS.filter(p => p.meta.type === type);
}

/**
 * 按名称获取插件
 */
export function getPluginByName(name: string): MarketplaceEntry | undefined {
  return OFFICIAL_PLUGINS.find(p => p.meta.name === name);
}

/**
 * 获取插件总数
 */
export function getPluginCount(): { total: number; executors: number; notifiers: number; triggers: number } {
  return {
    total: OFFICIAL_PLUGINS.length,
    executors: OFFICIAL_PLUGINS.filter(p => p.meta.type === 'executor').length,
    notifiers: OFFICIAL_PLUGINS.filter(p => p.meta.type === 'notifier').length,
    triggers: OFFICIAL_PLUGINS.filter(p => p.meta.type === 'trigger').length,
  };
}
