# 执行器设计说明

## 执行器结构

当前 worker 维护三层执行器结构：

### 1. `TaskExecutor`

统一执行接口，定义标准输入输出：

- 输入：任务上下文、项目仓库路径、基线分支、OpenCode 配置、执行 prompt、执行边界
- 输出：执行摘要、改动文件、执行命令、测试结果、风险、结构化错误、原始输出摘要

### 2. `PlaceholderExecutor`

保留为 fallback。

使用场景：

- 显式开启 `WORKER_PLACEHOLDER_FALLBACK=true`
- OpenCode 主执行器失败后需要兜底

默认情况下它不再是主执行路径。

### 3. `OpenCodeExecutor`

本阶段的主执行器。

执行流程：

1. 校验 `repoPath` 是否存在
2. 构建项目上下文
3. 读取 `AGENTS.md` 等规则
4. 组装最终 prompt
5. 检查 OpenCode server 可用性
6. 通过 SDK 或 CLI 调用 OpenCode
7. 解析输出并标准化结果
8. 回传 controller

## OpenCodeClient 设计

`OpenCodeClient` 统一封装两种模式：

- `sdk`
- `cli`

### SDK 模式

固定走以下链路：

1. `global.health()`
2. `session.create()`
3. `session.prompt()`
4. `session.messages()`
5. `session.status()`

### CLI 模式

备用走法：

```bash
opencode run --format json --attach <baseUrl> --dir <repoPath> --title <title> <prompt>
```

CLI 模式也通过 `OpenCodeClient` 统一返回标准结果，不会把命令行逻辑散落到业务代码中。

## 项目上下文读取

`ProjectContextReader` 负责读取：

- `AGENTS.md`
- `.opencode/commands/`
- `skills/`
- `.opencode/oh-my-opencode.jsonc`

输出内容至少包括：

- `projectKey`
- `repoPath`
- `branchBase`
- `AGENTS.md` 是否存在
- `commands` 是否存在
- `skills` 是否存在

## 最终 prompt 编译

`WorkerPromptCompiler` 会在 controller 执行版 prompt 的基础上追加：

- 项目标识
- 仓库路径
- 任务目标
- 验收标准
- 禁止事项
- 输出契约
- 项目规则提示
- 当前执行边界

输出契约固定要求：

- 完成清单
- 改动文件列表
- 执行命令
- 测试结果
- 风险与待确认项

## 结果标准化

`ExecutionResultNormalizer` 的原则是：

- 优先解析结构化标题段落
- 如果拿不到完整结构，保留原始文本摘要
- 成功失败都返回统一结果结构

这样 controller 不依赖 OpenCode 返回完全标准化 JSON，也能展示真实执行摘要。
