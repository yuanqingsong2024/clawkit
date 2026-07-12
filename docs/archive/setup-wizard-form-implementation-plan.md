# Setup 向导表单式配置实现方案

> **方案状态**：设计阶段，未开始实施
> 
> **目标**：在当前"预设 + YAML 编辑"基础上，新增"逐字段填写式向导"能力

---

## 一、当前状态分析

### 1.1 已有能力

- ✅ 后端 schema 定义完整（`SetupManifestService.schema`）
- ✅ 后端预设配置加载（`/api/setup/defaults`）
- ✅ 后端 manifest 校验与预览（`/api/setup/manifest/preview`）
- ✅ 前端 YAML 编辑器
- ✅ 前端实时状态展示与 SSE
- ✅ 整轮重试机制

### 1.2 缺失能力

- ❌ 前端基于 schema 的动态表单渲染
- ❌ 逐字段填写 UI
- ❌ 表单与 YAML 的双向同步
- ❌ 分步骤向导流程
- ❌ 字段级实时校验

---

## 二、Schema 结构分析

### 2.1 字段类型清单

当前 schema 包含以下类型：

| 类型 | 示例字段 | 渲染需求 |
|---|---|---|
| `string` | `profile.name`, `services.openClaw.publicUrl` | 文本输入框 |
| `number` | `services.controller.port`, `runtime.promptEngine.temperature` | 数字输入框 |
| `boolean` | `runtime.memory.enabled`, `notify.enabled` | 开关/复选框 |
| `enum` | `profile.topology`, `runtime.promptEngine.mode` | 下拉选择/单选按钮组 |
| `literal` | `nodes[].type: 'local'` | 隐藏字段或只读标签 |
| `object` | `profile`, `services.controller` | 字段分组容器 |
| `array` | `workers`, `workers[].projects` | 动态列表（可增删） |
| `record` | `nodes` | 键值对映射（动态键名） |
| `union` | `nodes[].type` 的 local/ssh 分支 | 条件渲染（根据 discriminator） |

### 2.2 字段依赖关系

#### 拓扑依赖
- `profile.topology` 决定：
  - `all-in-one`：所有 node 引用必须指向同一个 local 节点
  - `hybrid`：controller/openClaw 在远程，worker 在本地
  - `split`：controller/openClaw 在 A 节点，worker 在 B 节点

#### 节点类型依赖
- `nodes[key].type === 'local'`：
  - 只需 `workDir`（可选）
- `nodes[key].type === 'ssh'`：
  - 必需：`host`, `user`, `workDir`
  - 可选：`port`, `keyPath`, `password`

#### 条件字段
- `runtime.promptEngine.mode === 'llm' | 'hybrid'`：
  - 需要 `provider`, `baseUrl`, `apiKeyEnv`, `model`
- `runtime.memory.provider === 'redis' | 'postgres'`：
  - 需要 `url`
- `runtime.memory.provider === 'local'`：
  - 需要 `path`

### 2.3 必填字段清单

**核心必填**（用户必须填写）：
- `profile.name`
- `profile.topology`
- `services.controller.node`
- `services.controller.port`
- `services.openClaw.node`
- `services.openClaw.publicUrl`
- `workers[].id`
- `workers[].node`
- `workers[].projects[].key`
- `workers[].projects[].repoPath`
- `workers[].projects[].openCode.port`

**有默认值的必填**（可不填，使用默认值）：
- `profile.version` (默认 `1.0.0`)
- `services.controller.apiPrefix` (默认 `/api`)
- `workers[].connectMode` (默认 `pull`)
- `workers[].projects[].baseBranch` (默认 `main`)
- `runtime.promptEngine.mode` (默认 `template`)
- `runtime.memory.enabled` (默认 `true`)

---

## 三、UI 流程设计

### 3.1 推荐方案：分步骤向导

**原因**：
- manifest 字段多（50+ 个有效字段）
- 字段间有依赖关系
- 分步可降低认知负担
- 符合"一键配置"的用户预期

### 3.2 步骤划分

#### 步骤 1：基础信息
- `profile.name`（必填）
- `profile.topology`（必填，单选）
- `profile.description`（可选）

**交互**：
- topology 选择后，显示拓扑说明与节点分配预览

---

#### 步骤 2：节点配置
- 根据 topology 自动生成节点模板
- 用户填写节点详情

