# v0.1.0 首个版本发布说明草稿

## 版本定位

`v0.1.0` 是 clawkit 的首个内部发布版本，目标是交付一条可运行、可验收、可试运行的最小主链路，而不是一次性覆盖所有复杂部署与运维场景。

## 本版包含内容

- manifest 与三种拓扑示例
- `clawkit init / doctor / plan / apply / heal`
- controller 任务接入、草稿、审批、状态查询、OpenClaw webhook
- worker 注册、心跳、pull、result 回传
- OpenCodeExecutor 主执行路径（SDK / CLI 双路径）
- Web Console（总览、配置、部署、修复、状态、任务中心）
- 单机模式最小联调说明
- 混合模式最小部署说明

## 本版重点收口

- 补齐《发布验收文档》
- 补齐《最小使用手册》
- 修正文档中与 Web Console / OpenCode 真实执行路径不一致的表述
- 明确单机链路验证与严格真实执行验证的边界
- 形成首发建议与试运行判断

## 已知限制

### 1. 默认 E2E 验证 ≠ 真实 OpenCode 执行验证

- `node ./scripts/e2e-local-demo.js` 默认允许 **placeholder fallback**
- 它只能证明**链路打通**，不能证明**真实 OpenCode 执行能力已验收**
- 若要验证真实执行，必须：
  - 本机启动 `opencode serve`
  - 关闭 `WORKER_PLACEHOLDER_FALLBACK`
  - 确认 `placeholderExecution=false`
- 详见 `docs/e2e.md`

### 2. Controller 状态未持久化

- 任务、草稿、审批记录均为**进程内存态**
- **Controller 重启后会丢失所有历史数据**
- 试运行期间请避免 controller 重启
- v0.1.1 将引入 SQLite 持久化

### 3. Manifest 保存后需手动重启

- Web Console 保存 manifest 后，配置不会自动生效
- 需要手动重启 controller/worker 进程
- v0.1.1 将支持配置热重载
2. 混合模式保留人工部署步骤，不提供完整远程编排。
3. 当前版本不包含自动 PR、自动生产发布、复杂权限系统、多 worker 复杂调度。
4. 若未来考虑公开开源发布，建议补充 `LICENSE` 文件。

## 适用场景

- 内部最小试运行
- 单人或小范围研发任务链路验证
- OpenClaw + OpenCode 串联方案的第一阶段落地

## 不建议误判为已完成的能力

- 企业级权限系统
- 大规模多 worker 调度平台
- 一键远程编排
- 自动代码托管集成与自动 PR

## 发布建议

- 建议版本号：`v0.1.0`
- 建议先打内部 tag，再进入小范围试运行
- 试运行期间优先收敛文档漂移、真实环境配置问题与阻塞主链路的问题
