# 技术债务治理计划

> 版本：v1.0.0 | 更新日期：2026-07-09

---

## 概述

本文档记录 ClawKit 项目中已知的技术债务，以及清理计划。

**技术债务定义**：指为了快速交付而采取的不完美技术方案，以及由此产生的后续维护成本。

---

## 待治理项清单

### TD-001：编译产物混入源码目录

| 属性 | 值 |
|-----|---|
| 编号 | TD-001 |
| 优先级 | P0 |
| 影响 | 代码污染、版本混乱 |
| 风险 | 中 |

**问题描述**
- packages/cli/src/services 目录同时存在 .ts/.js/.d.ts
- 疑似提交了编译产物到源码目录
- 可能导致 IDE 提示混乱

**涉及文件**
```
packages/cli/src/services/
├── apply.service.ts  ✅ 源码
├── apply.service.js  ❌ 编译产物
├── apply.service.d.ts  ❌ 编译产物
├── doctor.service.ts  ✅ 源码
├── doctor.service.js  ❌ 编译产物
└── ...
```

**清理方案**
```bash
# 1. 删除所有 .js 和 .d.ts 文件
find packages -name "*.js" -not -path "*/node_modules/*" -delete
find packages -name "*.d.ts" -not -path "*/node_modules/*" -delete

# 2. 确保 .gitignore 正确
echo "dist/" >> .gitignore
echo "*.js" >> .gitignore
echo "*.d.ts" >> .gitignore

# 3. 重新构建验证
pnpm build
```

