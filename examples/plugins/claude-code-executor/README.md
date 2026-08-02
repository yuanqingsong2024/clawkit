# Claude Code 执行器插件

Claude Code CLI 执行器插件，支持通过 Claude Code 执行 AI 编程任务。

## 功能特性

- ✅ **CLI 模式**：直接调用本地 Claude Code CLI
- ✅ **API 模式**：支持远程 Claude Code API
- ✅ **多模型支持**：支持 Sonnet、Opus、Haiku 等模型
- ✅ **进度回调**：实时获取执行进度
- ✅ **命令执行**：支持执行 Shell 命令
- ✅ **文件编辑**：支持读写和编辑文件
- ✅ **健康检查**：自动检测 Claude Code 安装状态

## 安装

### 方式一：复制插件

```bash
# 复制到插件目录
cp -r examples/plugins/claude-code-executor plugins/executor/
```

### 方式二：Claude Code 安装

Claude Code CLI 需要单独安装：

```bash
# macOS/Linux
npm install -g @anthropic/claude-code

# 或使用 Homebrew
brew install claude-code

# 验证安装
claude-code --version
```

## 配置

在 `clawkit.yaml` 中配置插件：

```yaml
plugins:
  executors:
    - name: claude-code-executor
      enabled: true
      config:
        # 执行模式: 'cli' | 'api'
        mode: cli
        
        # CLI 模式配置
        cli:
          # Claude Code CLI 路径（留空则自动查找）
          binaryPath: ''
          
          # 工作目录
          workDir: /path/to/project
          
          # 模型选择
          model: sonnet  # sonnet | opus | haiku
          
          # 最大 Token 数
          maxTokens: 4096
          
          # 权限设置
          allowExecute: true
          allowEdit: true
          allowSearch: true
        
        # API 模式配置（未来支持）
        api:
          baseUrl: http://localhost:4096
          apiKey: your-api-key
        
        # 通用配置
        timeout: 600000  # 10 分钟
```

## Claude Code 安装与配置

### 安装 Claude Code CLI

```bash
# 使用 npm 安装
npm install -g @anthropic/claude-code

# 或使用 npx 直接运行
npx @anthropic/claude-code --version
```

### 配置 API Key

Claude Code 需要配置 Anthropic API Key：

```bash
# 设置环境变量
export ANTHROPIC_API_KEY=sk-ant-xxxxx

# 或使用配置文件
mkdir -p ~/.claude
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" > ~/.claude/settings.env
```

### 获取 API Key

1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 登录或注册账号
3. 进入 API Keys 页面
4. 创建新的 API Key

## 使用示例

### 基本使用

```javascript
const ClaudeCodeExecutor = require('./claude-code-executor');

// 初始化
ClaudeCodeExecutor.initialize({
  mode: 'cli',
  cli: {
    model: 'sonnet',
    workDir: '/path/to/project',
  },
}, {});

// 执行任务
const result = await ClaudeCodeExecutor.execute({
  prompt: '解释这段代码的作用：src/utils/helper.ts',
  cwd: '/path/to/project',
});

console.log(result.success ? '执行成功' : '执行失败');
console.log(result.output);
```

### 代码审查

```javascript
const result = await ClaudeCodeExecutor.execute({
  prompt: `
    请审查以下代码，找出潜在的问题和改进建议：
    
    \`\`\`javascript
    async function fetchData(url) {
      const response = await fetch(url);
      return response.json();
    }
    \`\`\`
  `,
  systemPrompt: '你是一个资深的代码审查专家，专注于代码质量和安全性。',
});

console.log(result.output);
```

### 批量执行

```javascript
const tasks = [
  {
    prompt: '优化 src/utils/math.js 中的算法',
    cwd: '/path/to/project',
  },
  {
    prompt: '为 src/api/user.js 添加单元测试',
    cwd: '/path/to/project',
  },
  {
    prompt: '更新 README.md 的安装说明',
    cwd: '/path/to/project',
  },
];

const results = await ClaudeCodeExecutor.executeBatch(tasks);

results.forEach((result, index) => {
  console.log(`任务 ${index + 1}: ${result.success ? '✅ 成功' : '❌ 失败'}`);
});
```

### 实时进度

```javascript
const result = await ClaudeCodeExecutor.execute({
  prompt: '重构整个项目的错误处理',
  cwd: '/path/to/project',
  onProgress: (progress) => {
    if (progress.type === 'stdout') {
      console.log('[Claude]:', progress.data);
    } else if (progress.type === 'stderr') {
      console.error('[Error]:', progress.data);
    }
  },
});
```

### 健康检查

```javascript
const health = await ClaudeCodeExecutor.healthCheck();

