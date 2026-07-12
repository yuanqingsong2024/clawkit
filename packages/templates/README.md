# 配置模板目录

当前仓库**不再维护独立的静态模板文件**。

首个 MVP 采用的策略是：

- 由 `packages/cli/src/services/apply.service.ts` 在运行时根据 manifest 生成最小部署文件
- 生成内容包括 `controller.env`、`worker.env`、systemd 文件、启动脚本、OpenClaw 配置建议等

保留 `packages/templates/` 目录的原因是：

1. 给后续版本预留统一模板归档位置
2. 避免把模板概念继续散落在 CLI 服务实现中

如果后续版本需要引入显式模板文件，应以当前 `apply` 的输出结构为准，而不是重新定义另一套模板边界。
