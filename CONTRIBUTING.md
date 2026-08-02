# 贡献指南

感谢您对 ClawKit 项目的关注！我们欢迎各种形式的贡献，包括但不限于代码贡献、文档改进、Bug 报告、功能建议等。

## 目录

- [行为准则](#行为准则)
- [快速开始](#快速开始)
- [开发环境](#开发环境)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [插件开发](#插件开发)
- [测试指南](#测试指南)
- [文档贡献](#文档贡献)
- [问题反馈](#问题反馈)
- [Pull Request 流程](#pull-request-流程)

## 行为准则

我们期望所有贡献者都能遵守以下行为准则：

- **友好和尊重**：对所有社区成员保持友好和尊重
- **包容性**：欢迎不同背景和经验水平的贡献者
- **建设性**：提供建设性的反馈，避免人身攻击
- **专注技术**：讨论聚焦于技术问题和项目目标

## 快速开始

### Fork 仓库

```bash
# 1. Fork 仓库到您的 GitHub 账户
# 访问 https://github.com/clawkit/clawkit 点击 Fork 按钮

# 2. 克隆您 Fork 的仓库
git clone https://github.com/YOUR_USERNAME/clawkit.git
cd clawkit

# 3. 添加上游仓库
git remote add upstream https://github.com/clawkit/clawkit.git

# 4. 安装依赖
pnpm install

# 5. 构建项目
pnpm build
```

### 开发前准备

```bash
# 同步最新代码
git fetch upstream
git checkout main
git merge upstream/main

# 创建您的功能分支
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-number
```

## 开发环境

### 环境要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0
- TypeScript 5.x

### 常用命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm lint

# 清理构建产物
pnpm clean

# 开发模式（监视文件变化）
pnpm dev
```

### 包结构

```
clawkit/
├── packages/
│   ├── cli/          # 命令行工具
│   ├── controller/   # 控制器服务
│   ├── worker/       # 工作节点
│   ├── web/          # Web 控制台
│   ├── shared/       # 共享代码
│   ├── plugin-core/  # 插件核心
│   ├── pipeline/     # 流水线编排
│   ├── market/       # 插件市场
│   └── desktop/      # 桌面应用
├── examples/
│   └── plugins/      # 示例插件
├── docs/             # 文档
└── scripts/          # 脚本
```

## 开发流程

### 1. 选择任务

- 查看 [Issues](https://github.com/clawkit/clawkit/issues) 选择感兴趣的任务
- 如果您发现了 Bug 或想要添加新功能，请先创建 Issue 进行讨论
- 在 Issue 中标记 `good first issue` 或 `help wanted` 的是适合新手的任务

### 2. 创建分支

```bash
# 功能分支
git checkout -b feature/add-github-trigger

# Bug 修复分支
git checkout -b fix/issue-123

# 文档改进分支
git checkout -b docs/improve-plugin-guide
```

### 3. 开发代码

- 遵循项目的代码规范
- 编写必要的测试
- 确保代码能够通过所有检查

### 4. 提交代码

```bash
# 暂存文件
git add .

# 提交（使用 Conventional Commits 格式）
git commit -m "feat(trigger): add GitHub webhook trigger plugin"
```

### 5. 推送并创建 PR

```bash
# 推送分支
git push origin feature/add-github-trigger

# 在 GitHub 上创建 Pull Request
```

## 代码规范

### TypeScript 规范

- 使用严格模式 (`strict: true`)
- 避免使用 `any`，使用 `unknown` 代替
- 优先使用 `interface` 而非 `type`
- 函数必须有明确的返回类型
- 使用中文注释解释"为什么"而非"做什么"

```typescript
// ✅ 好的示例
/**
 * 获取用户信息
 * @param userId 用户 ID
 * @returns 用户信息，如果不存在返回 undefined
 */
async function getUser(userId: string): Promise<User | undefined> {
  // 实现
}

// ❌ 避免这样写
function getUser(userId: string) {
  // 没有返回类型
}
```

### 文件命名

- TypeScript 文件：使用 kebab-case：`user-service.ts`
- React 组件：使用 PascalCase：`UserProfile.tsx`
- 测试文件：`*.test.ts` 或 `*.spec.ts`

### 目录结构

```
src/
├── services/      # 服务层
├── controllers/   # 控制器
├── models/       # 数据模型
├── utils/        # 工具函数
├── types/        # 类型定义
└── index.ts      # 入口文件
```

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>
```

### 类型 (type)

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能）|
| `refactor` | 重构（不是新功能或修复）|
| `test` | 测试相关 |
| `chore` | 构建、工具等 |
| `perf` | 性能优化 |
| `ci` | CI/CD 相关 |
| `build` | 构建相关 |

### 作用域 (scope)

- `cli` - CLI 命令
- `controller` - 控制器服务
- `worker` - 工作节点
- `web` - Web 控制台
- `plugin` - 插件系统
- `pipeline` - 流水线
- `docs` - 文档

### 示例

```bash
# 新功能
git commit -m "feat(pipeline): add DAG visualization editor"

# Bug 修复
git commit -m "fix(controller): fix task dispatch retry logic"

# 文档更新
git commit -m "docs: update quick start guide"

# 重构
git commit -m "refactor(worker): extract executor interface"
```

## 插件开发

### 插件结构

```
plugins/
├── executor/      # 执行器插件
│   └── my-executor/
│       ├── index.js
│       ├── README.md
│       └── package.json
├── trigger/       # 触发器插件
│   └── my-trigger/
│       ├── index.js
│       └── README.md
└── notifier/     # 通知器插件
    └── my-notifier/
        ├── index.js
        └── README.md
```

### 插件接口

参考现有插件实现：

- [执行器插件示例](../examples/plugins/simple-executor/)
- [触发器插件示例](../examples/plugins/gitlab-trigger/)
- [通知器插件示例](../examples/plugins/dingtalk-notifier/)

### 插件元信息

```javascript
const meta = {
  name: 'my-plugin',
  version: '1.0.0',
  type: 'executor', // 或 'trigger', 'notifier'
  description: '插件描述',
  author: 'Your Name',
  homepage: 'https://github.com/you/clawkit',
};
```

## 测试指南

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm --filter @clawkit/cli test

# 监视模式
pnpm test --watch

# 生成覆盖率报告
pnpm test --coverage
```

### 编写测试

```typescript
// src/services/user.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  it('should create a user', async () => {
    const user = await service.create({
      name: '张三',
      email: 'zhangsan@example.com',
    });

    expect(user).toBeDefined();
    expect(user.name).toBe('张三');
  });

  it('should throw error for invalid email', async () => {
    await expect(
      service.create({
        name: '李四',
        email: 'invalid-email',
      })
    ).rejects.toThrow('Invalid email');
  });
});
```

### 测试覆盖要求

- 核心业务逻辑覆盖率 > 80%
- 边界情况必须覆盖
- 错误处理必须覆盖

## 文档贡献

### 文档位置

- 用户文档：`docs/`
- API 文档：`docs/controller-api.md`
- 插件开发：`examples/plugins/*/README.md`
- 示例配置：`examples/`

### 文档规范

- 使用中文编写
- 代码块必须有语言标识
- 重要配置项需要说明
- 包含使用示例

```markdown
### 示例配置

```yaml
# config.yaml
server:
  port: 8787  # 控制器端口
```
```

## 问题反馈

### 创建 Issue

在创建 Issue 时，请包含以下信息：

- **问题描述**：清晰描述您遇到的问题
- **复现步骤**：详细的复现步骤
- **预期行为**：您期望的行为
- **实际行为**：实际发生的行为
- **环境信息**：
  - 操作系统
  - Node.js 版本
  - ClawKit 版本
  - 相关配置

### Issue 模板

```markdown
## 问题描述

## 复现步骤

1.
2.
3.

## 预期行为

## 实际行为

## 环境信息

- OS:
- Node.js:
- ClawKit:
- 其他:
```

## Pull Request 流程

### PR 标题

使用与提交信息相同的格式：

```
feat(trigger): add GitHub webhook trigger
fix(controller): handle timeout gracefully
docs: update installation guide
```

### PR 描述模板

```markdown
## 描述

简要描述您的更改。

## 类型

- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 文档更新 (docs)
- [ ] 代码重构 (refactor)
- [ ] 测试相关 (test)
- [ ] 其他 (chore)

## 影响的范围

- CLI
- Controller
- Worker
- Web
- Plugin
- Pipeline
- 文档

## 测试

- [ ] 我添加了测试
- [ ] 所有测试都通过了
- [ ] 不需要测试（请说明原因）

## 检查清单

- [ ] 我的代码遵循项目的代码规范
- [ ] 我的提交信息符合 Conventional Commits 格式
- [ ] 我已经自测过
- [ ] 我已经更新了相关文档
```

### Review 流程

1. **自动化检查**：CI 会自动运行测试和构建
2. **Code Review**：维护者会 review 您的代码
3. **合并**：review 通过后，维护者会合并您的 PR

### 合并标准

- ✅ 所有 CI 检查通过
- ✅ 至少一个维护者 approve
- ✅ 没有未解决的评论
- ✅ 代码与主分支无冲突

## 许可证

通过贡献代码，您同意将您的作品按照 MIT 许可证发布。

## 获得帮助

如果您在贡献过程中遇到问题：

- 查看 [文档](../docs/)
- 搜索 [Issues](https://github.com/clawkit/clawkit/issues)
- 创建 [Discussion](https://github.com/clawkit/clawkit/discussions)

## 致谢

感谢所有为 ClawKit 做出贡献的贡献者！

---

再次感谢您的贡献！🎉