**all-in-one**：
- 自动创建 `local-dev` 节点
- 只需填 `workDir`（可选，默认 `./.clawkit/local-dev`）

**hybrid**：
- 自动创建 `cloud-control`（ssh）和 `local-dev`（local）
- 用户填写：
  - `cloud-control.host`
  - `cloud-control.user`
  - `cloud-control.keyPath` 或 `password`
  - `cloud-control.workDir`

**split**：
- 自动创建 `node-a`（ssh）和 `node-b`（ssh）
- 用户填写两个节点的 ssh 信息

**交互**：
- 节点类型切换（local/ssh）
- ssh 认证方式切换（keyPath/password）

---

#### 步骤 3：服务配置
- `services.controller.port`（必填，默认 8080）
- `services.controller.apiPrefix`（必填，默认 `/api`）
- `services.openClaw.publicUrl`（必填）
- `services.openClaw.apiKey`（可选，敏感字段）

**交互**：
- controller.node 和 openClaw.node 根据 topology 自动填充
- publicUrl 根据 topology 给出示例

---

#### 步骤 4：Worker 配置
- 动态列表，至少 1 个 worker
- 每个 worker：
  - `id`（必填）
  - `node`（下拉，从已定义节点选择）
  - `connectMode`（默认 pull）
  - `tags`（可选，多标签输入）
  - `projects`（动态列表，至少 1 个）

**每个 project**：
- `key`（必填）
- `repoPath`（必填）
- `baseBranch`（默认 main）
- `openCode.port`（必填）
- `openCode.agent`（默认 build）
- `openCode.mode`（默认 default）

**交互**：
- 增删 worker
- 增删 project
- node 下拉根据 topology 过滤

---

#### 步骤 5：运行时配置（可选）
- `runtime.promptEngine.mode`（默认 template）
- 如果选 llm/hybrid：
  - `provider`
  - `baseUrl`
  - `apiKeyEnv`
  - `model`
- `runtime.memory.provider`（默认 local）
- 如果选 redis/postgres：
  - `url`
- 如果选 local：
  - `path`

**交互**：
- 折叠面板，默认收起
- 条件字段根据选择动态显示

---

#### 步骤 6：通知与部署（可选）
- `notify.enabled`（默认 false）
- 如果启用：
  - `channels`（多选）
  - 根据 channel 显示对应配置
- `deploy.timeout`
- `deploy.retryCount`
- `deploy.healthCheck.enabled`

**交互**：
- 折叠面板，默认收起

---

#### 步骤 7：预览与确认
- 显示完整 YAML 预览
- 显示配置摘要卡片
- 提供"返回修改"和"启动部署"按钮

---

### 3.3 必填/可选标识

- 必填字段：标题后加红色 `*`
- 可选字段：标题后加灰色 `(可选)`
- 有默认值的字段：placeholder 显示默认值

### 3.4 校验时机

- **实时校验**：
  - 字段失焦时校验单个字段
  - 显示字段级错误提示
- **步骤切换校验**：
  - 点击"下一步"时校验当前步骤所有必填字段
  - 如有错误，阻止切换并高亮错误字段
- **提交前校验**：
  - 调用后端 `/api/setup/manifest/preview` 做最终校验
  - 如有错误，跳转到对应步骤并显示错误

---

## 四、Schema 到组件映射规则

### 4.1 基础类型映射

| Schema 类型 | React 组件 | Props |
|---|---|---|
| `string` | `<Input type="text" />` | `value`, `onChange`, `placeholder`, `required` |
| `number` | `<Input type="number" />` | `value`, `onChange`, `min`, `max`, `step` |
| `boolean` | `<Switch />` 或 `<Checkbox />` | `checked`, `onChange` |
| `enum` | `<Select />` 或 `<RadioGroup />` | `value`, `onChange`, `options` |

### 4.2 复杂类型映射

#### `object`
- 渲染为字段分组
- 使用 `<fieldset>` 或 `<Card>` 包裹
- 递归渲染 `properties`

#### `array`
- 渲染为动态列表
- 提供"添加"/"删除"按钮
- 每个 item 递归渲染 `items` schema

#### `record`
- 渲染为键值对列表
- 提供"添加键值对"按钮
- key 用 `<Input type="text" />`
- value 递归渲染 `recordValue` schema

