# ClawKit Web Console 文档

## 定位

ClawKit Web Console 是 clawkit 项目的**轻量可视化外壳**，为现有 CLI / controller / worker 能力提供 Web 界面，方便单人自用部署、运维与任务确认场景。

**核心原则**：
- Web Console 只是现有能力的可视化，不重做核心逻辑
- 不是独立业务系统，不是复杂管理后台
- 保持最小可用版本，优先服务自用场景

## 与现有组件的关系

```
┌─────────────────────────────────────────────────────────┐
│                    Web Console (前端)                    │
│                  packages/web (React)                    │
└─────────────────────────────────────────────────────────┘
                            │ HTTP /api/*
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Controller (后端)                     │
│              packages/controller (Fastify)               │
│  ┌─────────────────────────────────────────────────┐   │
│  │  WebConsoleService (适配层)                      │   │
│  │  - 复用 CLI 服务类                                │   │
│  │  - 封装 doctor/plan/apply/heal                   │   │
│  │  - 聚合 overview 数据                             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    CLI 服务层                            │
│              packages/cli/services                       │
│  - DoctorServiceImpl                                    │
│  - PlanServiceImpl                                      │
│  - ApplyService                                         │
│  - HealService                                          │
│  - ManifestLoader                                       │
└─────────────────────────────────────────────────────────┘
```

## 当前阶段支持的功能

### 1. 总览页（/）
- 系统信息：profile、topology、manifestPath
- Controller 状态：在线状态、publicUrl、运行提示
- Workers 统计与列表：total、online、idle、busy、offline
- OpenClaw 状态：配置状态、publicUrl、token 状态
- OpenCode 状态列表：workerId、projectKey、port、status
- 最近任务列表：taskId、intent、status、updatedAt
- 告警列表：level、title、detail

### 2. 配置页（/config）
- 查看当前 manifest（YAML 格式）
- 编辑 manifest 关键字段
- 保存 manifest 到文件
- 基础校验提示
- 运行态刷新提示

### 3. 部署页（/deploy）
- Doctor：环境检查
- Plan：生成部署计划
- Apply（预览）：预览将生成的文件
- Apply（执行）：真实执行部署
- 展示执行步骤、状态、日志、建议

### 4. 修复页（/heal）
- Heal（预览）：诊断问题
- Heal（执行）：自动修复
- 展示诊断结果、可修复项、执行结果

### 5. 状态页（/status）
- Controller 状态详情
- Workers 列表与心跳状态
- OpenClaw 配置状态
- OpenCode 服务状态

### 6. 任务中心页（/tasks）
- 任务列表：taskId、projectKey、intent、status
- 任务详情：taskDraft、promptDraft、executionSummary
- 修改草案：提交修改意见
- 确认派发：批准任务执行
- 取消任务：取消待执行任务

## 当前阶段不支持的功能

- 复杂权限系统
- 多租户
- 复杂图表系统
- 拖拽式流程编排
- 自动 PR 页面
- 复杂节点管理平台
- WebSocket 大屏监控
- 实时日志流

## 技术栈

### 前端（packages/web）
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- @tanstack/react-query

### 后端（packages/controller）
- Fastify
- TypeScript
- 复用 CLI 服务类

## 启动方式

### 1. 启动 Controller
```bash
# 构建
pnpm --filter @clawkit/controller build

# 设置环境变量
export CLAWKIT_MANIFEST_PATH=/path/to/your/clawkit.yaml

# 启动
pnpm --filter @clawkit/controller start
```

Controller 默认监听 `http://localhost:8787`

### 2. 启动 Web Console
```bash
# 开发模式
pnpm --filter @clawkit/web dev

# 构建生产版本
pnpm --filter @clawkit/web build
```

Web Console 默认访问 `http://localhost:5173`，API 请求会自动代理到 Controller。

## 生产部署最小说明

### 1. 构建产物输出目录

- Web Console 生产构建目录固定为 `packages/web/dist`
- Vite `base` 固定为 `/`
- 这意味着当前生产部署默认假设：**Web Console 挂载在站点根路径**，不是子路径

构建命令：

```bash
pnpm --filter @clawkit/web build
```

### 2. 静态资源服务方式

当前推荐两种最小方式：

