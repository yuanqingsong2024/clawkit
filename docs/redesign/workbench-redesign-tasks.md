# ClawKit Web Console 工作台风格重构

> 重构日期：2026-07-15
> 重构目标：将管理后台风格转换为专业工具工作台风格

---

## 一、重构背景

### 1.1 原有问题

- **顶部导航**：横向导航栏占用顶部空间，切换页面需要移动鼠标到顶部
- **大留白**：卡片间距过大，信息密度低
- **渐变背景**：视觉上偏"展示型 Dashboard"，不符合工具软件定位
- **缺少状态栏**：无法快速查看系统运行状态

### 1.2 重构目标

| 目标 | 描述 |
|------|------|
| 更专业的工具感 | 参考 VS Code、终端等 IDE 工具的界面设计 |
| 更高的信息密度 | 紧凑布局，适合管理多项目、多流水线 |
| 更清晰的层级 | 深色侧边栏作为固定锚点 |
| 更好的沉浸感 | 减少视觉干扰，聚焦内容 |

---

## 二、设计方案

### 2.1 布局结构调整

**原布局**：
```
┌─────────────────────────────────────────────────────┐
│  Header (Logo + 横向导航 + 版本信息)                    │
├─────────────────────────────────────────────────────┤
│  渐变背景                                             │
│  ┌───────────────────────────────────────────────┐  │
│  │ 大白色卡片 (PageHeader + 内容)                  │  │
│  └───────────────────────────────────────────────┘  │
│  Footer                                             │
└─────────────────────────────────────────────────────┘
```

**新布局**：
```
┌────────┬────────────────────────────────────────────┐
│        │  内容区 Header (页面标题 + 操作)            │
│  深色  ├────────────────────────────────────────────┤
│  侧边  │                                            │
│  栏    │  浅色内容区（紧凑面板）                     │
│        │                                            │
│  导    │                                            │
│  航    │                                            │
│        │                                            │
├────────┴────────────────────────────────────────────┤
│  底部状态栏 (服务状态 + 版本 + 时间)                   │
└─────────────────────────────────────────────────────┘
```

### 2.2 侧边栏设计

| 属性 | 值 |
|------|-----|
| 背景色 | `bg-slate-900` |
| 宽度 | 224px（可折叠至 64px） |
| 选中项背景 | `bg-blue-600` |
| 未选中文字 | `text-slate-400` |
| 选中文字 | `text-white` |
| Hover 效果 | `hover:bg-slate-800` |

**导航结构**：
```
┌──────────────────┐
│ 🦞 ClawKit       │  ← Logo + 品牌
├──────────────────┤
│ 📊 总览          │
│ 🔄 流水线        │
│ 🧩 插件市场      │
│ 📁 项目          │
│ 📋 任务中心      │
│ 📜 日志          │
│ ⚙️ 配置          │
├──────────────────┤
│ ← 收起           │  ← 折叠按钮
│ v0.3.0          │  ← 版本信息
└──────────────────┘
```

### 2.3 内容区设计

| 属性 | 值 |
|------|-----|
| 背景色 | `bg-slate-50` |
| 卡片背景 | `bg-white` |
| 卡片边框 | `border border-slate-200` |
| 卡片阴影 | `shadow-sm`（轻阴影） |
| 内边距 | 紧凑化（p-3 而非 p-5） |

### 2.4 底部状态栏

| 属性 | 值 |
|------|-----|
| 高度 | 28px |
| 背景色 | `bg-slate-100` |
| 文字大小 | `text-xs` |
| 内容 | 版本号 + 当前时间 |

### 2.5 配色方案

**侧边栏**：
```css
bg-slate-900      /* 背景 */
text-slate-400     /* 未选中文字 */
text-white         /* 选中文字 */
bg-blue-600        /* 选中项背景 */
hover:bg-slate-800 /* hover 效果 */
```

**内容区**：
```css
bg-slate-50        /* 页面背景 */
bg-white           /* 卡片背景 */
border-slate-200   /* 边框 */
text-slate-900     /* 标题 */
text-slate-600     /* 正文 */
text-slate-400     /* 次要文字 */
```

---

## 三、任务清单

### 阶段一：核心布局 ✅ 已完成

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 1.1 | 实现左侧深色导航栏 | `Layout.tsx` | ✅ 完成 |
| 1.2 | 添加折叠/展开功能 | `Layout.tsx` | ✅ 完成 |
| 1.3 | 实现内容区 Header | `Layout.tsx` | ✅ 完成 |
| 1.4 | 实现底部状态栏 | `Layout.tsx` | ✅ 完成 |
| 1.5 | 路由集成 | `Layout.tsx` | ✅ 完成 |
| 1.6 | 添加自定义滚动条样式 | `index.css` | ✅ 完成 |
| 1.7 | 添加选中和 focus 样式 | `index.css` | ✅ 完成 |

### 阶段二：组件适配 ✅ 已完成

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 2.1 | 调整 Card 阴影和边框 | `Card.tsx` | ✅ 完成 |
| 2.2 | 调整 PageHeader 标题大小和间距 | `PageHeader.tsx` | ✅ 完成 |
| 2.3 | 新增工作台配色变量 | `styles.ts` | ✅ 完成 |
| 2.4 | 调整按钮样式（紧凑版） | `styles.ts` | ✅ 完成 |
| 2.5 | 调整输入框样式 | `styles.ts` | ✅ 完成 |

