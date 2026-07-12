# 测试状态说明

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

### ❌ 失败的测试

#### controller 包
- ❌ `dispatch-routes.test.js` - 派发路由测试失败

**失败原因**：
测试期望任务在 `approve` 后立即分配给 worker（`workerId` 字段有值），但当前实现改为优先级队列机制：
- 任务进入队列，`workerId` 初始为空字符串
- Worker 主动拉取任务时才分配 `workerId`

**影响范围**：
这是架构变更导致的测试失败，不是功能缺陷。新的队列机制支持：
- 任务优先级排序
- 多 worker 并发拉取
- 更灵活的任务分配策略

**修复方案**：
1. **短期**：更新测试以匹配新的队列机制（测试 worker 拉取后的状态）
2. **长期**：补充集成测试覆盖完整的派发-拉取-执行流程

### 🔄 测试维护建议

#### 优先级 1（必须修复）
- 修复 `dispatch-routes.test.js`，适配优先级队列机制

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
