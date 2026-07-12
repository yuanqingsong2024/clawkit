# sandbox Worker 配置说明

## 1. 定位

sandbox Worker 只用于验证和测试，不允许接收生产任务。

## 2. Worker labels 要求

建议至少包含：

```json
{
  "env": "sandbox",
  "role": "test-worker",
  "sandbox": true
}
```

## 3. OpenCode 安装检查

1. 确认 `OPENCODE_SERVER_BASE_URL` 可访问。
2. 确认 `OPENCODE_SERVER_PASSWORD_ENV` 指向的环境变量存在。
3. 确认 Worker 能启动并完成注册。

## 4. 执行目录要求

1. 执行目录必须是 sandbox 目录。
2. 不允许写入 `~/.ssh`、`/etc`、生产目录。

## 5. 风险等级策略

1. 允许 `low`、`medium`。
2. 拒绝 `high`、`urgent`、`critical`。

## 6. 禁止生产 Worker

1. 生产 Worker 默认不参与真实派发。
2. 如果标签不满足 sandbox/test 条件，Runtime 应拒绝真实 dispatch。