#### `union`
- 根据 discriminator 字段（如 `type`）条件渲染
- 先渲染 discriminator 选择器
- 根据选择动态显示对应分支的字段

### 4.3 特殊字段处理

#### 敏感字段
- `services.openClaw.apiKey`
- `nodes[].password`
- `runtime.promptEngine.apiKeyEnv`

渲染为：
- `<Input type="password" />`
- 提供"显示/隐藏"切换按钮

#### 路径字段
- `nodes[].workDir`
- `workers[].projects[].repoPath`
- `runtime.memory.path`

渲染为：
- `<Input type="text" />` + 文件选择按钮（如果是本地节点）

#### URL 字段
- `services.openClaw.publicUrl`
- `runtime.memory.url`

渲染为：
- `<Input type="url" />`
- 实时校验 URL 格式

---

## 五、表单状态管理方案

### 5.1 推荐方案：React Hook Form

**理由**：
- 性能优秀（非受控组件）
- 内置校验支持
- 与 Zod schema 集成良好
- 社区成熟

### 5.2 状态结构

```typescript
interface FormState {
  profile: {
    name: string;
    version: string;
    topology: 'all-in-one' | 'hybrid' | 'split';
    description?: string;
  };
  nodes: Record<string, LocalNode | SshNode>;
  services: {
    controller: { node: string; port: number; apiPrefix: string };
    openClaw: { node: string; publicUrl: string; apiKey?: string };
  };
  workers: Array<{
    id: string;
    node: string;
    connectMode: 'pull' | 'push';
    tags: string[];
    projects: Array<{
      key: string;
      repoPath: string;
      baseBranch: string;
      openCode: { port: number; agent: string; mode: string };
    }>;
  }>;
  runtime: { ... };
  notify?: { ... };
  deploy?: { ... };
}
```

### 5.3 与 YAML 预览联动

**方案**：
- 表单状态变化时，实时转换为 YAML
- 使用 `yaml.stringify(formData)` 生成预览
- 在"预览与确认"步骤显示完整 YAML
- 提供"复制 YAML"按钮

**实现**：
```typescript
const formData = useWatch({ control });
const yamlPreview = useMemo(() => {
  try {
    return yaml.stringify(formData);
  } catch {
    return '# YAML 生成失败';
  }
}, [formData]);
```

---

## 六、向导与 YAML 编辑器切换机制

### 6.1 两种模式共存

**方案**：
- 页面顶部提供模式切换按钮
- "表单向导" ⇄ "YAML 编辑器"
- 切换时保留数据

### 6.2 数据同步策略

#### 表单 → YAML
- 表单数据实时转换为 YAML
- 切换到 YAML 模式时，直接显示转换结果

#### YAML → 表单
- 用户在 YAML 模式编辑后，切换回表单模式
- 解析 YAML 并填充表单
- 如果解析失败，显示错误并阻止切换

**实现**：
```typescript
const [mode, setMode] = useState<'form' | 'yaml'>('form');
const [formData, setFormData] = useState<FormState>(defaultFormData);
const [yamlText, setYamlText] = useState<string>('');

const switchToYaml = () => {
  setYamlText(yaml.stringify(formData));
  setMode('yaml');
};

const switchToForm = () => {
  try {
    const parsed = yaml.parse(yamlText);
    setFormData(parsed);
    setMode('form');
  } catch (error) {
    alert('YAML 解析失败，请检查语法');
  }
};
```

### 6.3 用户体验优化

- 切换前提示"未保存的更改将丢失"
- 提供"从预设加载"按钮（两种模式都支持）
- YAML 模式保留语法高亮与自动补全

---

## 七、实现任务拆解

### 7.1 阶段 1：基础表单组件库（2-3 天）

**任务**：
- [ ] 创建基础表单组件
  - `FormInput`（text/number/url/password）
  - `FormSelect`（下拉选择）
  - `FormSwitch`（开关）
  - `FormRadioGroup`（单选按钮组）
  - `FormTextarea`（多行文本）
- [ ] 创建复合组件
  - `FormFieldset`（字段分组）
  - `FormArrayField`（动态列表）
  - `FormRecordField`（键值对）
- [ ] 集成 react-hook-form
- [ ] 添加字段级校验与错误提示