if (health.status === 'healthy') {
  console.log(`Claude Code 版本: ${health.version}`);
  console.log(`执行模式: ${health.mode}`);
  console.log('可用能力:', health.capabilities);
} else {
  console.error('健康检查失败:', health.error);
  console.log('安装指南:', health.installUrl);
}
```

## 任务数据结构

### 输入

```typescript
interface ExecutionTask {
  // 提示内容
  prompt: string;
  
  // 工作目录（可选）
  cwd?: string;
  
  // API Key（API 模式）
  apiKey?: string;
  
  // 系统提示（可选）
  systemPrompt?: string;
  
  // 模型选择（可选）
  model?: 'sonnet' | 'opus' | 'haiku';
  
  // 最大 Token 数（可选）
  maxTokens?: number;
  
  // 超时时间（毫秒，可选）
  timeout?: number;
  
  // 环境变量（可选）
  env?: Record<string, string>;
  
  // 进度回调（可选）
  onProgress?: (progress: ProgressEvent) => void;
  
  // 附加命令行参数（可选）
  extraArgs?: string[];
}
```

### 输出

```typescript
interface ExecutionResult {
  // 是否成功
  success: boolean;
  
  // 输出内容
  output: string;
  
  // 错误信息
  error?: string;
  
  // 退出码
  exitCode: number;
  
  // 信号（如果被信号终止）
  signal?: string;
  
  // 元数据
  metadata: {
    executor: string;
    version?: string;
    duration?: number;
  };
}
```

## 配置参数说明

| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `mode` | string | 执行模式 (`cli` \| `api`) | `cli` |
| `cli.binaryPath` | string | Claude Code CLI 路径 | 自动查找 |
| `cli.workDir` | string | 默认工作目录 | 当前目录 |
| `cli.model` | string | 模型选择 | `sonnet` |
| `cli.maxTokens` | number | 最大 Token 数 | `4096` |
| `cli.allowExecute` | boolean | 允许执行命令 | `true` |
| `cli.allowEdit` | boolean | 允许编辑文件 | `true` |
| `cli.allowSearch` | boolean | 允许搜索 | `true` |
| `api.baseUrl` | string | API 服务地址 | `http://localhost:4096` |
| `api.apiKey` | string | API Key | - |
| `timeout` | number | 超时时间（毫秒） | `600000` |

## 支持的模型

| 模型 | 说明 | 适用场景 |
|------|------|----------|
| `sonnet` | 平衡性能与成本 | 日常任务、代码生成 |
| `opus` | 最强推理能力 | 复杂任务、代码审查 |
| `haiku` | 快速响应 | 简单任务、批量处理 |

## 常见问题

### Q1: Claude Code 未安装？

```bash
# 安装 Claude Code
npm install -g @anthropic/claude-code

# 验证安装
claude-code --version
```

### Q2: API Key 无效？

```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY

# 如果为空，设置它
export ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Q3: 执行超时？

```yaml
# 增加超时时间
plugins:
  executors:
    - name: claude-code-executor
      config:
        timeout: 1200000  # 20 分钟
```

### Q4: 无法找到 Claude Code？

```yaml
# 手动指定路径
plugins:
  executors:
    - name: claude-code-executor
      config:
        cli:
          binaryPath: /usr/local/bin/claude-code
```

### Q5: 执行权限被拒绝？

Claude Code 可能需要额外的权限配置：

```javascript
// 使用 --dangerously-skip-permissions 选项
const result = await ClaudeCodeExecutor.execute({
  prompt: '安装项目依赖',
  extraArgs: ['--dangerously-skip-permissions'],
});
```

## 安全说明

1. **API Key 安全**：不要将 API Key 提交到代码仓库
2. **命令执行**：Claude Code 可以执行任意命令，请谨慎使用
3. **文件编辑**：Claude Code 可以修改文件，建议使用 Git 分支
4. **权限控制**：生产环境建议禁用 `allowExecute`

## 相关链接

- [Claude Code 文档](https://docs.anthropic.com/en/docs/claude-code)
- [Anthropic API 文档](https://docs.anthropic.com/)
- [ClawKit 文档](https://github.com/clawkit/clawkit)
- [Claude Code 安装指南](https://github.com/anthropics/claude-code)
