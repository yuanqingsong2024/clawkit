# clawkit 当前 Runtime 差距分析

## 1. 当前已支持的接口

1. `GET /health`
2. `GET /status`
3. `GET /version`
4. `GET /capabilities`
5. `GET /workers`
6. `POST /task-drafts`
7. `POST /dispatch/dry-run`
8. `POST /dispatch`
9. `GET /dispatch/{id}/status`
10. `GET /dispatch/{id}/result`

## 2. 当前缺失的接口

1. `POST /dispatch/{id}/cancel` 当前返回 `controller.cancel_unsupported`，未实现真实取消。
2. `GET /workers/{workerId}/result?dispatchId={id}` 已补兼容，但建议优先使用 `GET /dispatch/{id}/result`。

## 3. 当前字段与 SoloForge Office OS 不一致的地方

1. 现有 worker 注册协议原本只有 `tags`，已补充 `labels`、`capabilities`、`maxConcurrency`。
2. Runtime 返回的 `remoteDraftId` 采用本地任务 ID 派生，不是外部独立存储 ID。

## 4. 当前认证缺口

1. 已补最小 Bearer / X-API-Key / X-Auth-Token 校验。
2. 未实现复杂权限系统。

## 5. 当前 Worker labels 缺口

1. 现有 Worker 可通过 `WORKER_LABELS_JSON` 注入结构化标签。
2. 若未配置，则由 tags/name 进行 sandbox/test 派生。

## 6. 当前 Dispatch dry-run 缺口

1. 目前实现为最小可用评估，不包含复杂调度器。

## 7. 当前 Sandbox Dispatch 缺口

1. 真实执行仍依赖现有 worker pull 链路。
2. 当前实现只允许 sandbox/test Worker 进入真实派发。
3. 取消接口仍为契约态，不执行真实取消。

## 8. 建议下一步修改

1. 继续补 `POST /dispatch/{id}/cancel`。
2. 补 `GET /workers/{workerId}/result?dispatchId={id}` 兼容查询。
3. 为 runtime 路由增加更细粒度的测试。
