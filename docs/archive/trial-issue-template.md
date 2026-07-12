# 内部试运行问题记录模板

> 使用方式：复制以下模板，为每个问题单独填写一份。建议文件名或标题中带上日期与问题编号，便于归档。

---

## 问题编号

- ISSUE-

## 日期

- 

## 提交人

- 

## 场景

- 单机场景 / 混合场景 / 配置场景 / 修复场景 / 页面场景

## 环境

- 操作系统：
- Node.js：
- pnpm：
- 拓扑：all-in-one / hybrid / split
- manifest：
- 是否真实 OpenCode 执行：是 / 否

## 前置条件

- 

## 触发步骤

1. 
2. 
3. 

## 实际结果

- 

## 预期结果

- 

## 日志位置

- controller：
- worker：
- OpenCode：
- 浏览器控制台 / Network：
- 其他：

## 影响等级

- 阻塞 / 高 / 中 / 低

## 是否可复现

- 可稳定复现 / 偶发 / 暂不可复现

## 临时绕过方案

- 无 / 

## 建议修复版本

- v0.1.1 / 后续版本 / 待判断

## 备注

- 是否属于已知限制：是 / 否
- 关联 taskId：
- 关联页面路径或 API：
- 截图或补充说明：

---

## 快速填写示例

### 问题编号

- ISSUE-20260313-01

### 日期

- 2026-03-13

### 提交人

- 张三

### 场景

- 页面场景

### 环境

- 操作系统：macOS
- Node.js：22.0.0
- pnpm：8.15.0
- 拓扑：all-in-one
- manifest：examples/all-in-one.yaml
- 是否真实 OpenCode 执行：否

### 前置条件

- controller 已启动
- Web Console 由 controller 托管

### 触发步骤

1. 打开 `/tasks`
2. 进入某个待确认任务详情页
3. 点击“确认派发”

### 实际结果

- 页面提示失败，但未显示明确错误原因

### 预期结果

- 页面应提示是 token、状态流转还是后端异常导致失败

### 日志位置

- controller：`/tmp/clawkit/controller.log`
- 浏览器控制台 / Network：浏览器开发者工具 Network

### 影响等级

- 中

### 是否可复现

- 可稳定复现

### 临时绕过方案

- 改用 `POST /api/approval/:taskId/approve` 手工确认

### 建议修复版本

- v0.1.1

### 备注

- 是否属于已知限制：否
- 关联 taskId：task_demo_01
- 关联页面路径或 API：`/tasks/task_demo_01`