**文件清单**：
- `packages/web/src/components/form/FormInput.tsx`
- `packages/web/src/components/form/FormSelect.tsx`
- `packages/web/src/components/form/FormSwitch.tsx`
- `packages/web/src/components/form/FormRadioGroup.tsx`
- `packages/web/src/components/form/FormFieldset.tsx`
- `packages/web/src/components/form/FormArrayField.tsx`
- `packages/web/src/components/form/FormRecordField.tsx`
- `packages/web/src/components/form/index.ts`

---

### 7.2 阶段 2：Schema 渲染引擎（3-4 天）

**任务**：
- [ ] 实现 schema 到组件的映射逻辑
- [ ] 支持递归渲染 object/array/record
- [ ] 支持 union 条件渲染
- [ ] 支持默认值填充
- [ ] 支持必填/可选标识

**文件清单**：
- `packages/web/src/components/form/SchemaRenderer.tsx`
- `packages/web/src/components/form/SchemaField.tsx`
- `packages/web/src/hooks/useSchemaForm.ts`
- `packages/web/src/utils/schemaToFormConfig.ts`

---

### 7.3 阶段 3：分步骤向导 UI（4-5 天）

**任务**：
- [ ] 创建向导容器组件
- [ ] 实现步骤导航（上一步/下一步）
- [ ] 实现步骤间校验
- [ ] 实现 7 个步骤页面
  - 步骤 1：基础信息
  - 步骤 2：节点配置
  - 步骤 3：服务配置
  - 步骤 4：Worker 配置
  - 步骤 5：运行时配置
  - 步骤 6：通知与部署
  - 步骤 7：预览与确认
- [ ] 实现拓扑依赖逻辑
- [ ] 实现节点类型切换
- [ ] 实现条件字段显示

**文件清单**：
- `packages/web/src/components/setup-wizard/WizardContainer.tsx`
- `packages/web/src/components/setup-wizard/WizardStep.tsx`
- `packages/web/src/components/setup-wizard/WizardNavigation.tsx`
- `packages/web/src/components/setup-wizard/steps/Step1BasicInfo.tsx`
- `packages/web/src/components/setup-wizard/steps/Step2Nodes.tsx`
- `packages/web/src/components/setup-wizard/steps/Step3Services.tsx`
- `packages/web/src/components/setup-wizard/steps/Step4Workers.tsx`
- `packages/web/src/components/setup-wizard/steps/Step5Runtime.tsx`
- `packages/web/src/components/setup-wizard/steps/Step6NotifyDeploy.tsx`
- `packages/web/src/components/setup-wizard/steps/Step7Preview.tsx`
- `packages/web/src/hooks/useWizardState.ts`

---

### 7.4 阶段 4：模式切换与数据同步（2-3 天）

**任务**：
- [ ] 实现表单/YAML 模式切换
- [ ] 实现表单 → YAML 转换
- [ ] 实现 YAML → 表单解析
- [ ] 实现切换前确认提示
- [ ] 实现 YAML 预览实时更新

**文件清单**：
- `packages/web/src/components/setup-wizard/ModeSwitch.tsx`
- `packages/web/src/hooks/useFormYamlSync.ts`
- `packages/web/src/utils/formToYaml.ts`
- `packages/web/src/utils/yamlToForm.ts`

---

### 7.5 阶段 5：集成与测试（2-3 天）

**任务**：
- [ ] 替换 `SetupWizardPage` 为新向导
- [ ] 保留 YAML 编辑器作为备用模式
- [ ] 端到端测试
- [ ] 修复 bug
- [ ] 更新文档

**文件清单**：
- `packages/web/src/pages/SetupWizardPage.tsx`（重构）
- `docs/setup-wizard.md`（更新）

---

## 八、接口变更

### 8.1 无需新增接口

当前后端接口已足够：
- `GET /api/setup/schema` ✅
- `GET /api/setup/defaults` ✅
- `POST /api/setup/manifest/preview` ✅
- `POST /api/setup/runs` ✅

### 8.2 可选优化

如果需要更好的用户体验，可考虑：

#### 新增：拓扑模板接口
```http
GET /api/setup/topology-templates/:topology
```

返回：
- 该拓扑的节点模板
- 该拓扑的字段约束
- 该拓扑的示例配置

**优先级**：低（可后续优化）

---

## 九、风险点与应对

### 9.1 风险：Schema 复杂度高

**表现**：
- union 类型渲染复杂
- record 类型动态键名难处理
- 嵌套层级深（workers[].projects[].openCode）

