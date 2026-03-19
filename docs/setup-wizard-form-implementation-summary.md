# Setup 向导表单式实现总结

> **实现状态**：已完成最小可用版本
> 
> **实现时间**：2026-03-16
> 
> **实现范围**：表单模式 + YAML 模式双轨支持，优先覆盖 all-in-one 和 hybrid 拓扑

---

## 一、实现目标回顾

### 原始目标
在当前"预设 + YAML 编辑"基础上，新增"逐字段填写式向导"能力，满足"填写必要信息→点击确认→启动流程→实时状态/失败信息"的最小可用流程。

### 实际实现
完整实现了表单模式与 YAML 模式的双轨支持，超出最小目标，提供了更完整的用户体验。

---

## 二、核心功能实现

### 1. 模式切换机制
- **表单模式**：适合 all-in-one 和 hybrid 拓扑的快速配置
- **YAML 模式**：适合 split 拓扑和高级字段编辑
- **双向切换**：
  - 表单 → YAML：自动生成标准化 YAML
  - YAML → 表单：解析并回填表单（仅支持 all-in-one/hybrid）

### 2. 表单状态管理
实现了完整的 `SetupFormState` 类型，包含：
- 基础信息：配置名称、拓扑、描述
- 节点信息：本地节点、远程节点（hybrid）
- 服务信息：Controller、OpenClaw
- Worker 信息：ID、连接模式、标签、项目配置
- 运行时信息：Memory provider 配置

### 3. 字段覆盖范围

#### all-in-one 支持字段
- 配置名称、拓扑、描述
- 本地节点名称、工作目录
- Controller 端口、API 前缀
- OpenClaw 地址、Token
- Worker ID、连接模式、标签
- 项目 key、仓库路径、基础分支
- OpenCode 端口、Agent、模式
- Memory provider 配置

#### hybrid 额外支持字段
- 控制面节点名称
- SSH 主机、端口、用户
- SSH 私钥路径
- 远程工作目录

#### split 拓扑
- 仅支持 YAML 模式编辑
- 不提供表单化支持

### 4. 校验机制
实现了三层校验：

#### 前端实时校验
- 必填字段检查
- 端口号格式校验
- URL 格式校验
- 实时反馈表单错误

#### preview 校验
- 调用 `/api/setup/manifest/preview`
- 后端 Zod schema 校验
- 生成标准化 manifest

#### 启动前校验
- 表单模式：先执行前端校验 → preview 校验 → 启动
- YAML 模式：YAML 解析 → preview 校验 → 启动

### 5. 工具函数实现

#### `buildFormStateFromManifest`
从 manifest 对象提取表单值，支持：
- 从 preset 初始化默认值
- 从 YAML 回填表单
- 自动识别 topology 并提取对应节点配置

#### `buildManifestFromForm`
从表单值构造完整 manifest，包括：
- 自动设置节点引用关系
- 根据 topology 生成正确的节点配置
- 补充固定默认值（runtime/notify/deploy）

#### `validateFormState`
前端表单校验，检查：
- 必填字段完整性
- 端口号格式
- URL 格式
- topology 特定字段（hybrid 的 SSH 配置）

### 6. UI 组件复用
完全复用现有 UI 组件：
- `Card`：区块容器
- `Badge`：状态标识
- `InfoNotice` / `ErrorNotice`：提示信息
- `CodeBlock`：YAML 预览

---

## 三、实现亮点

### 1. 最小侵入性
- 仅修改 `SetupWizardPage.tsx` 一个文件
- 不改动后端接口
- 完全复用现有 API 和 SSE 机制

### 2. 渐进式增强
- 保留原有 YAML 模式作为高级入口
- 表单模式作为快速配置入口
- 两种模式互不干扰，可自由切换

### 3. 完整的错误处理
- 前端校验 → 清晰的字段级错误提示
- preview 失败 → 后端返回的详细错误信息
- run 失败 → 步骤级错误信息 + 最终错误摘要

### 4. 实时反馈
- 表单值变化 → 自动生成 YAML 预览
- 表单校验 → 实时显示错误列表
- 执行状态 → SSE 实时推送步骤状态和日志

---

## 四、技术实现细节

