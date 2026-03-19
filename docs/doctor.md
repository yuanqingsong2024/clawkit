# ClawKit Doctor 诊断文档

## 概述

Doctor 是 ClawKit 的诊断工具，用于检查配置文件的正确性和部署环境的可用性，帮助用户在部署前发现潜在问题。

## 诊断流程

```
配置文件读取
    ↓
YAML 语法解析
    ↓
Schema 校验
    ↓（校验通过后）
环境检查（Node.js、pnpm）
    ↓
路径检查（repoPath）
    ↓
端口检查（冲突检测）
    ↓
节点检查（SSH 结构完整性）
    ↓
生成诊断报告
```

**注意**：如果配置文件不存在或 Schema 校验失败，后续所有依赖 manifest 内容的检查（环境检查、路径检查、端口检查、节点检查）会自动跳过。

---

## 检查项分类

### 1. 配置文件检查（✅ 已实现）

#### 1.1 文件存在性检查

**检查内容**：
- 配置文件是否存在于指定路径

**通过示例**：
```
✓ Manifest 文件存在性：配置文件存在：./clawkit.yaml
```

**失败示例**：
```
✗ Manifest 文件存在性：配置文件不存在：./clawkit.yaml
  → 请先运行 clawkit init 生成配置文件
```

---

#### 1.2 YAML 语法检查

**检查内容**：
- YAML 格式是否正确
- 缩进是否规范
- 特殊字符是否正确转义

**通过示例**：
```
✓ YAML 语法检查：YAML 语法正确
```

**失败示例**：
```
✗ YAML 语法检查：YAML 解析失败：Unexpected token at line 10
  → 请检查 YAML 格式是否正确，是否有缩进错误或特殊字符
```

**常见错误**：
1. 缩进不一致（混用空格和 Tab）
2. 冒号后缺少空格
3. 字符串未正确引号

---

#### 1.3 Schema 校验（✅ 已实现）

**检查内容**：
- 必填字段是否存在
- 字段类型是否正确
- 枚举值是否有效
- 字段约束是否满足（拓扑约束、节点引用、唯一性等）

**通过示例**：
```
✓ Schema 校验：配置文件符合 Schema 定义
```

**失败示例**：
```
✗ Schema 校验：配置文件校验失败，共 3 个错误
✗ Schema 校验 [services.controller.node]: Controller引用了未定义的节点：cloud-control
✗ Schema 校验 [profile.topology]: split 拓扑至少需要一个控制面节点和一个执行节点
✗ Schema 校验 [workers.0.projects.0.key]: 项目 key 重复：api-service
```

---

### 2. 环境检查（✅ 已实现）

#### 2.1 Node.js 版本检查

**检查内容**：
- Node.js 版本是否 >= 20.0.0

**通过示例**：
```
✓ Node.js 版本检查：Node.js v22.0.0 >= 20.0.0
```

**失败示例**：
```
✗ Node.js 版本检查：Node.js v18.19.0 低于最低要求 20.0.0
  → 请升级 Node.js 到 20.0.0 或更高版本
```

#### 2.2 pnpm 可用性检查

**检查内容**：
- pnpm 是否安装且可执行

**通过示例**：
```
✓ pnpm 可用性检查：pnpm 9.15.0 已安装
```

**警告示例**：
```
⚠ pnpm 可用性检查：pnpm 未安装或不可用
  → 建议安装 pnpm：npm install -g pnpm
```

---

### 3. 路径检查（✅ 已实现）

#### 3.1 repoPath 存在性检查

**检查内容**：
- 本地节点上的项目仓库路径（repoPath）是否存在
- SSH 节点的 repoPath 无法在本地验证，自动跳过

**通过示例**：
```
✓ repoPath 存在性 [my-project]：项目 my-project 的仓库路径存在：/path/to/project
```

**警告示例**：
```
⚠ repoPath 存在性 [my-project]：项目 my-project 的仓库路径不存在：/path/to/your/project
  → 请确认仓库路径是否正确，或先克隆仓库到指定路径
```

**跳过示例**（SSH 节点）：
```
○ repoPath 存在性 [api-service]：项目 api-service 位于远程节点 exec-node，跳过本地路径检查
```

---

### 4. 端口检查（✅ 已实现）

#### 4.1 端口冲突检测

**检查内容**：
- 收集 Controller 端口和所有 OpenCode 端口
- 检测同一节点上是否有端口冲突

**通过示例**：
```
✓ 端口有效性检查：共检查 3 个端口，无冲突
```

**失败示例**：
```
✗ 端口冲突检查：端口 local-dev:8080 被多个服务使用：Controller、OpenCode [my-project]
  → 请为每个服务分配不同的端口号
```

**注意**：当前阶段不做真实端口占用检查（不检查系统端口使用情况），只做配置层面的冲突检测。

---

### 5. 节点检查（✅ 已实现）

#### 5.1 SSH 节点结构检查

**检查内容**：
- SSH 节点是否配置了认证方式（keyPath 或 password）
- 使用密码认证时给出安全建议

**通过示例**：
```
✓ SSH 节点结构检查 [cloud-control]：SSH 节点 cloud-control 配置完整（host=claw.example.com, port=22, user=deploy）
```

**警告示例**（密码认证）：
```
⚠ SSH 节点安全检查 [cloud-control]：SSH 节点 cloud-control 使用密码认证
  → 建议使用 SSH 密钥认证（keyPath），更安全
```

**跳过示例**（无 SSH 节点）：
```
○ SSH 节点结构检查：未定义 SSH 节点，跳过检查
```

---

### 6. 网络检查（❌ 未实现）

**计划检查内容**：
- OpenClaw 服务是否可访问
- SSH 节点是否可连通
- API 端点是否可用

---

