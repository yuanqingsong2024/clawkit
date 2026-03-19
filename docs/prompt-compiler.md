# PromptCompiler 使用文档

## 1. 概述

`PromptCompiler` 是 controller 中负责将原始研发任务转成规范化任务卡，并生成待确认提示词草案的核心服务。

它的职责是：
- 将 TaskDraft 和 TaskMemory 编译为结构化的 Prompt
- 生成摘要版 Prompt（给用户确认用）
- 生成执行版 Prompt（供 worker 执行链路使用）
- 注入固定的输出契约

## 2. 接口定义

```typescript
export interface PromptCompilerInput {
  taskDraft: TaskDraft;
  taskMemory: TaskMemory | null;
}

export interface CompiledPrompt {
  /** 摘要版：给用户确认用 */
  summaryVersion: string;
/** 执行版：供 worker 执行链路使用 */
  executionVersion: string;
  /** 输出契约 */
  outputContract: OutputContract;
}

export interface OutputContract {
  completionChecklist: string[];
  modifiedFiles: string[];
  executionCommands: string[];
  testResults: string[];
  risksAndConfirmations: string[];
}

export interface PromptCompiler {
  compile(input: PromptCompilerInput): CompiledPrompt;
}
```

## 3. 输入说明

### PromptCompilerInput

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
    - `title`: 任务标题
    - `objective`: 任务目标
    - `scope`: 实现范围
    - `outOfScope`: 明确不做的事情
    - `constraints`: 约束条件
    - `acceptanceCriteria`: 验收标准
  - `promptDraftHistory`: Prompt 草案历史
  - `userRevisionHistory`: 用户修订历史
  - `executionSummary`: 执行总结
  - `similarTaskRefs`: 相似任务引用
  - `projectRuleRefs`: 项目规则引用

## 4. 输出说明

### CompiledPrompt

编译后的 Prompt 包含三个部分：

#### 4.1 summaryVersion（摘要版）

给用户确认用的简洁版本，包含：
- 项目名称
- 任务目标
- 约束条件
- 验收标准
- 实现范围（如果有 TaskMemory）
- 明确不做的事情（如果有 TaskMemory）

#### 4.2 executionVersion（执行版）

供当前 worker / OpenCodeExecutor 使用的完整版本，包含：
- 项目名称
- 任务目标
- 实现范围
- 明确不做
- 约束与禁止事项
- 验收标准
- 输出契约（固定格式）

#### 4.3 outputContract（输出契约）

固定的输出契约，要求执行方提供：
- **完成清单**：所有任务目标已完成、所有验收标准已满足、代码已通过检查、相关测试已通过
- **改动文件列表**：列出所有新增、修改、删除的文件路径
- **执行命令**：列出执行的构建命令、测试命令
- **测试结果**：构建结果、测试结果、lsp_diagnostics 结果
- **风险与待确认项**：列出潜在风险、需要人工确认的事项

## 5. 使用示例

### 5.1 基础使用

```typescript
import { PromptCompilerImpl } from '@clawkit/controller';

const compiler = new PromptCompilerImpl();

const taskDraft = {
  taskId: 'clawkit-abc123',
  sourceText: '#研发任务\n项目: clawkit\n目标: 实现任务协议解析',
  projectKey: 'clawkit',
  intent: '实现任务协议解析',
  constraints: ['不进入真实派发', '全部使用中文'],
  acceptanceCriteria: ['五种协议可解析', '非法输入有中文报错'],
  status: TaskStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const compiled = compiler.compile({
  taskDraft,
  taskMemory: null,
});

console.log('摘要版 Prompt:');
console.log(compiled.summaryVersion);

console.log('\n执行版 Prompt:');
console.log(compiled.executionVersion);

console.log('\n输出契约:');
console.log(compiled.outputContract);
```

### 5.2 带任务记忆的使用

```typescript
const taskMemory = {
  taskId: 'clawkit-abc123',
  normalizedTaskCard: {
    title: '实现任务协议解析',
    objective: '实现任务协议解析',
    scope: ['实现五种协议解析', '提供中文错误信息'],
    outOfScope: ['不实现真实派发', '不实现 worker 执行'],
    constraints: ['不进入真实派发', '全部使用中文'],
    acceptanceCriteria: ['五种协议可解析', '非法输入有中文报错'],
  },
  promptDraftHistory: [],
  userRevisionHistory: [],
  executionSummary: null,
  similarTaskRefs: [],
  projectRuleRefs: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const compiled = compiler.compile({
  taskDraft,
  taskMemory,
});

// 此时 summaryVersion 和 executionVersion 会包含 scope 和 outOfScope 信息
```

## 6. 实现细节

### 6.1 摘要版生成规则

摘要版 Prompt 采用 Markdown 格式，包含以下章节：
1. **任务摘要**：项目名称、任务目标
2. **约束条件**：列出所有约束（如果有）
3. **验收标准**：列出所有验收标准（如果有）
4. **范围**：列出实现范围（如果有 TaskMemory）
5. **不做的事情**：列出明确不做的事情（如果有 TaskMemory）

### 6.2 执行版生成规则

执行版 Prompt 采用 Markdown 格式，包含以下章节：
1. **研发任务执行指令**：标题
2. **项目名称**：项目标识
3. **任务目标**：任务意图
4. **实现范围**：列出实现范围（如果有 TaskMemory）
5. **明确不做**：列出明确不做的事情（如果有 TaskMemory）
6. **约束与禁止事项**：列出所有约束
7. **验收标准**：列出所有验收标准
8. **输出契约**：固定格式的输出契约

### 6.3 输出契约固定内容

输出契约包含以下固定字段：

**完成清单**：
- 所有任务目标已完成
- 所有验收标准已满足
- 代码已通过 lsp_diagnostics 检查
- 相关测试已通过

**改动文件列表**：
- 列出所有新增、修改、删除的文件路径

**执行命令**：
- 列出执行的构建命令
- 列出执行的测试命令

**测试结果**：
- 构建结果（成功/失败）
- 测试结果（通过/失败）
- lsp_diagnostics 结果

**风险与待确认项**：
- 列出潜在风险
- 列出需要人工确认的事项

## 7. 当前阶段限制

**重要**：当前首版仍以基础模板编译为主，不引入复杂 Prompt 工程。

不做：
- 不调用 LLM 优化 Prompt
- 不实现自适应模板
- 不实现上下文智能选择

只做：
- 基于固定模板生成 Prompt
- 注入必要的任务信息
- 提供清晰的输出契约

## 8. 与 PromptEngine 的关系

`PromptCompiler` 是 `PromptEngine` 的底层依赖：

```
PromptEngine (接口)
    ↓
TemplatePromptEngine (实现)
    ↓
PromptCompiler (编译器)
```

- `PromptCompiler` 负责编译 Prompt 文本
- `PromptEngine` 负责生成完整的 PromptDraft（包含版本号、风险标记等）
- `TemplatePromptEngine` 是当前唯一的 PromptEngine 实现，内部使用 PromptCompiler

## 9. 后续扩展方向

未来可能的扩展包括：

1. **模板可配置**：支持自定义 Prompt 模板
2. **上下文优化**：智能选择相关的历史信息
3. **多语言支持**：支持生成英文 Prompt
4. **质量评估**：自动评估生成的 Prompt 质量
5. **A/B 测试**：支持多个模板版本对比