**应对**：
- 先实现核心字段，复杂字段降级为 YAML 编辑
- 提供"高级配置"入口，跳转到 YAML 模式
- 分阶段实现，先支持 all-in-one，再支持 hybrid/split

---

### 9.2 风险：表单状态管理复杂

**表现**：
- 动态列表增删
- 条件字段显示/隐藏
- 跨步骤数据依赖

**应对**：
- 使用 react-hook-form 的 `useFieldArray`
- 使用 `useWatch` 监听依赖字段
- 每个步骤独立管理，通过 context 共享全局状态

---

### 9.3 风险：YAML ⇄ 表单转换丢失信息

**表现**：
- YAML 注释丢失
- 字段顺序变化
- 未知字段被过滤

**应对**：
- 明确告知用户"切换模式会丢失注释"
- 提供"导出 YAML"功能，保留原始格式
- 对未知字段给出警告，但不阻止

---

### 9.4 风险：向导流程过长

**表现**：
- 7 个步骤可能让用户感到繁琐
- 用户可能想跳过某些步骤

**应对**：
- 提供"快速模式"：只填必填字段，其余用默认值
- 提供"从预设加载"：直接加载 all-in-one/hybrid 预设
- 允许跳过可选步骤（步骤 5/6）

---

## 十、验收标准

### 10.1 功能验收

- [ ] 用户可通过表单向导填写所有必填字段
- [ ] 用户可通过表单向导填写所有可选字段
- [ ] 表单实时校验生效
- [ ] 步骤切换校验生效
- [ ] 提交前后端校验生效
- [ ] 表单 ⇄ YAML 模式切换正常
- [ ] 数据同步无丢失（除注释外）
- [ ] 拓扑切换时节点配置自动调整
- [ ] 节点类型切换时字段动态显示
- [ ] 动态列表增删正常
- [ ] 预览 YAML 正确
- [ ] 启动部署流程正常

---

### 10.2 体验验收

- [ ] 表单加载速度 < 1s
- [ ] 字段切换无明显卡顿
- [ ] 错误提示清晰易懂
- [ ] 必填/可选标识明确
- [ ] 默认值自动填充
- [ ] 敏感字段隐藏显示
- [ ] 移动端适配良好

---

### 10.3 兼容性验收

- [ ] 现有 YAML 编辑器功能不受影响
- [ ] 现有预设加载功能正常
- [ ] 现有 SSE 状态展示正常
- [ ] 现有重试功能正常
- [ ] 后端接口无破坏性变更

---

## 十一、实施建议

### 11.1 分阶段实施

**第一阶段（MVP）**：
- 只支持 all-in-one 拓扑
- 只实现核心必填字段
- 复杂字段降级为 YAML 编辑
- 预计工期：7-10 天

**第二阶段（完整版）**：
- 支持 hybrid/split 拓扑
- 支持所有可选字段
- 完整 schema 渲染
- 预计工期：10-15 天

### 11.2 技术选型

**推荐**：
- 表单库：`react-hook-form` + `@hookform/resolvers`
- 校验库：`zod`（已有）
- YAML 库：`yaml`（已有）
- UI 组件：基于现有 `packages/web/src/components/ui`

### 11.3 开发顺序

1. 基础表单组件库
2. Schema 渲染引擎
3. all-in-one 拓扑向导（MVP）
4. 模式切换与数据同步
5. hybrid/split 拓扑支持
6. 可选字段与高级配置
7. 测试与优化

---

## 十二、总结

### 12.1 核心价值

实现后，用户可以：
- **无需了解 YAML 语法**，通过表单填写配置
- **逐步引导**，降低配置复杂度
- **实时校验**，减少配置错误
- **灵活切换**，高级用户仍可用 YAML

### 12.2 工作量估算

- **MVP（all-in-one）**：7-10 天
- **完整版（三种拓扑）**：15-20 天
- **测试与优化**：3-5 天

**总计**：20-25 天（单人全职）

### 12.3 后续优化方向

- 配置模板管理（保存/加载自定义模板）
- 配置对比（对比两个配置的差异）
- 配置导入/导出（JSON/YAML/TOML）
- 配置历史记录（版本管理）
- 多语言支持（i18n）

---

**方案状态**：✅ 设计完成，待评审与实施决策