### 7. 完整环境检查（❌ 未实现）

**计划检查内容**：
- OpenCode 是否安装
- 工作目录磁盘空间是否充足
- 远程工作目录是否存在

---

## 诊断报告

### 报告结构

```typescript
interface DoctorReport {
  timestamp: Date;              // 检查时间
  manifestPath: string;         // 配置文件路径
  checks: CheckResult[];        // 检查结果列表
  overallStatus: CheckStatus;   // 总体状态
  passCount: number;            // 通过数量
  warnCount: number;            // 警告数量
  failCount: number;            // 失败数量
}

interface CheckResult {
  name: string;                 // 检查项名称
  status: CheckStatus;          // 检查状态
  message: string;              // 检查信息
  suggestion?: string;          // 修复建议
}

enum CheckStatus {
  PASS = 'pass',                // 通过
  WARN = 'warn',                // 警告
  FAIL = 'fail',                // 失败
  SKIP = 'skip',                // 跳过
}
```

### 报告示例

```text
══════════════════════════════════════════════════
  ClawKit 配置诊断
══════════════════════════════════════════════════
ℹ 配置文件：./clawkit.yaml
─────────────────────────────────────────────────

📄 配置文件检查
  ✓ Manifest 文件存在性：配置文件存在：./clawkit.yaml
  ✓ YAML 语法检查：YAML 语法正确
  ✓ Schema 校验：配置文件符合 Schema 定义

🔧 环境检查
  ✓ Node.js 版本检查：Node.js v22.0.0 >= 20.0.0
  ✓ pnpm 可用性检查：pnpm 9.15.0 已安装

📂 路径检查
  ⚠ repoPath 存在性 [my-project]：项目 my-project 的仓库路径不存在：/path/to/your/project
    → 请确认仓库路径是否正确，或先克隆仓库到指定路径

🔌 端口检查
  ✓ 端口有效性检查：共检查 2 个端口，无冲突

🖥️ 节点检查
  ○ SSH 节点结构检查：未定义 SSH 节点，跳过检查

─────────────────────────────────────────────────

诊断结果摘要：
  通过: 5 项
  警告: 1 项
  失败: 0 项
  跳过: 1 项

⚠ 存在警告项，建议检查后再继续
```

---

## 当前阶段实现

### 已实现功能

✅ **配置文件检查**
- 文件存在性检查
- YAML 语法解析
- Schema 完整校验
- 中文错误信息输出

✅ **环境检查**
- Node.js 版本检查（>= 20.0.0）
- pnpm 可用性检查

✅ **路径检查**
- repoPath 存在性检查（本地节点）
- SSH 节点自动跳过

✅ **端口检查**
- 配置层面的端口冲突检测

✅ **节点检查**
- SSH 节点结构完整性检查
- SSH 认证方式安全建议

✅ **结构化输出**
- 按类别分组显示（配置文件/环境/路径/端口/节点）
- 彩色图标区分状态（✓ ⚠ ✗ ○）
- 每条检查附带修复建议
- 汇总摘要（通过/警告/失败/跳过数量）
- 检查依赖链：前置检查失败时后续自动跳过

### 未实现功能（后续阶段）

❌ **网络检查**
- SSH 节点连接检查
- OpenClaw 服务可达性
- API 端点检查

❌ **完整环境检查**
- OpenCode 安装检查
- 磁盘空间检查
- 远程工作目录检查

❌ **高级功能**
- 跳过指定检查项（`--skip-network` 等）
- 诊断报告导出（`-o report.json`）
- 自动修复建议执行

---

## 使用建议

### 1. 部署前必须运行 doctor

在执行 `apply` 部署前，务必先运行 `doctor` 检查：

```bash
# 先诊断
clawkit doctor -f clawkit.yaml

# 确认无误后再部署
clawkit apply -f clawkit.yaml
```

### 2. 定期运行 doctor

建议定期运行 doctor 检查环境状态：

```bash
# 每日检查
clawkit doctor

# 或使用 cron 定时任务
0 9 * * * cd /path/to/project && clawkit doctor
```

### 3. 保存诊断报告

将诊断报告保存以便后续分析：

```bash
clawkit doctor > doctor-report-$(date +%Y%m%d).log
```

---

## 常见问题

### Q1: doctor 检查通过，但部署仍然失败？

**A**: 当前阶段 doctor 已覆盖配置校验和基础环境检查，但尚未实现网络连接检查。建议：
- 手动检查 SSH 节点连通性
- 确认 API Key 环境变量已配置
- 检查目标端口是否已被系统其他进程占用

### Q2: 如何跳过某些检查？

**A**: 当前阶段不支持跳过检查。后续阶段将支持：
```bash
clawkit doctor --skip-network --skip-ports
```

### Q3: 诊断报告可以导出吗？

**A**: 当前阶段不支持导出。后续阶段将支持：
```bash
clawkit doctor -o report.json --format json
```

---

## 后续阶段计划

### 阶段二：网络与远程检查

- 实现 SSH 节点连接检查
- 实现远程工作目录检查
- 实现系统端口占用检查（非仅配置层面冲突）

### 阶段三：增强功能

- 实现 OpenCode 安装检查
- 实现磁盘空间检查
- 实现完整的诊断报告导出
- 实现自动修复建议

### 阶段四：高级功能

- 实现性能检查
- 实现安全检查
- 实现合规性检查
- 实现自定义检查规则

---

## 总结

Doctor 是 ClawKit 的核心诊断工具。当前阶段已实现配置文件、环境、路径、端口以及 SSH 节点结构等基础检查，输出结构化的中文诊断报告。由于 `repoPath` 与 SSH 节点检查会随 manifest 内容展开或跳过，终端中的结果条目数不是固定常量。后续将逐步增强网络检查、远程检查等功能。
