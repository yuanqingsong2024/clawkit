# 内部试运行核心验证场景

## 使用说明

- 本文用于定义 **clawkit v0.1.0 内部试运行的主验证场景**。
- 场景选择原则：只覆盖当前仓库已经具备实现和说明的能力，不扩展未来版本能力。
- 建议每个场景至少跑 1 次；若是阻塞主链路的场景，建议重复验证 2 次以上。

---

## 场景 1：单机场景

### 场景名称

单机最小主链路验证（all-in-one）

### 目标

验证在单机模式下，`任务接入 -> 草稿生成 -> 人工确认 -> worker 执行 -> 结果回传 -> 状态查询` 整条最小链路是否可用。

### 前置条件

- 已执行 `pnpm install`
- 已执行 `pnpm build`
- 已执行 `pnpm test`
- 已准备 `examples/all-in-one.yaml`
- 已设置 `CLAWKIT_MANIFEST_PATH` 和 `OPENCLAW_WEBHOOK_TOKEN`
- 若只验证链路打通，可允许 placeholder fallback

### 操作步骤

1. 执行 `node ./scripts/e2e-local-demo.js`
2. 观察脚本是否自动启动 controller 与 worker
3. 观察脚本是否自动创建任务并完成确认派发
4. 轮询任务状态，直到出现最终结果
5. 补查 Web Console 或 API，确认任务详情、执行摘要可读

### 预期结果

- 脚本执行完成，不中途崩溃
- 任务最终进入 `done` 或结构化 `failed`
- 若为链路验证，可接受 `placeholderExecution=true`
- Web Console / API 能看到任务状态和执行摘要

### 失败判定条件

- 无法创建任务
- 无法生成草稿
- 无法确认派发
- worker 未拉到任务
- 结果未回传
- 页面或 API 无法查询最终状态

### 记录建议

- 记录脚本输出、taskId、最终状态
- 记录本次是否为 placeholder fallback
- 若失败，记录失败阶段是在创建、确认、执行还是回传

---

## 场景 2：混合场景

### 场景名称

混合模式最小部署与联通性验证（hybrid）

### 目标

验证 `examples/hybrid.yaml` 对应的最小部署说明是否可执行，且自动步骤与人工步骤边界清晰。

### 前置条件

- 已准备 `examples/hybrid.yaml`
- 已确认 SSH 节点信息、工作目录、repoPath、端口配置
- 已完成 `pnpm build`
- 已确认试运行人员能访问本地节点与远端控制面节点

### 操作步骤

1. 执行 `node ./packages/cli/dist/index.js doctor -f ./examples/hybrid.yaml`
2. 执行 `node ./packages/cli/dist/index.js apply -f ./examples/hybrid.yaml --dry-run`
3. 如需进一步验证，执行真实 `apply`
4. 检查控制面写入结果：`controller.env`、service 文件、OpenClaw 配置文件
5. 检查执行面写入结果：worker env、OpenCode launch 文件、启动脚本
6. 手工完成当前文档要求的人工步骤（代码同步、service 安装、启动）
7. 从 OpenClaw 或 API 发起任务，观察是否可联通到 worker

### 预期结果

- doctor 能给出结构化检查结果
- apply 能给出明确写入计划，真实执行后文件落地符合说明
- 团队成员可以区分“自动完成”和“需要人工完成”的步骤
- 至少能证明混合模式说明具备可操作性

### 失败判定条件

- doctor 对 manifest 或节点结构给出阻塞错误
- apply 生成结果与文档说明明显不一致
- 执行人无法判断哪些步骤应人工完成
- 完成人工步骤后，controller / worker 仍无法建立最小联通

### 记录建议

- 记录哪些步骤自动完成、哪些步骤需要人工完成
- 对每个节点记录实际写入路径
- 记录最容易误解的步骤，作为后续 FAQ 候选

---

## 场景 3：配置场景

### 场景名称

manifest 查看、修改与生效边界验证

### 目标

验证 Web Console 与 API 对 manifest 的查看、编辑、保存能力可用，同时确认“保存不等于运行态立即生效”的边界是否被正确理解。

### 前置条件

- controller 已启动
- Web Console 可访问
- 当前 `CLAWKIT_MANIFEST_PATH` 指向有效文件
- 试运行人员知道本次允许修改的字段范围

