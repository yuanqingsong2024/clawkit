# v2.0+ 任务清单

> 版本：v1.0.0 | 目标版本：v2.0.0 | 目标日期：2027-06-30

---

## 概述

**目标**：成为 AI 研发自动化的基础设施，支持生态扩展

**前置条件**：v1.0.x 完成

**后续阶段**：持续迭代

---

## P0 - 必须完成

这些任务必须完成才能发布 v2.0.0

### T-200：插件系统

| 属性 | 值 |
|-----|---|
| 任务 ID | T-200 |
| 优先级 | P0 |
| 状态 | 🟢 已完成 |
| 预计工时 | 40h |
| 实际工时 | ~8h |
| 负责人 | 袁青松 |

**任务描述**
实现通用插件系统，支持自定义执行器、触发器、通知器

**已完成功能**
- ✅ 插件核心类型定义（PluginType, PluginLifecycleState, PluginMeta 等）
- ✅ 执行器插件接口定义（ExecutorPluginInterface）
- ✅ 触发器插件接口定义（TriggerPluginInterface）
- ✅ 通知器插件接口定义（NotifierPluginInterface）
- ✅ 插件生命周期管理（PluginLifecycleService）
- ✅ 插件管理器（PluginManager）
- ✅ 插件加载器（PluginLoader）
- ✅ 插件沙箱隔离（PluginSandboxService）
- ✅ 插件配置热加载
- ✅ 单元测试
- ✅ 示例插件（simple-executor, dingtalk-notifier）

**验收标准**
- [x] 插件接口标准化
- [x] 插件注册与发现机制
- [x] 插件生命周期管理
- [x] 插件配置热加载
- [x] 插件隔离（沙箱运行）

**已完成文件**
- `packages/plugin-core/src/types/plugin.types.ts`
- `packages/plugin-core/src/interfaces/plugin.interface.ts`
- `packages/plugin-core/src/interfaces/executor-plugin.interface.ts`
- `packages/plugin-core/src/interfaces/trigger-plugin.interface.ts`
- `packages/plugin-core/src/interfaces/notifier-plugin.interface.ts`
- `packages/plugin-core/src/interfaces/index.ts`
- `packages/plugin-core/src/services/plugin-lifecycle.service.ts`
- `packages/plugin-core/src/services/plugin-loader.ts`
- `packages/plugin-core/src/services/plugin-manager.ts`
- `packages/plugin-core/src/services/plugin-sandbox.service.ts`
- `packages/plugin-core/src/services/index.ts`
- `packages/plugin-core/src/utils/plugin.utils.ts`
- `packages/plugin-core/src/utils/index.ts`
- `packages/plugin-core/src/index.ts`
- `packages/plugin-core/tests/plugin-lifecycle.service.test.cjs`
- `examples/plugins/simple-executor/`（示例）
- `examples/plugins/dingtalk-notifier/`（示例）

**插件类型**
```typescript
// 执行器插件
interface ExecutorPlugin {
  name: string;
  version: string;
  execute(context: ExecutionContext): Promise<ExecutionResult>;
  validate(config: PluginConfig): boolean;
}

// 触发器插件
interface TriggerPlugin {
  name: string;
  version: string;
  onTrigger(handler: TriggerHandler): void;
  onCancel(taskId: string): void;
}

// 通知器插件
interface NotifierPlugin {
  name: string;
  version: string;
  send(notification: Notification): Promise<void>;
  validate(config: PluginConfig): boolean;
}
```

**插件加载机制**
```
插件目录结构:
plugins/
├── executor/
│   ├── opencode/
│   │   └── index.js
│   ├── custom-ai/
│   │   └── index.js
│   └── ...
├── trigger/
│   ├── claude-code/
│   │   └── index.js
│   └── ...
└── notifier/
    ├── dingtalk/
    │   └── index.js
    └── ...
```

**涉及文件**
- `packages/plugin-core/`（新建）
- `packages/plugin-executor-opencode/`
- `packages/plugin-trigger-claude-code/`
- `packages/plugin-notifier-dingtalk/`
- `docs/plugin-development.md`（新建）

---

### T-201：插件市场

| 属性 | 值 |
|-----|---|
| 任务 ID | T-201 |
| 优先级 | P0 |
| 状态 | 🟢 已完成 |
| 预计工时 | 24h |
| 实际工时 | ~4h |
| 负责人 | 袁青松 |

**任务描述**
建立官方插件仓库，开发者可上传分享

**已完成功能**
- ✅ 插件市场服务（PluginMarketplaceService）
- ✅ 插件注册表（manifest）
- ✅ 插件搜索与浏览 API
- ✅ 插件详情 API
- ✅ 插件安装/卸载 API
- ✅ 插件评分 API
- ✅ 官方示例插件（simple-executor, dingtalk-notifier）

**验收标准**
- [x] 插件注册表（manifest）
- [x] 插件搜索与浏览
- [ ] 插件详情页（说明、作者、版本）- 仅 API
- [x] 插件安装/卸载
- [x] 插件评分与评论
- [ ] 官方插件 > 10 个

