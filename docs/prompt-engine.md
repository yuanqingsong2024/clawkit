# PromptEngine 使用文档

## 1. 概述

`PromptEngine` 是 controller 中负责生成 Prompt 草案的抽象接口。

当前在**配置与设计层**预留三种模式：
- **template**：使用内置模板生成 Prompt，不调用外部 LLM（当前阶段已实现）
- **llm**：调用外部 LLM 生成 Prompt（仅配置与接口预留，未实现）
- **hybrid**：混合模式，结合模板和 LLM（仅配置与接口预留，未实现）

当前阶段只实现了 template 模式。

## 2. 接口定义

```typescript
export interface BuildPromptDraftInput {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory | null;
}

export interface PromptEngine {
  buildPromptDraft(input: BuildPromptDraftInput): Promise<PromptDraft>;
}
```

## 2. 运行模式

### 2.1 Template 模式（已实现）

使用内置模板生成 Prompt，不调用外部 LLM。

**特点**：
- 快速、稳定、无外部依赖
- 基于固定模板和规则生成
- 适合标准化任务

**实现类**：`TemplatePromptEngine`

**配置示例**：
```yaml
runtime:
  promptEngine:
    mode: template
    # template 模式不需要其他配置
```

### 2.2 LLM 模式（预留）

调用外部 LLM（如 OpenAI、Anthropic）生成 Prompt。

**特点**：
- 灵活、智能、可优化
- 需要外部 API 调用
- 适合复杂、非标准化任务

**配置示例**：
```yaml
runtime:
  promptEngine:
    mode: llm
    provider: openai
    model: gpt-4
    apiKeyEnv: OPENAI_API_KEY
    baseUrl: https://api.openai.com/v1  # 可选
    temperature: 0.7
    maxTokens: 4096
    timeoutMs: 30000
    fallback:  # 可选
      provider: anthropic
      model: claude-3-sonnet
      apiKeyEnv: ANTHROPIC_API_KEY
```

### 2.3 Hybrid 模式（预留）

结合模板和 LLM，先用模板生成基础 Prompt，再用 LLM 优化。

**特点**：
- 兼顾速度和质量
- 模板保证基础结构，LLM 优化细节
- 适合需要一定灵活性的标准化任务

**配置示例**：
```yaml
runtime:
  promptEngine:
    mode: hybrid
    provider: openai
    model: gpt-4
    apiKeyEnv: OPENAI_API_KEY
    temperature: 0.5
    maxTokens: 2048
    timeoutMs: 20000
```


## 3. 输入说明

### BuildPromptDraftInput

- `taskDraft`: 任务草稿，包含任务的基本信息
  - `taskId`: 任务唯一标识
  - `sourceText`: 原始需求文本
  - `projectKey`: 所属项目标识
  - `intent`: 任务意图
  - `constraints`: 约束条件列表
  - `acceptanceCriteria`: 验收标准列表
  - `status`: 当前任务状态
  - `createdAt`: 创建时间
  - `updatedAt`: 更新时间

- `taskMemory`: 任务记忆（可选），包含历史信息
  - `normalizedTaskCard`: 标准化任务卡片
  - `promptDraftHistory`: Prompt 草案历史
  - `userRevisionHistory`: 用户修订历史
  - `executionSummary`: 执行总结
  - `similarTaskRefs`: 相似任务引用
  - `projectRuleRefs`: 项目规则引用

## 4. 输出说明

### PromptDraft

生成的 Prompt 草案包含：

- `version`: 结构化版本号
  - `generation`: 主版本号（重新生成时递增）
  - `revision`: 修订号（小修改时递增）
- `taskId`: 所属任务标识
- `projectKey`: 所属项目标识
- `draftText`: 完整提示词草案文本
- `summaryView`: 给人工确认使用的摘要视图
  - `goal`: 目标
  - `scope`: 范围
  - `constraints`: 约束
  - `acceptanceCriteria`: 验收标准
- `confirmationChecklist`: 确认清单
- `riskFlags`: 风险标记列表
- `createdAt`: 草案生成时间

## 5. 使用示例

### 5.1 基础使用

```typescript
import { TemplatePromptEngine } from '@clawkit/controller';

// 使用 TemplatePromptEngine
const engine = new TemplatePromptEngine();

// 准备输入
const input: BuildPromptDraftInput = {
  taskDraft: {
    taskId: 'clawkit-abc123',
    sourceText: '#研发任务\n项目: clawkit\n目标: 实现任务协议解析',
    projectKey: 'clawkit',
    intent: '实现任务协议解析',
    constraints: ['不进入真实派发', '全部使用中文'],
    acceptanceCriteria: ['五种协议可解析', '非法输入有中文报错'],
    status: TaskStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  taskMemory: null, // 首次生成时可能没有记忆
};

// 生成 Prompt 草案
const promptDraft = await engine.buildPromptDraft(input);

console.log('生成的 Prompt 草案:');
console.log('版本:', `${promptDraft.version.generation}.${promptDraft.version.revision}`);
console.log('目标:', promptDraft.summaryView.goal);
console.log('范围:', promptDraft.summaryView.scope);
console.log('风险标记:', promptDraft.riskFlags);
```

### 5.2 带任务记忆的使用

