# 简单执行器插件

一个轻量级的命令执行器插件，适合运行简单的 Shell 命令和快速验证任务执行链路。

## 功能特性

- ✅ **简单命令执行**：通过子进程执行 Shell 命令
- ✅ **超时控制**：支持设置命令执行超时时间
- ✅ **输出捕获**：捕获标准输出和标准错误
- ✅ **工作目录**：支持指定命令执行的工作目录
- ✅ **环境变量**：支持传递自定义环境变量
- ✅ **轻量实现**：代码简洁，适合学习和二次开发

## 安装

```bash
# 复制到插件目录
cp -r examples/plugins/simple-executor plugins/executor/
```

## 配置

在 `clawkit.yaml` 中配置插件：

```yaml
plugins:
  executors:
    - name: simple-executor
      enabled: true
      config:
        # 默认工作目录
        workDir: /path/to/project
        
        # 默认超时时间（毫秒）
        timeout: 60000
        
        # 默认环境变量
        env:
          NODE_ENV: production
```

## 使用示例

### 基本使用

```javascript
const SimpleExecutor = require('./simple-executor');

// 初始化
SimpleExecutor.initialize({
  workDir: '/path/to/project',
  timeout: 30000,
}, {});

// 执行命令
const result = await SimpleExecutor.execute('echo "Hello World"');

console.log(result.success ? '命令执行成功' : '命令执行失败');
console.log('输出:', result.output);
```

### 执行复杂命令

```javascript
// 读取 package.json 的 version 字段
const result = await SimpleExecutor.execute(
  'cat package.json | grep version',
  { cwd: '/path/to/project' }
);

// 执行 npm 命令
const npmResult = await SimpleExecutor.execute(
  'npm install',
  { 
    cwd: '/path/to/project',
    timeout: 120000, // 2 分钟超时
  }
);
```

### 带环境变量

```javascript
const result = await SimpleExecutor.execute('echo $MY_VAR', {
  env: {
    MY_VAR: 'Hello from env!',
    OTHER_VAR: 'value',
  },
});

console.log(result.output); // Hello from env!
```

### 健康检查

```javascript
const health = await SimpleExecutor.healthCheck();
console.log(health); // true
```

## API 参考

### initialize(config, context)

初始化插件。

### execute(command, options)

执行 Shell 命令。

**参数：**
- `command` (string): 要执行的命令
- `options` (Object, 可选): 执行选项
  - `cwd` (string): 工作目录
  - `timeout` (number): 超时时间（毫秒）
  - `env` (Object): 环境变量

**返回：**
```javascript
{
  success: true,      // 是否成功
  output: '...',      // 标准输出
  error: '...',        // 标准错误（如果有）
  exitCode: 0         // 退出码
}
```

### healthCheck()

健康检查，返回 `true` 或 `false`。

### validatePluginConfig(config)

验证插件配置。

## 限制说明

- **安全性**：此插件直接执行传入的命令，存在命令注入风险
- **跨平台**：使用 `spawn` 跨平台兼容，但复杂命令可能在不同系统表现不同
- **权限**：命令执行依赖系统权限

## 安全建议

1. **避免用户输入直接执行**：不要将用户输入直接作为命令
2. **使用白名单**：只允许执行预定义的命令列表
3. **限制权限**：在沙箱环境中运行
4. **审计日志**：记录所有执行的命令

## 适用场景

- ✅ 快速验证任务执行链路
- ✅ 开发调试
- ✅ 学习插件开发
- ✅ 执行预定义的简单脚本

## 扩展开发

如果你需要开发自己的执行器插件，可以参考此插件的结构：

```javascript
module.exports = {
  meta: {
    name: 'my-executor',
    version: '1.0.0',
    type: 'executor',
  },
  
  initialize(config, context) {
    // 初始化逻辑
  },
  
  getFactory() {
    return {
      meta: { name: 'my-executor' },
      create(config) {
        return {
          async execute(command, options) {
            // 执行逻辑
            return { success: true, output: '' };
          },
          async checkConnection() {
            return true;
          },
        };
      },
      validateConfig(cfg) {
        return { valid: true };
      },
    };
  },
  
  healthCheck() {
    return true;
  },
};
```

## 相关链接

- [ClawKit 插件开发指南](https://github.com/clawkit/clawkit)
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
