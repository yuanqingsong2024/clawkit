# 测试状态说明

> 更新于 2026-08-30：本地全量 workspace 测试已通过。历史失败记录保留在下方，作为变更背景。

## 当前测试覆盖情况

### ✅ 通过的测试

#### shared 包
- ✅ formatValidationIssue 工具函数
- ✅ ManifestSchema 校验逻辑

#### controller 包（部分通过）
- ✅ TaskDraft 创建和管理
- ✅ TaskMemory 初始化和更新
- ✅ PromptCompiler 编译逻辑
- ✅ TemplatePromptEngine 生成逻辑
- ✅ 完整链路测试（协议 -> TaskDraft -> TaskMemory）
- ✅ 审批流程测试（创建 -> 生成 -> 修改 -> 确认 -> 查询）
- ✅ 状态机转换测试

### ✅ 历史失败项已恢复

此前 `dispatch-routes.test.js` 因派发队列模型变更而失败。当前 Controller 测试已通过，现行契约是：
- 任务确认后进入优先级队列；
- Worker 主动拉取时完成分配；
- `workerId` 不保证在确认动作后立即存在。

### 🔄 测试维护建议

#### 优先级 1（建议补充）
- 补充完整的 controller-worker 派发、拉取、执行集成测试
- 补充 SQLite 持久化场景测试

#### 优先级 2（建议补充）
- 补充优先级队列排序测试
- 补充 SSE 任务推送测试
- 补充并发执行测试
- 补充超时和重试测试

#### 优先级 3（可选）
- 补充 Logger 单元测试
- 补充配置加载测试
- 补充错误处理边界测试

## 测试运行方式

```bash
# 运行所有测试
pnpm test

# 运行特定包的测试
pnpm --filter @clawkit/shared test
pnpm --filter @clawkit/controller test
pnpm --filter @clawkit/web test

# 跳过类型检查（仅运行单元测试）
pnpm --filter @clawkit/controller test:unit
```

## 已知限制

1. **测试环境**：当前测试使用内存模式（`CONTROLLER_ENABLE_PERSISTENCE=false`），不测试 SQLite 持久化
2. **集成测试**：缺少完整的 controller-worker 集成测试
3. **E2E 测试**：依赖手动运行 `scripts/e2e-local-demo.js`

## 测试覆盖率

当前未配置覆盖率工具。建议后续引入 `c8` 或 `nyc` 进行覆盖率统计。
