# controller 任务协议

## 1. 文档目标

本文档描述 clawkit 当前支持的最小文本协议。它既用于 OpenClaw webhook，也可作为调试与测试时的人类可读输入格式。

## 2. 支持的协议

### 2.1 创建研发任务

```text
#研发任务
项目: <projectKey>
目标: <任务目标>
约束: <可选，多条可用分号或换行>
验收: <可选，多条可用分号或换行>
```

解析结果：

- `command = create_task`
- `projectKey`
- `goal`
- `constraints: string[]`
- `acceptanceCriteria: string[]`

### 2.2 确认派发

```text
#确认派发 <taskId>
```

解析结果：

- `command = confirm_dispatch`
- `taskId`
- 对应审批动作：`approve`

当前实现中，这个命令不只是“审批确认”，还会继续尝试把任务派发到可用 worker。

### 2.3 修改草案

```text
#修改草案 <taskId>
修改: <补充说明>
```

解析结果：

- `command = revise_draft`
- `taskId`
- `modification`

### 2.4 取消任务

```text
#取消任务 <taskId>
```

解析结果：

- `command = cancel_task`
- `taskId`

### 2.5 查询状态

```text
#任务状态 <taskId>
```

解析结果：

- `command = view_status`
- `taskId`

## 3. 错误处理

协议解析失败时，controller 会返回稳定错误码与中文提示。

常见错误码：

- `controller.invalid_task_protocol`
- `controller.task_protocol_field_missing`
- `controller.task_protocol_field_invalid`

## 4. 使用边界

当前协议只覆盖：

- 研发任务接入
- 草稿确认/修改/取消
- 任务状态查询

它不试图表达复杂工作流、权限语义或多级审批。