```typescript
// 准备带记忆的输入
const inputWithMemory: BuildPromptDraftInput = {
  taskDraft: {
    taskId: 'clawkit-abc123',
    sourceText: '#研发任务\n项目: clawkit\n目标: 实现任务协议解析',
    projectKey: 'clawkit',
    intent: '实现任务协议解析',
    constraints: ['不进入真实派发', '全部使用中文'],
    acceptanceCriteria: ['五种协议可解析', '非法输入有中文报错'],
    status: TaskStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  taskMemory: {
    taskId: 'clawkit-abc123',
    normalizedTaskCard: {
      title: '实现任务协议解析',
      objective: '实现任务协议解析',
      scope: ['实现任务协议解析', '全部使用中文'],
      outOfScope: [],
      constraints: ['不进入真实派发', '全部使用中文'],
      acceptanceCriteria: ['五种协议可解析', '非法输入有中文报错'],
    },
    promptDraftHistory: [
      {
        version: { generation: 1, revision: 0 },
        summary: '首次生成的 Prompt 草案',
        createdAt: new Date('2026-03-10T08:00:00Z'),
      },
    ],
    userRevisionHistory: [
      {
        revisionId: 'rev-001',
        operator: 'user@example.com',
        comment: '需要补充错误处理说明',
        targetVersion: { generation: 1, revision: 0 },
        createdAt: new Date('2026-03-10T09:00:00Z'),
      },
    ],
    executionSummary: null,
    similarTaskRefs: [],
    projectRuleRefs: [],
    createdAt: new Date('2026-03-10T08:00:00Z'),
    updatedAt: new Date('2026-03-10T09:00:00Z'),
  },
};

// 生成新版本的 Prompt 草案
const newPromptDraft = await engine.buildPromptDraft(inputWithMemory);

// 新版本应该考虑用户的修订意见
console.log('新版本:', `${newPromptDraft.version.generation}.${newPromptDraft.version.revision}`);
```

## 6. 实现指南

### 6.1 实现要求

实现 `PromptEngine` 接口时应该：

1. **考虑任务记忆**：如果提供了 `taskMemory`，应该参考历史信息
2. **生成摘要视图**：`summaryView` 应该清晰、可读，便于人工确认
3. **标记风险**：识别潜在风险并添加到 `riskFlags`
4. **版本管理**：正确设置 `version.generation` 和 `version.revision`

### 6.2 版本号规则

- `generation`（主版本号）：
  - Schema 已预留该字段，用于表达重新生成轮次
  - 当前阶段实现尚未引入新的 generation 递增入口，默认沿用已有 generation
  
- `revision`（修订号）：
  - 同一 generation 内的小修改时递增
  - 当前 TemplatePromptEngine 已实现该递增策略

### 6.3 风险标记示例

常见的风险标记包括：

- `"scope_too_broad"`: 范围过大
- `"constraints_may_conflict"`: 约束可能冲突
- `"acceptance_unclear"`: 验收标准不清晰
- `"missing_context"`: 缺少上下文信息
- `"technical_complexity_high"`: 技术复杂度高

## 7. 当前阶段实现
**当前阶段已实现 template 模式**。
已实现：
- ✅ TemplatePromptEngine：基于内置模板生成 PromptDraft
- ✅ PromptCompiler：编译任务草稿为结构化 Prompt
- ✅ 版本号管理：首次生成使用 `1.0`，后续在同一 generation 内递增 revision
- ✅ 风险标记识别：自动识别常见风险
- ✅ 输出契约注入：固定格式的输出契约
未实现（预留接口）：
- ❌ LLM 模式：调用外部 LLM API
- ❌ Hybrid 模式：混合模板和 LLM
- ❌ 自定义模板：可配置的 Prompt 模板
- ❌ 上下文优化：智能选择历史信息

## 8. 使用 TemplatePromptEngine
### 8.1 基础使用
```typescript
import { TemplatePromptEngine } from '@clawkit/controller';
const engine = new TemplatePromptEngine();
const promptDraft = await engine.buildPromptDraft({
  taskDraft,
  taskMemory: null,
});
```
### 8.2 自定义 PromptCompiler
```typescript
import { TemplatePromptEngine, PromptCompilerImpl } from '@clawkit/controller';
// 使用自定义 compiler
const customCompiler = new PromptCompilerImpl();
const engine = new TemplatePromptEngine(customCompiler);
```
### 8.3 与 PromptDraftService 集成
```typescript
import { PromptDraftServiceImpl, TemplatePromptEngine } from '@clawkit/controller';
const engine = new TemplatePromptEngine();
const service = new PromptDraftServiceImpl(engine);
const promptDraft = await service.buildPromptDraft({
  taskDraft,
  taskMemory,
});
```
## 9. 后续扩展方向
未来可能的扩展包括：
1. **LLM 模式实现**：支持 OpenAI、Anthropic 等 LLM 后端
2. **Hybrid 模式实现**：结合模板和 LLM 的混合模式
3. **自定义模板**：支持可配置的 Prompt 模板
4. **上下文优化**：智能选择相关的历史信息
5. **质量评估**：自动评估生成的 Prompt 质量
6. **A/B 测试**：支持多个 Prompt 版本对比
