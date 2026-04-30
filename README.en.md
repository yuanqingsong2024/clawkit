# clawkit

本文件当前仅作为英文入口占位说明，正式内容请以中文主文档为准：

- 中文说明：[`README.md`](./README.md)
- CLI 文档：[`docs/cli.md`](./docs/cli.md)
- E2E 联调：[`docs/e2e.md`](./docs/e2e.md)

> 当前项目处于首个 MVP 发布前收口阶段，文档与注释以中文为主。

## Runtime Topology at a Glance

Use the following diagrams as a quick orientation for runtime responsibilities:

```text
Browser (Web Console)
        |
        v
   controller
   - serves /api/*
   - reads manifest
   - returns overview / config / status
   - receives webhooks
   - manages tasks, approval, and dispatch
        |
        v
      worker
   - registers to controller
   - pulls tasks
   - executes tasks
   - reports results back
```

With OpenClaw and OpenCode included:

```text
OpenClaw ---> controller ---> worker ---> OpenCode
                  ^
                  |
             Web Console
```

## Component Responsibilities

- **Web Console**: Frontend UI for status display, configuration editing, and operator actions.
- **controller**: Core backend service for Web Console APIs, manifest loading, webhook intake, task approval flow, and worker coordination.
- **worker**: Execution node that pulls tasks from controller and runs them through OpenCode or placeholder execution.
- **OpenClaw**: External task source that sends incoming work to controller through webhook.
- **OpenCode**: Actual execution engine used by worker for real task execution.

## Minimal Runtime Understanding

- To open the UI and inspect config/status, you need at least **controller** running.
- To validate dispatch flow and worker state, you need both **controller** and **worker**.
- To validate webhook intake, you also need **OpenClaw** on the calling side.
- To validate real execution instead of placeholder fallback, you also need **OpenCode**.

When the UI looks broken, a new API returns 404, or manifest loading fails, check the **controller** process first.

## Manifest Path Configuration

- `CLAWKIT_MANIFEST_PATH` is still supported as the startup-time way to tell controller where the manifest file lives.
- The Web Console **Config** page can now also save the manifest path.
- The path saved from the page is persisted to `data/controller-config.json`.
- The page-saved path takes precedence over `CLAWKIT_MANIFEST_PATH`.
- After saving a new manifest path, controller switches to the new file immediately, but **worker still needs a manual restart** to pick up the runtime change.