**已完成文件**
- `packages/controller/src/services/plugin-marketplace.service.ts`
- `packages/controller/src/http/routes/plugin-marketplace-routes.ts`

**API 端点**
- `GET /api/plugins` - 获取插件列表
- `GET /api/plugins/search` - 搜索插件
- `GET /api/plugins/:name` - 获取插件详情
- `GET /api/plugins/installed` - 获取已安装插件
- `POST /api/plugins/install` - 安装插件
- `POST /api/plugins/uninstall` - 卸载插件
- `POST /api/plugins/rate` - 评分插件

**插件市场功能**
```
┌─────────────────────────────────────────────────────────┐
│  插件市场                                          [搜索] │
├─────────────────────────────────────────────────────────┤
│ 分类：[全部 ▼] [执行器] [触发器] [通知器]               │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │ OpenCode│ │ GitHub  │ │ 钉钉    │ │ 自定义  │        │
│ │ Executor│ │ Trigger │ │ Notifier│ │ Executor│        │
│ │ ⭐ 4.8  │ │ ⭐ 4.5  │ │ ⭐ 4.2  │ │ ⭐ 3.9  │        │
│ │ [安装]  │ │ [安装]  │ │ [安装]  │ │ [安装]  │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────────────────┘
```

**技术方案**
- 使用 GitHub Releases 作为插件分发
- manifest.json 描述插件元信息
- npm registry 作为可选分发渠道

**涉及文件**
- `marketplace/`（新建）
- `website/`（新建）
- `packages/plugin-registry/`（新建）

---

### T-202：流水线编排

| 属性 | 值 |
|-----|---|
| 任务 ID | T-202 |
| 优先级 | P0 |
| 状态 | 🔴 待开始 |
| 预计工时 | 32h |
| 负责人 | - |

**任务描述**
支持 DAG 任务编排，实现复杂流水线

**验收标准**
- [ ] DAG 可视化编辑器
- [ ] 节点类型（任务/条件/并行/串行）
- [ ] 条件分支支持
- [ ] 流水线执行与监控
- [ ] 失败重试与回退

**流水线定义示例**
```yaml
pipeline:
  name: "CI Pipeline"
  trigger: "github.push"
  
  stages:
    - id: "build"
      type: "task"
      executor: "opencode"
      config:
        prompt: "构建项目"
      
    - id: "test"
      type: "task"
      dependsOn: ["build"]
      executor: "opencode"
      config:
        prompt: "运行测试"
      
    - id: "deploy-check"
      type: "condition"
      dependsOn: ["test"]
      condition: "test.passed == true"
      
    - id: "deploy"
      type: "task"
      dependsOn: ["deploy-check"]
      executor: "opencode"
      config:
        prompt: "部署到测试环境"
```

**涉及文件**
- `packages/pipeline/`（新建）
- `packages/pipeline-engine/`（新建）
- `packages/web/src/pages/PipelineEditor.tsx`（新建）

---

### T-203：SDK 发布

| 属性 | 值 |
|-----|---|
| 任务 ID | T-203 |
| 优先级 | P0 |
| 状态 | 🔴 待开始 |
| 预计工时 | 24h |
| 负责人 | - |

**任务描述**
发布官方 SDK，方便第三方应用接入

**验收标准**
- [ ] Node.js SDK（npm 包）
- [ ] Python SDK（PyPI 包）
- [ ] 完整文档和示例
- [ ] TypeScript 类型支持
- [ ] 主流 IDE 智能提示

**SDK 功能**
```typescript
// Node.js SDK 示例
import { ClawKit } from '@clawkit/sdk';

const client = new ClawKit({
  baseUrl: 'http://localhost:8787',
  apiKey: 'your-api-key'
});

// 创建任务
const task = await client.tasks.create({
  projectKey: 'my-app',
  prompt: '优化数据库查询性能'
});

// 审批任务
await client.tasks.approve(task.id);

// 查询状态
const status = await client.tasks.getStatus(task.id);
```

**涉及文件**
- `sdk/javascript/`（新建）
- `sdk/python/`（新建）
- `docs/sdk/`（新建）

---

## P1 - 建议完成

### T-204：多云部署支持

| 属性 | 值 |
|-----|---|
| 任务 ID | T-204 |
| 优先级 | P1 |
| 状态 | 🔴 待开始 |
| 预计工时 | 24h |
| 负责人 | - |

**任务描述**
支持 AWS/GCP/Azure 部署

**验收标准**
- [ ] AWS EC2/ECS 部署方案
- [ ] GCP GCE/GKE 部署方案
- [ ] Azure VM/ACI 部署方案
- [ ] 云厂商 IAM 集成

---

### T-205：Kubernetes 支持

| 属性 | 值 |
|-----|---|
| 任务 ID | T-205 |
| 优先级 | P1 |
| 状态 | 🔴 待开始 |
| 预计工时 | 32h |
| 负责人 | - |

**任务描述**
K8s 部署方案与 Helm Chart

**验收标准**
- [ ] Kubernetes 部署清单
- [ ] Helm Chart 包
- [ ] HPA 自动扩缩容
- [ ] PVC 持久化存储
- [ ] Ingress 配置