### 状态管理
```typescript
const [setupMode, setSetupMode] = useState<SetupMode>('form');
const [formState, setFormState] = useState<SetupFormState>(defaultFormState());
const [formIssues, setFormIssues] = useState<ValidationIssue[]>([]);
const [manifestYaml, setManifestYaml] = useState<string>('');
const [previewHint, setPreviewHint] = useState<string | null>(null);
```

### 关键 Hook
- `useQuery`：加载 defaults 和 presets
- `useMutation`：preview、start、retry
- `useEffect`：
  - preset 切换时初始化表单
  - 表单值变化时更新 YAML 预览
  - 表单值变化时执行实时校验

### 数据流
```
preset → buildFormStateFromYaml → formState
formState → buildManifestFromForm → manifest
manifest → yaml.stringify → manifestYaml
manifestYaml → /api/setup/manifest/preview → previewResult
previewResult.manifest → /api/setup/runs → runDetail
runDetail → SSE → 实时状态更新
```

---

## 五、已知限制与未来扩展

### 当前限制
1. **split 拓扑**：不支持表单化，仅 YAML 模式
2. **多 worker/project**：表单仅支持单 worker 单 project
3. **高级字段**：runtime/notify/deploy 需在 YAML 模式编辑
4. **动态节点**：不支持自定义节点名称和动态增删

### 未来可扩展方向
1. **完整 7 步向导**：按原设计文档实现分步流程
2. **动态列表**：支持多 worker、多 project 增删
3. **split 表单化**：支持双远程节点的表单编辑
4. **高级配置面板**：runtime/notify/deploy 的表单化
5. **字段级帮助**：每个字段的详细说明和示例
6. **配置模板**：保存和加载自定义配置模板

---

## 六、验收标准

### 功能完整性
- ✅ 表单模式支持 all-in-one 和 hybrid
- ✅ YAML 模式支持所有拓扑
- ✅ 表单与 YAML 可双向切换
- ✅ preview 功能正常
- ✅ 启动部署功能正常
- ✅ SSE 状态展示完整
- ✅ 重试功能可用

### 代码质量
- ✅ `pnpm build` 通过
- ✅ 无 TypeScript 类型错误
- ✅ 代码结构清晰，易于维护

### 用户体验
- ✅ 必填字段有明确标识
- ✅ 错误提示清晰
- ✅ 表单校验实时反馈
- ✅ YAML 预览实时更新
- ✅ 模式切换流畅

---

## 七、文件改动清单

### 修改文件
- `packages/web/src/pages/SetupWizardPage.tsx`
  - 新增 `SetupMode` 和 `SetupFormState` 类型
  - 新增 `buildFormStateFromManifest` 函数
  - 新增 `buildManifestFromForm` 函数
  - 新增 `validateFormState` 函数
  - 新增表单模式 UI
  - 新增模式切换逻辑
  - 调整 `startMutation` 支持两种模式

### 新增文件
- `docs/setup-wizard-manual-verification.md`：手动验证清单
- `docs/setup-wizard-form-implementation-summary.md`：本文档

### 未改动文件
- 后端所有文件保持不变
- 其他前端页面保持不变
- 现有 UI 组件保持不变

---

## 八、使用指南

### 快速开始（表单模式）
1. 打开 Setup 向导页面
2. 选择 all-in-one 或 hybrid 拓扑
3. 填写必要字段
4. 点击"先校验配置"（可选）
5. 点击"确认并启动部署"
6. 观察实时执行状态

### 高级配置（YAML 模式）
1. 点击"YAML 模式"按钮
2. 直接编辑完整 YAML
3. 点击"确认并启动部署"
4. 观察实时执行状态

### 模式切换
- 表单 → YAML：点击"切到 YAML 模式"，自动生成 YAML
- YAML → 表单：点击"切回表单模式"，自动解析并回填（仅 all-in-one/hybrid）

---

## 九、总结

本次实现成功将 Setup 向导从"纯 YAML 编辑"升级为"表单 + YAML 双轨支持"，在保持原有灵活性的同时，大幅降低了 all-in-one 和 hybrid 拓扑的配置门槛。

实现严格遵循"最小可用版本优先"原则，仅修改一个前端文件，完全复用现有后端接口和 UI 组件，实现了功能完整、体验流畅的表单式配置能力。

后续可根据用户反馈和实际需求，逐步扩展为完整的 7 步向导或增加更多高级功能。
