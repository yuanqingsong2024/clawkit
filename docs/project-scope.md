# clawkit 项目范围

## 1. 项目定位

clawkit 是一个用于 **串联 OpenClaw、controller、worker 与 OpenCode** 的轻量工具集。

它不是通用 DevOps 平台，也不是完整研发流程系统；首版目标是提供一个**最小可运行、可验证、可部署说明落地**的 MVP。

## 2. 当前版本包含什么

当前版本包含以下能力：

- manifest schema 与三种拓扑示例
- CLI：`init / doctor / plan / apply / heal`
- controller：
  - 研发任务协议解析
  - TaskDraft / TaskMemory / PromptDraft
  - 审批状态机
  - HTTP API
  - OpenClaw webhook 接入
- worker：
  - register / heartbeat / pull / result
  - OpenCodeExecutor 主路径
  - PlaceholderExecutor 回退路径
- Web Console：
  - 总览、配置、部署、修复、状态、任务中心
- dispatch：
  - approved 任务派发
  - worker 选择
  - DispatchRecord 查询
- 部署：
  - OpenClaw 一键部署（支持本地 Docker 自动部署或外部实例集成）
  - OpenCode 一键安装（支持本地一键安装或外部实例集成）
    - 包含项：三模式（`local / external / skip`）/ 自动调用官方安装脚本 / 后台启动并写入 PID / 健康检查 / 已安装时跳过安装 / 非阻塞失败 / Web Console 引导
    - 不做项：自定义端口（固定 `4096`）/ 不做包管理升级 / 不做 systemd unit / 不做远程节点安装 / 不做容器化（OpenClaw 用 Docker，OpenCode 直接安装到本机）
  - 三种部署模式（`local / external / skip`）
  - 自动执行流程（doctor / plan / apply / deploy）
  - 非阻塞失败处理（OpenClaw 部署失败不影响 Controller/Worker 继续）
  - Web Console 引导（Setup 向导与日志可视化）

## 3. 当前版本明确不做什么

以下内容属于当前阶段**明确不做**，不是缺陷：

- 复杂 Web 管理后台能力
- 自动 PR
- 自动部署生产业务代码
- 复杂远程环境编排
- 多 worker 复杂调度
- push 模式派发
- 复杂权限系统
- controller 侧真实大模型生成 Prompt

与 OpenClaw 部署能力相关的 **当前版本明确不做**（不是缺陷）：

- 自动 onboarding（仍需要用户在 OpenClaw UI 手动完成账号、webhook、token 等配置）
- 配置自动更新（不会自动回写或同步 OpenClaw 内部配置）
- 自定义端口（`local` 模式使用固定默认端口 18000，不提供端口参数化）
- 多实例部署（不支持一份 manifest 拉起多套 OpenClaw 实例）
- 版本管理（不提供 OpenClaw 镜像/版本锁定、升级编排与回滚能力）

与 OpenCode 一键安装能力相关的 **当前版本明确不做**（不是缺陷）：

- 自定义端口（`local` 模式固定使用 `4096`，不提供端口参数化）
- 包管理升级（不提供 OpenCode 的版本升级、回滚与锁定能力）
- systemd unit（不自动安装或管理 systemd；仅生成启动脚本并以后台方式运行）
- 远程节点安装（不支持在 SSH 节点上远程执行 OpenCode 安装脚本）
- 容器化（OpenClaw 使用 Docker；OpenCode `local` 模式直接安装到本机用户目录）

## 4. 当前版本边界

### 4.1 apply 的边界

`apply` 当前负责：

- 校验 manifest
- 生成 env、systemd、启动脚本、OpenClaw 配置建议
- 本地真实写入
- SSH 节点最小远程写入

`apply` 当前不负责：

- 远程代码同步
- 自动安装依赖
- 自动安装/启停 systemd
- 复杂回滚

### 4.2 heal 的边界

`heal` 当前负责：

- 识别常见配置问题
- 输出修复计划
- 修复本地缺失或损坏的生成文件

`heal` 当前不负责：

- 远程自动修复
- 自动重启远程服务
- 复杂自愈编排

### 4.3 OpenCode 的边界

当前版本已经接入 OpenCode 执行链路，但首版有两个现实边界：

1. 严格真实执行依赖本机先启动 `opencode serve`
2. 若开启 `WORKER_PLACEHOLDER_FALLBACK=true`，失败时会回退到占位执行，只用于链路验证

## 5. MVP 验收标准

当前版本被视为“可发布 MVP”时，应满足：

1. 示例配置与 schema 一致
2. `init` 生成配置可被后续命令读取
3. `doctor / plan / apply / heal` 至少可完成最小主路径
4. controller 与 worker 的主链路可联调
5. 文档能够指导用户完成单机模式与混合模式的最小落地

## 6. 结论

clawkit 首版的目标不是覆盖所有部署场景，而是把 **“任务接入 -> 草稿确认 -> 派发执行 -> 结果回传 -> 最小部署说明”** 这条主链路做实，并把不做的边界说清楚。
