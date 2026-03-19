# 发布验收文档

## 1. 项目概述

clawkit 是一个用于串联 OpenClaw、controller、worker 与 OpenCode 的轻量工具集，目标是在不过度扩展架构的前提下，提供一条可部署、可验收、可试运行的最小研发任务主链路。

当前仓库已经覆盖：

- manifest 与三种拓扑示例
- CLI：`init / doctor / plan / apply / heal`
- controller：任务接入、草稿生成、审批、状态查询、OpenClaw webhook、Web Console API
- worker：注册、心跳、pull、result、OpenCodeExecutor 主路径
- Web Console：总览、配置、部署、修复、状态、任务中心

## 2. 当前版本定位

当前版本定位为：**内部首发级 MVP**。

本版本重点不是覆盖所有部署场景，而是把以下最小链路收口到可交付状态：

`任务接入 -> 草稿生成 -> 人工确认 -> worker 执行 -> 结果回传 -> Web / API 状态查看`

当前版本建议按 **v0.1.0** 进行内部发布与试运行。

## 3. 功能完成度

| 模块 | 状态 | 说明 |
|---|---|---|
| Manifest / Examples | 已完成 | 已提供 `all-in-one / hybrid / split` 三种示例 |
| CLI | 已完成 | `init / doctor / plan / apply / heal` 已具备最小可用路径 |
| Controller | 已完成 | 已具备草稿、审批、状态查询、worker 协议、OpenClaw webhook |
| Worker | 已完成 | 已具备注册、心跳、pull、result 回传，真实执行主路径已接入 |
| OpenCode 集成 | 已完成 | 支持 SDK / CLI 双路径；严格真实执行需本机先启动 OpenCode server |
| Web Console | 已完成 | 已具备前端页面、后端 API、生产静态文件托管与 SPA fallback |
| 发布文档 | 本次收口补齐 | 增补验收文档、最小使用手册、首发说明草稿 |

## 4. 关键链路验收结果

### 4.1 已有实现与文档证据

- `docs/e2e.md`：明确区分“链路联调”与“真实 OpenCode 执行联调”
- `docs/controller-api.md`：覆盖任务创建、审批、状态查询、worker 相关 API
- `docs/web-api.md`：覆盖 Web Console 使用的 `/api/overview`、`/api/manifest`、`/api/system/*`、`/api/tasks*` 等接口
- `packages/controller/src/http/register-web-console-static.ts`：已实现生产静态文件托管、`/api/*` 旁路与 SPA fallback
- `scripts/e2e-local-demo.js` + `docs/e2e.md`：提供单机最小链路验证路径

### 4.2 验收结论

| 链路 | 结论 | 说明 |
|---|---|---|
| OpenClaw webhook -> controller | 通过 | 已有 webhook 接口、token 鉴权与协议识别 |
| controller 草稿 -> 审批 -> 派发 | 通过 | 已有审批流、状态流转与 dispatch 记录 |
| worker 注册 / 心跳 / pull / result | 通过 | 已有 HTTP API、worker 服务实现与状态回查 |
| OpenCode 真实执行主路径 | 具备 | 主路径已接入；严格验证依赖本机 OpenCode 环境 |
| Web Console -> controller API | 通过 | 已有页面、API、Controller 侧服务聚合 |
| 生产静态文件服务 | 通过 | 已具备构建产物探测、静态文件响应、路由 fallback |

### 4.3 本次实际验证记录

本次发布收口已执行以下验证命令，并得到通过结果：

| 命令 | 结果 | 关键结论 |
|---|---|---|
| `pnpm build` | 通过 | Monorepo 全量构建通过，包含 `packages/web` 生产构建 |
| `pnpm test` | 通过 | CLI、controller、worker 测试全部通过 |
| `pnpm --filter @clawkit/web build` | 通过 | Web Console 生产构建成功，`dist/` 已生成 |
| `node ./packages/cli/dist/index.js doctor -f ./examples/all-in-one.yaml` | 通过 | Schema、环境、路径、端口检查均通过 |
| `node ./scripts/e2e-local-demo.js` | 通过 | 单机最小链路联调通过，任务最终状态为 `done` |

> 注意：本次 `e2e-local-demo.js` 验证结果为“**占位执行链路通过**”，即证明从任务创建、确认派发、worker 拉取、结果回传到状态查询的最小闭环可用；它**不等同于**“真实 OpenCode 执行联调已通过”。

## 5. 单机模式状态

**状态：可用于内部 MVP 验收与本地试运行。**

依据：

- `examples/all-in-one.yaml` 提供完整示例
- `docs/e2e.md` 提供单机链路联调与严格真实执行联调步骤
- `scripts/start-local.sh`、`scripts/e2e-local-demo.js` 提供最小启动与验证路径

说明：

- 若使用 `e2e-local-demo.js`，当前默认允许 `placeholder fallback`，可证明链路打通
- 若要认定“真实 OpenCode 执行联调通过”，必须手工启动 `opencode serve` 并关闭 `WORKER_PLACEHOLDER_FALLBACK`

## 6. 混合模式状态

**状态：具备内部 MVP 试运行说明，但仍保留人工步骤边界。**

依据：

- `examples/hybrid.yaml` 提供控制面在云端、执行面在本地的示例
- `docs/deployment-examples.md` 与 `docs/e2e.md` 已说明自动完成与人工完成的边界

当前判断：

- 已具备最小文件写入与部署说明
- 仍需人工完成远程代码同步、systemd 安装与服务启动
- 这属于首个内部 MVP 的明确边界，不构成阻塞发布缺陷

## 7. Web Console 状态

**状态：已完成，可纳入内部首发 MVP。**

已具备能力：

- 总览页
- 配置页
- 部署页
- 修复页
- 状态页
- 任务中心页

已具备发布要件：

- `packages/web` 前端构建产物
- `docs/web-console.md` 使用与部署说明
- controller 自动探测 `packages/web/dist` 或 `WEB_CONSOLE_DIST_DIR`
- 对 `/api/*` 保留后端路由，对其他前端路由执行 `index.html` fallback

## 8. 已知限制

1. 单机 E2E 演示脚本默认允许 `placeholder fallback`，不能单独替代真实 OpenCode 环境验收。
2. 严格真实执行依赖本机先启动 `opencode serve`，并正确配置认证环境变量。
3. 混合模式仍保留人工部署步骤，不包含完整远程编排。
4. 当前版本不包含自动 PR、自动上线、复杂权限系统、多 worker 复杂调度。
5. 若计划公开开源发布，仍建议先补充 `LICENSE`；但这不阻塞内部 MVP 首发。

## 9. 发布建议

建议按以下方式推进：

1. 以 **v0.1.0** 作为首个内部发布版本号。
2. 先打内部 tag，并进入小范围试运行。
3. 试运行重点观察：单机链路稳定性、混合模式人工步骤可操作性、Web Console 与 API 文档一致性。
4. 试运行期间不扩架构，优先修正文档漂移、边界说明与阻塞使用的问题。

## 10. 本次收口结论

从当前实现、示例、文档与运行链路证据看，clawkit **已经具备内部首发级 MVP 条件**。

建议：

- **推荐版本号**：`v0.1.0`
- **建议动作**：打 tag、进入内部试运行
- **前提说明**：把“链路联调通过”与“真实 OpenCode 执行联调通过”明确区分，避免试运行结论失真
