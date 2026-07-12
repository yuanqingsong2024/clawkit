# v0.1.1 发布说明草稿

## 版本定位

v0.1.1 是在 v0.1.0 基础上的稳定性增强版本，重点补齐 controller 核心状态的持久化能力，降低试运行过程中因 controller 重启导致的数据丢失风险。

## 关键更新

### 1. Controller 核心状态支持 SQLite 持久化

- 任务草稿已持久化
- 任务记忆已持久化
- 提示草稿已持久化
- 审批记录已持久化
- controller 重启后可恢复已创建任务及其关联状态

### 2. 新增持久化运行配置

- 默认数据库路径：`data/clawkit.db`
- 支持通过 `CONTROLLER_DB_PATH` 自定义数据库路径
- 支持通过 `CONTROLLER_ENABLE_PERSISTENCE=false` 显式关闭持久化

## 已验证内容

- 已完成“创建任务 → 停止 controller → 重启 controller → 查询任务成功”的持久化验证
- 已确认任务列表在重启后仍可读取

## 当前仍需注意的边界

### 1. Manifest 保存后仍不会自动刷新运行态

- Web Console 保存 manifest 后，controller / worker 不会自动热重载
- 修改配置后仍需手动重启相关进程

### 2. 默认 E2E 仍不等于真实 OpenCode 严格验收

- `node ./scripts/e2e-local-demo.js` 默认仍允许 placeholder fallback
- 若要验收真实 OpenCode 执行能力，仍需按 `docs/e2e.md` 中的严格步骤执行

## 升级建议

若你此前已使用 v0.1.0 进行内部试运行，建议升级到 v0.1.1，以避免 controller 进程重启导致任务数据丢失。