### 操作步骤

1. 打开 Web Console 配置页
2. 查看当前 manifest 内容
3. 修改一项低风险字段（例如描述信息或明确不会影响当前运行的说明项）
4. 保存 manifest
5. 观察保存反馈是否清晰
6. 检查 API `GET /api/manifest` 是否返回最新内容
7. 不重启服务时，观察运行态是否保持原状
8. 按文档提示重启 controller / worker 后，再检查新配置是否生效

### 预期结果

- manifest 可成功读取和保存
- 保存后有明确提示说明需要重启服务才能生效
- API 与页面返回的 manifest 内容一致
- 试运行人员不会误以为“保存即热更新” 

### 失败判定条件

- manifest 无法读取或保存
- 保存后无清晰提示
- API 与页面展示不一致
- 团队成员普遍误解运行态生效边界

### 记录建议

- 记录修改前后差异
- 记录保存提示文案是否足够明确
- 若出现误解，记录具体误导点

---

## 场景 4：修复场景

### 场景名称

doctor / heal 诊断与最小修复验证

### 目标

验证 `doctor` 和 `heal` 是否能帮助内部试运行快速定位常见问题，并在能力范围内完成最小修复。

### 前置条件

- 已构建 CLI
- 已准备一个可运行 manifest
- 已知当前允许制造的低风险问题，例如临时移走本地生成文件

### 操作步骤

1. 执行 `node ./packages/cli/dist/index.js doctor -f <manifest>`
2. 记录 doctor 报告中的问题项和建议
3. 制造一个当前能力范围内可恢复的问题，例如临时删除 `controller.env` 或 `worker.env`
4. 执行 `node ./packages/cli/dist/index.js heal -f <manifest> --dry-run`
5. 观察 heal 是否识别问题并给出修复计划
6. 执行 `node ./packages/cli/dist/index.js heal -f <manifest> --force`
7. 检查缺失文件是否被恢复

### 预期结果

- doctor 能输出结构化检查结果
- heal 能识别当前支持的问题类型
- 对本地生成文件缺失等问题，heal 可完成最小自动修复
- 对不支持自动修复的问题，heal 能给出清晰建议而不是误报成功

### 失败判定条件

- doctor 明显漏掉 manifest 或环境问题
- heal 无法识别已知问题
- heal 声称修复成功，但实际文件未恢复
- 错误提示过于模糊，无法指导下一步处理

### 记录建议

- 记录 doctor / heal 的输出摘要
- 记录问题类型属于“可自动修复”还是“只给建议”
- 记录是否存在误报或漏报

---

## 场景 5：页面场景

### 场景名称

Web Console 页面可用性验证

### 目标

验证当前最小 Web Console 是否足以支撑内部试运行期间的日常查看、确认和操作。

### 前置条件

- controller 已启动
- Web Console 生产构建已完成，或前端开发模式已启动
- 当前 API 可访问

### 操作步骤

1. 打开总览页，确认系统摘要、worker 信息、最近任务、告警可见
2. 打开配置页，确认 manifest 可查看与保存
3. 打开部署页，分别尝试 doctor / plan / apply 预览
4. 打开修复页，尝试 heal 预览
5. 打开状态页，确认 controller / worker / OpenClaw / OpenCode 状态可读
6. 打开任务中心，查看任务列表与任务详情
7. 对一个待确认任务执行“修改草稿”或“确认派发”操作

### 预期结果

- 页面路由均可访问，无明显 404 或空白页
- 关键操作可完成，且反馈文案清晰
- 页面展示与 API 返回基本一致
- 页面虽然最小，但足以支撑内部试运行操作

### 失败判定条件

- 页面不可访问或路由异常
- 关键按钮点击后无反馈
- 操作完成率低，频繁需要改用命令行补救
- API 报错时，前端提示不清楚

### 记录建议

- 记录访问页面路径和失败页面
- 记录哪些操作仍需回退到 CLI 或 API
- 记录前端报错提示是否能让非开发者理解

---

## 建议执行顺序

1. 单机场景
2. 页面场景
3. 配置场景
4. 修复场景
5. 混合场景

这样可以先确认主链路，再补充配置、修复和部署边界验证。
