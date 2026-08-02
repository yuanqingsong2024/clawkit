# 自定义脚本执行器插件

自定义脚本执行器插件，支持执行 Shell、Python、Node.js 等多种脚本类型。

## 功能特性

- ✅ 支持多种脚本类型（Shell、Python、Node.js 等）
- ✅ 变量替换支持
- ✅ 命令安全检查
- ✅ 超时控制
- ✅ 输出大小限制
- ✅ 环境变量配置

## 支持的脚本类型

| 扩展名 | 解释器 | 示例 |
|-------|-------|------|
| `.sh` `.bash` | /bin/bash | `bash script.sh` |
| `.zsh` | /bin/zsh | `zsh script.zsh` |
| `.py` `.python` | python3 | `python3 script.py` |
| `.js` | node | `node script.js` |
| `.ts` | npx ts-node | `ts-node script.ts` |
| `.rb` | ruby | `ruby script.rb` |
| `.php` | php | `php script.php` |
| `.pl` | perl | `perl script.pl` |
| `.lua` | lua | `lua script.lua` |
| `.go` | go run | `go run script.go` |

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/custom-script-executor plugins/executor/
```

## 配置

在 `manifest.yaml` 中配置插件：

```yaml
plugins:
  executors:
    - name: custom-script-executor
      enabled: true
      config:
        # 脚本目录（相对于工作目录）
        scriptsDir: "./scripts"
        
        # 默认超时时间（毫秒）
        defaultTimeout: 300000
        
        # 允许执行的命令（空表示不限制）
        allowedCommands:
          - "npm"
          - "yarn"
          - "python"
          - "pytest"
        
        # 禁止执行的命令（危险命令）
        forbiddenCommands:
          - "rm -rf /"
          - ":(){ :|:& };:"
        
        # 环境变量
        env:
          NODE_ENV: "production"
          PATH: "/usr/local/bin:/usr/bin:/bin"
        
        # 最大输出大小（字节）
        maxOutputSize: 10485760
```

## 使用示例

### 基本使用

```javascript
const plugin = require('./custom-script-executor');

// 初始化
plugin.initialize({
  scriptsDir: './scripts',
  defaultTimeout: 60000,
});

// 执行命令
const result = await plugin.execute({
  command: 'echo "Hello, World!"',
});

console.log(result.success ? '成功' : '失败');
console.log('输出:', result.output);
```

### 执行脚本文件

```javascript
// 执行脚本文件
const result = await plugin.execute({
  script: 'deploy.sh',
  args: ['production'],
  variables: {
    VERSION: '1.2.3',
    ENVIRONMENT: 'production',
  },
});
```

### 带参数和变量

```javascript
const result = await plugin.execute({
  script: 'test.py',
  args: ['--verbose', '--coverage'],
  variables: {
    PROJECT_DIR: '/app',
    TEST_ENV: 'ci',
  },
  timeout: 120000,
});
```

## 脚本模板变量

在脚本中使用 `${变量名}` 或 `$变量名` 格式：

```bash
#!/bin/bash
# deploy.sh

echo "部署 $VERSION 到 $ENVIRONMENT"
echo "工作目录: ${WORK_DIR}"
echo "任务ID: ${TASK_ID}"

cd ${PROJECT_DIR:-/app}
npm run deploy:$ENVIRONMENT
```

## 安全机制

### 黑名单

默认禁止的命令：
- `rm -rf /` - 根目录删除
- `:(){ :|:& };:` - Fork 炸弹
- `mkfs` - 格式化
- `dd if=` - 直接写入

### 白名单

可以配置允许执行的命令：

```yaml
config:
  allowedCommands:
    - "npm"
    - "yarn"
    - "python"
    - "pytest"
    - "git"
```

### 安全检查

执行前会检查：
1. 命令是否包含黑名单模式
2. 命令是否在白名单中（如已配置）
3. 超时和输出大小限制

## API 参考

### initialize(config, context)

初始化插件。

### execute(task, options?)

执行脚本或命令。

**任务对象：**
```typescript
interface ExecuteTask {
  script?: string;      // 脚本文件路径（相对于 scriptsDir）
  command?: string;     // 直接执行的命令
  args?: string[];      // 脚本参数
  variables?: object;   // 变量替换
  timeout?: number;     // 超时时间（毫秒）
}
```

### executeCommand(command, options?)

直接执行命令。

### executeScript(scriptPath, args?, options?)

执行脚本文件。

### healthCheck()

检查插件健康状态。

### validateConfig(config)

验证配置是否有效。

### getFactory()

获取执行器工厂。

## 返回值

```typescript
interface ExecutionResult {
  success: boolean | null;  // null 表示被截断
  output: string;          // 标准输出
  error?: string;          // 标准错误
  exitCode: number;         // 退出码
  killed?: boolean;         // 是否被超时终止
}
```

## 示例脚本

### 部署脚本 (deploy.sh)

```bash
#!/bin/bash
set -e

ENV=$1
VERSION=$2

echo "开始部署 $VERSION 到 $ENV..."

# 拉取代码
git pull origin main

# 安装依赖
npm ci --production

# 运行测试
npm test || exit 1

# 部署
./scripts/deploy-$ENV.sh $VERSION

echo "部署完成！"
```

### 测试脚本 (test.py)

```python
#!/usr/bin/env python3
import sys
import os

verbose = '--verbose' in sys.argv
coverage = '--coverage' in sys.argv

project_dir = os.environ.get('PROJECT_DIR', '/app')

if verbose:
    print(f"测试目录: {project_dir}")

# 运行测试
cmd = ['pytest']
if coverage:
    cmd.extend(['--cov=src', '--cov-report=html'])
cmd.append(project_dir)

exit_code = os.system(' '.join(cmd))
sys.exit(exit_code)
```

## 最佳实践

1. **使用脚本文件而非直接命令**
   - 更易维护和版本控制
   - 支持变量替换

2. **设置合理的超时时间**
   - 根据脚本预期耗时设置
   - 避免长时间运行的脚本阻塞

3. **配置白名单而非禁用黑名单**
   - 更安全
   - 明确知道哪些命令可以执行

4. **使用环境变量而非硬编码**
   - 在脚本中引用 `${ENV_VAR}` 格式

## 相关链接

- [Bash 脚本教程](https://www.tldp.org/LDP/abs/html/)
- [Python 官方文档](https://docs.python.org/3/)
- [Node.js 官方文档](https://nodejs.org/api/)