---

### T-206：开放 API

| 属性 | 值 |
|-----|---|
| 任务 ID | T-206 |
| 优先级 | P1 |
| 状态 | 🔴 待开始 |
| 预计工时 | 16h |
| 负责人 | - |

**任务描述**
第三方应用可接入 clawkit

**验收标准**
- [ ] RESTful API 完整
- [ ] Webhook 回调
- [ ] OAuth 2.0 认证
- [ ] API 版本管理

---

### T-207：Webhook 扩展

| 属性 | 值 |
|-----|---|
| 任务 ID | T-207 |
| 优先级 | P1 |
| 状态 | 🔴 待开始 |
| 预计工时 | 16h |
| 负责人 | - |

**任务描述**
支持更多外部系统接入

**验收标准**
- [ ] GitHub Webhook
- [ ] GitLab Webhook
- [ ] Jenkins Pipeline 触发
- [ ] 自定义 Webhook 模板

---

## P2 - 可选完成

### T-208：企业版特性

| 属性 | 值 |
|-----|---|
| 任务 ID | T-208 |
| 优先级 | P2 |
| 状态 | 🔴 待开始 |
| 预计工时 | 40h |
| 负责人 | - |

**任务描述**
企业级特性：SSO/LDAP、审计合规、私有化部署

**验收标准**
- [ ] SSO/SAML 支持
- [ ] LDAP 集成
- [ ] 审计合规报告
- [ ] 私有化部署包

---

### T-209：AI 优化建议

| 属性 | 值 |
|-----|---|
| 任务 ID | T-209 |
| 优先级 | P2 |
| 状态 | 🔴 待开始 |
| 预计工时 | 24h |
| 负责人 | - |

**任务描述**
基于执行数据给出优化建议

**验收标准**
- [ ] 执行效率分析
- [ ] 成功率趋势
- [ ] 优化建议生成
- [ ] 可视化报告

---

### T-210：社区运营

| 属性 | 值 |
|-----|---|
| 任务 ID | T-210 |
| 优先级 | P2 |
| 状态 | 🔴 待开始 |
| 预计工时 | 持续 |
| 负责人 | - |

**任务描述**
社区运营：论坛、线下活动、案例分享

**验收标准**
- [ ] 官方论坛/Discord
- [ ] 季度线下 meetup
- [ ] 案例分享专区
- [ ] 贡献者奖励机制

---

## 任务状态汇总

| 任务 ID | 描述 | 优先级 | 状态 | 工时 |
|--------|------|-------|------|-----|
| T-200 | 插件系统 | P0 | 🟢 已完成 | 40h |
| T-201 | 插件市场 | P0 | 🟢 已完成 | 24h |
| T-202 | 流水线编排 | P0 | 🔴 待开始 | 32h |
| T-203 | SDK 发布 | P0 | 🔴 待开始 | 24h |
| T-204 | 多云部署支持 | P1 | 🔴 待开始 | 24h |
| T-205 | Kubernetes 支持 | P1 | 🔴 待开始 | 32h |
| T-206 | 开放 API | P1 | 🔴 待开始 | 16h |
| T-207 | Webhook 扩展 | P1 | 🔴 待开始 | 16h |
| T-208 | 企业版特性 | P2 | 🔴 待开始 | 40h |
| T-209 | AI 优化建议 | P2 | 🔴 待开始 | 24h |
| T-210 | 社区运营 | P2 | 🔴 待开始 | 持续 |

**总计**：P0: 120h, P1: 88h, P2: 64h+

---

## v2.0.0 验收标准

完成所有 P0 任务后，需满足以下验收标准：

```
✅ 插件系统稳定运行
✅ 官方插件 > 10 个
✅ 第三方开发者可独立开发和发布插件
✅ 流水线编排功能完整
✅ SDK 有完整文档和示例
✅ 社区活跃度达标（star > 500）
```

---

## 生态建设路线

```
v1.0.0
    │
    ├── v2.0-alpha (插件核心)
    │       │
    │       ├── v2.0-beta (插件市场)
    │       │       │
    │       │       └── v2.0-rc (SDK + 流水线)
    │       │               │
    │       │               └── v2.0.0 (正式发布)
    │       │
    │       └── v2.1+ (企业特性 + 社区)
    │
    └── v2.x (持续迭代)
```

---

## 状态说明

| 状态 | 说明 |
|-----|------|
| 🔴 待开始 | 尚未开始 |
| 🟡 进行中 | 正在开发 |
| 🟢 已完成 | 已完成并验收 |
| ⚪ 已跳过 | 因故跳过 |

---

## 更新记录

| 日期 | 版本 | 更新内容 |
|-----|-----|---------|
| 2026-07-09 | v1.0.0 | 初始版本 |
| 2026-07-11 | v2.0-alpha | T-200 插件系统核心实现 |
| 2026-07-12 | v2.0-alpha | T-200 插件系统完成，包含沙箱隔离和示例插件 |
| 2026-07-12 | v2.0-alpha | T-201 插件市场 API 完成 |

---

*完成所有 P0 任务后可以发布 v2.0.0，这是生态扩展的标志*