### 阶段三：页面微调 🔄 进行中

| 序号 | 任务 | 文件 | 状态 |
|------|------|------|------|
| 3.1 | 优化 Dashboard 卡片布局为更紧凑的网格 | `DashboardPage.tsx` | ✅ 完成 |
| 3.2 | 调整服务状态卡片显示方式 | `DashboardPage.tsx` | ✅ 完成 |
| 3.3 | 优化 Pipeline 列表布局密度 | `PipelineListPage.tsx` | 🔄 待完成 |
| 3.4 | 优化其他页面间距和布局 | 其他页面 | 🔄 待完成 |

---

## 四、修改文件清单

### 4.1 核心文件修改

| 文件路径 | 修改类型 | 主要变更 |
|----------|----------|----------|
| `packages/web/src/components/Layout.tsx` | 重写 | 从顶部导航改为左侧深色导航栏 |
| `packages/web/src/index.css` | 更新 | 添加自定义滚动条、选中等样式 |
| `packages/web/src/components/ui/Card.tsx` | 更新 | 调整阴影 `shadow-xl` → `shadow-sm` |
| `packages/web/src/components/ui/PageHeader.tsx` | 更新 | 调整标题 `text-2xl` → `text-base` |
| `packages/web/src/components/ui/styles.ts` | 更新 | 新增侧边栏配色、紧凑按钮样式 |
| `packages/web/src/pages/DashboardPage.tsx` | 更新 | 优化卡片布局为紧凑网格 |

### 4.2 待优化页面（未开始）

| 页面 | 文件路径 | 优化建议 |
|------|----------|----------|
| 流水线列表 | `PipelineListPage.tsx` | 调整网格布局密度 |
| 流水线详情 | `PipelineDetailPage.tsx` | 优化面板布局 |
| 流水线创建 | `PipelineCreatePage.tsx` | 优化表单布局 |
| 插件市场 | `PluginMarketPage.tsx` | 调整卡片网格 |
| 插件管理 | `PluginListPage.tsx` | 优化列表布局 |
| 项目管理 | `ProjectsPage.tsx` | 调整页面结构 |
| 任务中心 | `TasksPage.tsx` | 优化任务列表 |
| 任务详情 | `TaskDetailPage.tsx` | 调整详情面板 |
| 配置页面 | `ConfigPage.tsx` | 优化编辑器布局 |
| 日志页面 | `LogsPage.tsx` | 优化日志显示 |
| 设置向导 | `SetupPage.tsx` | 调整步骤布局 |

---

## 五、技术实现细节

### 5.1 Layout 组件核心实现

```tsx
// 侧边栏组件结构
<aside className="w-56 bg-slate-900">
  {/* Logo 区域 */}
  <div className="h-14 flex items-center gap-3 border-b border-slate-800">
    <Logo />
    <BrandName />
  </div>

  {/* 导航菜单 */}
  <nav className="flex-1 overflow-y-auto py-2 px-2">
    <NavLink items={navItems} />
  </nav>

  {/* 底部区域 */}
  <div className="border-t border-slate-800">
    <CollapseButton />
    <VersionInfo />
  </div>
</aside>
```

### 5.2 响应式布局

- 侧边栏宽度：`w-56`（224px）
- 折叠后宽度：`w-16`（64px）
- 内容区：`flex-1 overflow-hidden`
- 卡片网格：`grid-cols-2 lg:grid-cols-4`

### 5.3 导航状态管理

```tsx
// NavLink 使用 react-router-dom 的 useLocation
const location = useLocation();

// 页面标题映射
const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/': { title: '总览', subtitle: '系统运行状态' },
  '/pipelines': { title: '流水线', subtitle: '管理和执行 AI 工作流' },
  // ...
};

// 动态获取当前页面信息
const getPageInfo = () => {
  if (pageTitles[location.pathname]) {
    return pageTitles[location.pathname];
  }
  // 前缀匹配（用于详情页）
  // ...
};
```

---

## 六、后续优化建议

### 6.1 功能增强

- [ ] 添加侧边栏折叠状态持久化（localStorage）
- [ ] 添加键盘快捷键支持（如 `Ctrl+B` 切换侧边栏）
- [ ] 添加面包屑导航
- [ ] 添加全局搜索功能

### 6.2 样式优化

- [ ] 添加暗色主题切换
- [ ] 优化深色模式下的配色
- [ ] 添加更多动画效果
- [ ] 优化移动端适配

### 6.3 性能优化

- [ ] 添加路由懒加载
- [ ] 优化大型列表的虚拟滚动
- [ ] 添加骨架屏加载状态

---

## 七、测试清单

- [ ] 侧边栏导航切换正常
- [ ] 侧边栏折叠/展开功能正常
- [ ] 内容区页面显示正常
- [ ] 底部状态栏显示正常
- [ ] 滚动条样式正常
- [ ] 响应式布局正常
- [ ] 桌面模式标识显示正常
- [ ] 所有页面功能正常

---

## 八、相关文档

- [项目协作规则](../AGENTS.md)
- [项目范围说明](../docs/project-scope.md)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Router 文档](https://reactrouter.com/docs)

---

*文档生成时间：2026-07-15*
