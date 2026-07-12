# SoloForge Office OS Runtime 文档目录

这是一组给 SoloForge Office OS 接入 clawkit Runtime 使用的文档，建议按下面顺序阅读。

## 1. 配置文档

- [`docs/soloforge-office-os-runtime-config.md`](./soloforge-office-os-runtime-config.md)

用途：告诉 SoloForge Office OS 具体要填写哪些配置项、推荐值是什么、哪些开关必须保持关闭。

## 2. 接入文档

- [`docs/soloforge-office-os-runtime-integration.md`](./soloforge-office-os-runtime-integration.md)

用途：说明 SoloForge Office OS 如何连接 clawkit、如何走 TaskDraft、Dry-run、Sandbox Dispatch、Worker Result 流程。

## 3. 接口契约文档

- [`docs/runtime-api-contract.md`](./runtime-api-contract.md)

用途：逐个说明 Runtime API 的请求、响应、错误码和安全限制。

## 4. 接入清单

- [`docs/soloforge-office-os-runtime-checklist.md`](./soloforge-office-os-runtime-checklist.md)

用途：给 SoloForge Office OS 从零接入时逐项勾选，方便现场实施和验收。

## 5. 推荐阅读顺序

1. 先看配置文档，确认需要填写哪些字段。
2. 再看接入文档，确认整体流程和安全边界。
3. 最后看接口契约文档，确认每个接口的请求/响应细节。
4. 接着用接入清单逐项勾选，确认实施状态。

## 6. 快速结论

- 真实 token 不写入文档，只通过 `tokenEnv` 引用。
- 生产 Worker 默认不允许真实派发。
- 真实派发前必须先完成审批。
- 取消接口当前仅保留契约，不做真实取消。
