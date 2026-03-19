# 内部试运行执行清单

## 基本信息

- 执行人：
- 日期：
- 环境：
- 试运行范围：
- 使用 manifest：
- 备注：

## 使用说明

- 本清单用于 **clawkit v0.1.0 内部试运行**。
- 勾选原则：仅在实际执行并确认结果后勾选，不要凭印象补勾。
- 建议按“试运行前 -> 试运行中 -> 试运行后”顺序执行。
- 若某项失败，请在备注中记录失败现象、日志位置和临时绕过方式。

---

## 一、试运行前检查

### 1. 基础环境与依赖

- [ ] Node.js 版本符合要求（>= 20.0.0）
- [ ] pnpm 版本符合要求（>= 8.0.0）
- [ ] 已执行 `pnpm install`
- [ ] 已执行 `pnpm build` 且通过
- [ ] 已执行 `pnpm test` 且通过

### 2. 示例与最小链路验证

- [ ] 已执行 `node ./scripts/e2e-local-demo.js` 且通过
- [ ] 已明确本次 E2E 结果属于“链路打通”还是“严格真实 OpenCode 验证”
- [ ] 已执行 `node ./packages/cli/dist/index.js doctor -f ./examples/all-in-one.yaml` 且通过
- [ ] 已确认试运行所用 manifest 可被正常读取和校验

### 3. 服务启动前准备

- [ ] 已确认 controller 使用的 `CLAWKIT_MANIFEST_PATH` 指向正确文件
- [ ] 已确认 `OPENCLAW_WEBHOOK_TOKEN` 已设置，且与 OpenClaw 配置一致
- [ ] 已确认 worker 所需的 `CONTROLLER_URL`、`WORKER_ID`、`WORKER_SUPPORTED_PROJECTS` 已设置
- [ ] 若验证真实执行，已确认 `OPENCODE_SERVER_BASE_URL`、认证环境变量、`WORKER_PLACEHOLDER_FALLBACK=false` 已设置
- [ ] 若通过 controller 托管 Web Console，已确认 `packages/web/dist` 已存在，或已设置 `WEB_CONSOLE_DIST_DIR`

### 4. 运行服务检查

- [ ] controller 可启动
- [ ] worker 可启动
- [ ] OpenCode serve 可启动（若本次试运行要求验证真实执行）
- [ ] OpenClaw 配置已完成（webhook endpoint 与 token 已对齐）
- [ ] Web Console 可访问
- [ ] manifest 内容可查看、可保存
- [ ] `apply` 可执行（至少 dry-run 正常）
- [ ] `heal` 可执行（至少 dry-run 正常）

### 5. 试运行前确认记录

- [ ] 已记录本次试运行使用的拓扑（all-in-one / hybrid / split）
- [ ] 已记录本次是否要求严格真实 OpenCode 执行
- [ ] 已记录 controller、worker、OpenCode 的启动方式
- [ ] 已记录主要日志位置

---

## 二、试运行中检查

### 1. 任务主链路检查

- [ ] 可创建研发任务
- [ ] 可生成草稿
- [ ] 可修改草稿
- [ ] 可确认草稿
- [ ] 可派发任务
- [ ] worker 可执行任务
- [ ] 可回传结果

### 2. 页面与状态检查

- [ ] Web Console 可查看任务状态
- [ ] Web Console 总览页信息可读取
- [ ] Deploy 页面可正常执行 doctor / plan / apply
- [ ] Heal 页面可正常执行 heal 预览与执行
- [ ] Status 页面可看到 controller / worker / OpenClaw / OpenCode 状态
- [ ] Tasks 页面可查看任务详情、草稿、执行摘要

### 3. 执行质量检查

- [ ] 日志完整，能串起“创建 -> 草稿 -> 确认 -> 派发 -> 执行 -> 回传”全过程
- [ ] 错误提示清晰，能定位到配置、服务、网络或执行问题
- [ ] 若任务失败，返回的是结构化失败信息，而不是静默失败
- [ ] 页面与 API 展示的状态基本一致
- [ ] 人工确认环节可实际完成，不存在无法确认或确认后无变化的问题

### 4. 试运行中记录建议

- [ ] 每跑完一个场景，立即补充问题记录
- [ ] 对失败项记录 taskId / 页面路径 / 命令 / 时间点
- [ ] 对可绕过问题同步记录临时处理方法
- [ ] 对文档与实际不一致之处同步标记

---

## 三、试运行后检查

### 1. 运行结果收尾

- [ ] 无失败任务残留未处理
- [ ] 无未回传结果的任务
- [ ] 无卡在 `approved / dispatched / running` 但长时间无进展的任务
- [ ] 无明显状态不一致（页面显示与 API、日志不一致）

### 2. 环境与配置回查

- [ ] 无配置漂移（manifest 与实际运行期关键配置未出现不可解释差异）
- [ ] 无服务异常退出（controller / worker / OpenCode serve）
- [ ] 若修改过 manifest，已确认是否完成重启并验证生效
- [ ] 若执行过 apply / heal，已记录写入或修复结果

### 3. 文档与问题整理

- [ ] 已整理本次试运行的全部问题记录
- [ ] 已确认是否存在明显文档误导
- [ ] 已确认是否需要补充 FAQ
- [ ] 已整理 v0.1.1 修复清单草案
- [ ] 已明确哪些问题属于已知限制，哪些属于实际缺陷

### 4. 结论输出

- [ ] 已填写试运行总结模板
- [ ] 已给出是否扩大试运行范围的建议
- [ ] 已给出是否进入 v0.1.1 修复阶段的建议
- [ ] 已给出是否保留 v0.1.0 作为内部基线版本的建议

---

## 附：建议执行命令清单

```bash
pnpm install
pnpm build
pnpm test
node ./packages/cli/dist/index.js doctor -f ./examples/all-in-one.yaml
node ./packages/cli/dist/index.js apply -f ./examples/all-in-one.yaml --dry-run
node ./packages/cli/dist/index.js heal -f ./examples/all-in-one.yaml --dry-run
node ./scripts/e2e-local-demo.js
pnpm --filter @clawkit/controller start
pnpm --filter @clawkit/worker start
pnpm --filter @clawkit/web build
opencode serve --hostname 127.0.0.1 --port 4096
```