**验收标准**
- packages/*/src 只有 .ts 文件
- .gitignore 正确排除编译产物
- 构建后 dist/ 目录包含正确产物

---

### TD-002：版本号不一致

| 属性 | 值 |
|-----|---|
| 编号 | TD-002 |
| 优先级 | P0 |
| 影响 | 发布混乱、版本追踪困难 |
| 风险 | 高 |

**问题描述**
- 根 package.json、cli、controller 等多处版本不一致
- CLI index.ts 显示 0.2.0，与 package.json 的 0.1.0 冲突
- 难以确定当前真实版本

**涉及文件**
- `package.json` (version: "0.1.0")
- `packages/cli/package.json` (version: "0.1.0")
- `packages/cli/src/index.ts` (VERSION = "0.2.0")
- `packages/controller/package.json` (version: "0.1.0")
- `packages/worker/package.json` (version: "0.1.0")
- `packages/web/package.json` (version: "0.1.0")
- `packages/shared/package.json` (version: "0.1.0")

**清理方案**
```yaml
# 1. 统一版本管理（根 package.json）
{
  "name": "clawkit",
  "version": "0.2.0",
  "workspaces": ["packages/*"],
  "scripts": {
    "version:check": "node scripts/version-check.js"
  }
}

# 2. 子包引用根版本
{
  "name": "@clawkit/cli",
  "version": "0.2.0",  # 保持与根一致
  "dependencies": {
    "@clawkit/shared": "workspace:*"
  }
}

# 3. 版本检查脚本
// scripts/version-check.js
const rootPkg = require('./package.json');
const packages = ['cli', 'controller', 'worker', 'web', 'shared'];

packages.forEach(pkg => {
  const pkgJson = require(`./packages/${pkg}/package.json`);
  if (pkgJson.version !== rootPkg.version) {
    console.error(`版本不一致: ${pkg} (${pkgJson.version}) vs root (${rootPkg.version})`);
    process.exit(1);
  }
});
```

**验收标准**
- 所有 package.json 版本一致
- CLI --version 输出正确
- CI 检查版本一致性

---

### TD-003：文档与代码不同步

| 属性 | 值 |
|-----|---|
| 编号 | TD-003 |
| 优先级 | P1 |
| 影响 | 用户困惑、维护困难 |
| 风险 | 中 |

**问题描述**
- architecture.md 描述"未实现业务逻辑/网络通信/真实部署执行"
- 实际上已实现一键部署、webhook 接入等能力
- 文档与实际能力存在明显差异

**涉及文件**
- `docs/architecture.md`
- `docs/one-click-deployment.md`
- 多个功能文档可能过时

**清理方案**
1. 文档审查
   - 对比 architecture.md 与实际代码
   - 标记过时内容
   - 补充缺失功能说明

2. 文档更新流程
   ```markdown
   <!-- 文档头部添加 -->
   > ⚠️ 最后更新：2026-07-09 | 对应版本：v0.3.x
   
   <!-- 功能说明 -->
   ## 功能说明
   
   ### 已实现 ✅
   - 功能 A
   - 功能 B
   
   ### 计划中 🚧
   - 功能 C
   
   ### 已知限制 ⚠️
   - 限制 A
   ```

3. CI 检查（可选）
   - 文档修改触发构建
   - 验证文档中的链接有效性

**验收标准**
- architecture.md 与实际能力一致
- 文档包含版本标记
- 关键文档链接有效

---

### TD-004：测试覆盖不均

| 属性 | 值 |
|-----|---|
| 编号 | TD-004 |
| 优先级 | P1 |
| 影响 | 回归风险、重构困难 |
| 风险 | 高 |

**问题描述**
- controller 测试覆盖较全（21 个测试文件）
- CLI 命令层测试薄弱（仅 2 个 service 测试）
- shared 包无单元测试
- web 包无单元测试

**测试覆盖现状**
| 包 | 测试文件数 | 覆盖率估计 |
|---|----------|----------|
| controller | 21 | ~70% |
| cli | 2 | ~20% |
| shared | 0 | 0% |
| worker | 5 | ~40% |
| web | 0 | 0% |

**清理方案**
```
阶段一 (v0.2.x)：
- CLI 命令层测试：init, doctor, plan, apply, heal
- shared 包测试：schema 验证、工具函数

阶段二 (v0.3.x)：
- web 包测试：主要组件、页面逻辑
- E2E 测试：核心链路

覆盖率目标：
- controller: > 80%
- cli: > 60%
- shared: > 70%
- worker: > 60%
- web: > 60%
```

**验收标准**
- 各包测试覆盖率达标
- 关键路径有 E2E 测试
- 测试可正常运行

---

### TD-005：缺少自动化发布

| 属性 | 值 |
|-----|---|
| 编号 | TD-005 |
| 优先级 | P1 |
| 影响 | 发布效率低、易出错 |
| 风险 | 中 |

**问题描述**
- 无自动化发布流程
- 每次发布需手动构建、测试、打标签
- 版本号可能不一致

**清理方案**
```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: 安装依赖
        run: pnpm install --frozen-lockfile
      
      - name: 构建
        run: pnpm build
      
      - name: 测试
        run: pnpm test
      
      - name: 发布
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
          pnpm -r publish --access public
```

**验收标准**
- tag 推送自动触发发布
- 发布前验证版本一致性
- 成功发布到 npm

---

### TD-006：错误处理不统一

| 属性 | 值 |
|-----|---|
| 编号 | TD-006 |
| 优先级 | P2 |
| 影响 | 调试困难、用户体验差 |
| 风险 | 低 |

**问题描述**
- ControllerErrorCode 定义了结构化错误码
- 但部分地方直接 throw new Error()
- 错误响应格式不统一

**清理方案**
```typescript
// 统一错误处理
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 错误响应格式
{
  "success": false,
  "code": "TASK_NOT_FOUND",
  "message": "任务不存在",
  "details": {
    "taskId": "tk_123"
  }
}
```

**验收标准**
- 统一使用 AppError
- 错误响应格式一致
- 错误码有完整文档

---

## 重构计划

### RF-001：统一响应格式

| 编号 | RF-001 |
|-----|-------|
| 风险 | 中 |
| 影响范围 | API 层 |

**说明**：统一 Controller 所有 API 的响应格式

**目标**
```typescript
// 成功响应
{
  "success": true,
  "data": { ... }
}

// 错误响应
{
  "success": false,
  "code": "ERROR_CODE",
  "message": "错误描述",
  "details": { ... }
}
```

---

### RF-002：抽取通用工具库

| 编号 | RF-002 |
|-----|-------|
| 风险 | 低 |
| 影响范围 | 全局 |

**说明**：抽取多个包中重复的工具函数到 shared

**候选函数**
- 日志格式化
- 时间处理
- 字符串处理
- 配置文件解析

---

### RF-003：优化 worker 选主逻辑

| 编号 | RF-003 |
|-----|-------|
| 风险 | 中 |
| 影响范围 | worker 包 |

**说明**：当前 worker 选主逻辑较简单，需支持多 worker 负载均衡

---

### RF-004：重构 manifest 加载器

| 编号 | RF-004 |
|-----|-------|
| 风险 | 中 |
| 影响范围 | cli/controller |

**说明**：manifest 加载逻辑在多个地方重复，需统一

---

### RF-005：升级 zod v4 兼容性

| 编号 | RF-005 |
|-----|-------|
| 风险 | 低 |
| 影响范围 | shared |

**说明**：检查 zod v4 与当前代码的兼容性

---

## 债务优先级排序

| 优先级 | 编号 | 描述 | 工时估计 |
|-------|-----|------|---------|
| P0 | TD-001 | 清理编译产物 | 1h |
| P0 | TD-002 | 统一版本号 | 2h |
| P1 | TD-004 | 测试覆盖不均 | 30h |
| P1 | TD-003 | 文档与代码不同步 | 4h |
| P1 | TD-005 | 缺少自动化发布 | 4h |
| P2 | TD-006 | 错误处理不统一 | 8h |

**总计**：P0: 3h, P1: 38h, P2: 8h

---

## 更新记录

| 日期 | 版本 | 更新内容 |
|-----|-----|---------|
| 2026-07-09 | v1.0.0 | 初始版本 |

---

*技术债务清理是持续性工作，建议每个 sprint 预留 10-20% 时间处理*