#### 方式 A：Controller 直接托管（推荐用于内部试运行）

- Controller 启动后会自动探测 Web Console 构建产物
- 默认探测顺序：
  1. `WEB_CONSOLE_DIST_DIR`
  2. 仓库内默认路径 `packages/web/dist`
- 若找到 `index.html`，则自动托管前端静态资源

示例：

```bash
export CLAWKIT_MANIFEST_PATH=/path/to/clawkit.yaml
export WEB_CONSOLE_DIST_DIR=/path/to/clawkit/packages/web/dist
pnpm --filter @clawkit/controller start
```

#### 方式 B：反向代理单独托管静态文件

- 由 Nginx / Caddy 直接托管 `packages/web/dist`
- `/api/*` 反向代理到 controller
- 适合后续需要 TLS、域名、统一入口的场景

### 3. 路由 fallback 方式

- 前端使用 `BrowserRouter`
- 因此生产环境必须对**非文件请求**启用 SPA fallback
- 即：当请求不是 `/api/*`，且也不是实际存在的静态文件时，必须返回 `index.html`

需要保证下列路由都能返回 `index.html`：

- `/`
- `/config`
- `/deploy`
- `/heal`
- `/status`
- `/tasks`
- `/tasks/:taskId`

### 4. API 代理方式

- Web Console 前端固定通过 `/api/*` 调用后端
- 推荐部署方式是**同源部署**：前端页面与 API 在同一域名下
- 若使用反向代理，需要明确保留 `/api/*` 给 controller，不能被静态 fallback 覆盖

Nginx 最小示例：

```nginx
server {
    listen 80;
    server_name _;

    root /srv/clawkit/packages/web/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 5. 推荐部署方式

当前阶段推荐：

1. 先执行 `pnpm --filter @clawkit/web build`
2. 使用 **Controller 直接托管** 完成内部试运行
3. 若需要域名 / TLS，再在前面加一层 Nginx / Caddy

不建议在当前阶段做：

- 子路径部署（例如 `/console/`）
- 前后端跨域分离部署
- 复杂 CDN / 多层缓存编排

## 重要提示

### Manifest 保存与运行态

**关键**：manifest 保存后不会自动刷新 controller/worker 运行态。

- 保存 manifest 只是写入文件
- Controller 的 `ProjectRegistry` 在启动时一次性加载
- Worker 的配置也在启动时加载

**如需让新配置生效**：
1. 保存 manifest
2. 重启 controller 进程
3. 重启 worker 进程
4. 重启 OpenCode 服务（如端口或路径变更）

### manifest 路径配置

- 仍支持通过 `CLAWKIT_MANIFEST_PATH` 在 controller 启动前指定 manifest 文件。
- Web Console「配置」页现在也支持保存 manifest 路径。
- 页面保存的路径会持久化到 `data/controller-config.json`，并优先于 `CLAWKIT_MANIFEST_PATH` 生效。
- 保存路径后 controller 会立即切换读取目标；worker 仍需手动重启以同步运行配置。

### Apply/Heal 的副作用

- `doctor` 和 `plan` 是只读操作，可随时执行
- `apply` 和 `heal` 会写入文件、执行 SSH 命令，需谨慎
- 默认 `dryRun=true`，真实执行需显式确认 `confirmExecution=true`

### API 前缀

- Controller 的 API 前缀固定为 `/api`
- Manifest 中的 `services.controller.apiPrefix` 当前未生效
- Web Console 的 Vite 配置已将 `/api` 代理到 `http://localhost:8787`

## 验收标准

- [ ] Web Console 可启动（`pnpm --filter @clawkit/web dev`）
- [ ] 6 个页面路由可访问
- [ ] 总览页能展示系统概览
- [ ] 配置页能查看和保存 manifest
- [ ] 部署页能触发 doctor/plan/apply
- [ ] 修复页能触发 heal
- [ ] 状态页能查看 controller/worker/OpenCode/OpenClaw 状态
- [ ] 任务中心能查看任务列表和详情

## 后续扩展方向

- 实时日志流（需 worker 增量上报）
- Manifest 表单化编辑（当前为 YAML 文本）
- 任务执行进度实时更新
- 更丰富的图表展示
- 配置模板库
