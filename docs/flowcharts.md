# ClawKit 流程图

本文档使用 Mermaid 语法描述 ClawKit 的核心流程图，可在支持 Mermaid 的工具中渲染（如 GitHub、VS Code、MkDocs 等）。

---

## 1. 系统整体架构

```mermaid
flowchart TB
    subgraph External["外部系统"]
        ClaudeCode[Claude Code<br/>触发源]
        OpenCode[OpenCode<br/>执行引擎]
    end

    subgraph ClawKit["ClawKit 核心"]
        subgraph Controller["Controller"]
            Webhook[Webhook 接收]
            TaskDraft[任务草稿]
            Approval[审批流]
            Dispatch[任务派发]
        end

        subgraph Worker["Worker 集群"]
            Registry[注册服务]
            Heartbeat[心跳服务]
            TaskExecutor[任务执行]
        end

        WebConsole[Web Console<br/>控制台]
    end

    ClaudeCode -->|Webhook| Webhook
    Webhook --> TaskDraft
    TaskDraft --> Approval
    Approval --> Dispatch
    Dispatch -->|派发| TaskExecutor
    TaskExecutor -->|调用| OpenCode
    TaskExecutor -->|注册| Registry
    Registry -->|心跳| Heartbeat
    Heartbeat -->|状态| Controller
    WebConsole -->|管理| Controller

    style Controller fill:#e1f5fe
    style Worker fill:#fff3e0
    style WebConsole fill:#e8f5e9
```

---

## 2. 任务执行完整流程

```mermaid
sequenceDiagram
    participant CC as Claude Code
    participant CT as Controller
    participant WC as Web Console
    participant WK as Worker
    participant OC as OpenCode

    CC->>CT: POST /api/webhook<br/>发送任务
    CT->>CT: 创建 TaskDraft
    CT->>CT: 创建 TaskMemory
    CT->>CT: 创建 PromptDraft
    CT-->>CC: 200 OK

    Note over CC,CT: 等待用户审批

    WC->>CT: GET /api/tasks
    CT-->>WC: 返回待审批任务
    WC->>CT: 用户修改草稿
    WC->>CT: POST /api/tasks/:id/approve
    CT->>CT: 更新状态为 approved

    CT->>WK: 派发任务
    WK->>CT: GET /api/tasks/pull
    CT-->>WK: 返回任务
    WK->>OC: 调用执行
    WK->>CT: POST /api/tasks/:id/result<br/>上报结果

    Note over CT: 任务完成
```

---

## 3. 任务状态机

```mermaid
stateDiagram-v2
    [*] --> Pending: webhook 接收

    Pending --> Pending: 修改草稿
    Pending --> Approved: 用户确认
    Pending --> Cancelled: 用户取消

    Approved --> Dispatching: 派发给 Worker

    Dispatching --> Running: Worker 拉取任务

    Running --> Success: 执行成功
    Running --> Failed: 执行失败
    Running --> Cancelled: 用户取消

    Success --> [*]
    Failed --> [*]
    Cancelled --> [*]

    note right of Pending
        用户可以：
        - 修改草稿
        - 确认派发
        - 取消任务
        - 查询状态
    end
```

---

## 4. Worker 注册与心跳

```mermaid
sequenceDiagram
    participant WK as Worker
    participant CT as Controller

    WK->>CT: POST /api/workers/register<br/>注册 Worker
    CT-->>WK: 200 OK<br/>返回 workerId

    loop 心跳保活（每 30 秒）
        WK->>CT: POST /api/workers/heartbeat
        CT->>CT: 更新最后活跃时间
        CT->>CT: 检查超时 Worker
        CT-->>WK: 200 OK<br/>可附带待执行任务
    end

    Note over WK,CT: Worker 下线时<br/>Controller 自动标记为离线
```

---

## 5. 部署拓扑

### 5.1 all-in-one（单机）

```mermaid
flowchart LR
    subgraph Machine["单台机器"]
        subgraph Services["服务"]
            CC[Claude Code<br/>:18000]
            CT[Controller<br/>:8787]
            WK[Worker]
            OC[OpenCode<br/>:4096]
        end

        subgraph Storage["存储"]
            DB[(SQLite<br/>clawkit.db)]
        end
    end

    CC -->|Webhook| CT
    CT <-->|注册/心跳| WK
    WK -->|执行| OC
    CT --> DB
```

### 5.2 hybrid（混合云）

```mermaid
flowchart LR
    subgraph Cloud["云端服务器"]
        CC[Claude Code]
        CT[Controller<br/>:8787]
    end

    subgraph Local["本地机器"]
        WK[Worker]
        OC[OpenCode<br/>:4096]
    end

    CC -->|Webhook| CT
    CT <-.->|内网| WK
    WK -->|执行| OC
```

### 5.3 split（多机分离）

```mermaid
flowchart TB
    subgraph ServerA["服务器 A"]
        CC[Claude Code]
        CT[Controller<br/>:8787]
    end

    subgraph ServerB["服务器 B"]
        WK[Worker]
        OC[OpenCode<br/>:4096]
    end

    subgraph ServerC["服务器 C（可选）"]
        WC[Web Console]
    end

    CC -->|Webhook| CT
    CT -->|派发| WK
    WK -->|执行| OC
    WC -->|管理| CT
```

---

## 6. CLI 命令流程

```mermaid
flowchart TD
    Start([开始]) --> Init{init?}
    Init -->|是| InitCMD[生成配置]
    Init -->|否| Doctor{doctor?}

    Doctor -->|是| DoctorCMD[诊断配置]
    Doctor -->|否| Plan{plan?}

    Plan -->|是| PlanCMD[预览部署计划]
    Plan -->|否| Apply{apply?}

    Apply -->|是| ApplyCMD[执行部署]
    ApplyCMD --> DryRun{--dry-run?}
    DryRun -->|是| GenerateOnly[仅生成配置]
    DryRun -->|否| Deploy[执行部署]

    Apply -->|否| Heal{heal?}
    Heal -->|是| HealCMD[修复问题]
    Heal -->|否| Onboard{onboard?}

    Onboard -->|是| OnboardCMD[配置引导]
    Onboard -->|否| Verify{verify?}

    Verify -->|是| VerifyCMD[端到端验证]
    Verify -->|否| HelpCMD[显示帮助]

    GenerateOnly --> End([完成])
    Deploy --> End
    HealCMD --> End
    OnboardCMD --> End
    VerifyCMD --> End
    HelpCMD --> End
    DoctorCMD --> End
```

---

## 7. Webhook 任务接收流程

```mermaid
flowchart TD
    Start([收到 webhook]) --> Parse[解析任务协议]
    Parse --> Valid{协议有效?}

    Valid -->|否| ReturnError[返回错误]
    ReturnError --> End1([结束])

    Valid -->|是| Extract[提取任务信息]
    Extract --> CreateDraft[创建 TaskDraft]
    CreateDraft --> CreateMemory[创建 TaskMemory]
    CreateMemory --> CreatePrompt[创建 PromptDraft]
    CreatePrompt --> SetPending[设置状态为 pending]
    SetPending --> Save[持久化到 SQLite]
    Save --> ReturnOK[返回 200 OK]
    ReturnOK --> End2([结束])
```

---

## 8. Controller API 概览

```mermaid
erDiagram
    TASK ||--o| TASK_DRAFT : creates
    TASK ||--o| TASK_MEMORY : contains
    TASK ||--o| PROMPT_DRAFT : generates

    TASK {
        string id PK
        string status
        datetime createdAt
        datetime updatedAt
    }

    TASK_DRAFT {
        string id PK
        string taskId FK
        json originalPrompt
        json approvedPrompt
        string state
    }

    TASK_MEMORY {
        string id PK
        string taskId FK
        json context
    }

    PROMPT_DRAFT {
        string id PK
        string taskId FK
        string content
    }

    WORKER ||--o{ TASK : executes
    WORKER {
        string id PK
        string name
        string status
        datetime lastHeartbeat
    }

    TASK {
        string status "pending | approved | running | done | failed"
    }
```

---

## 9. 错误处理流程

```mermaid
flowchart TD
    Start([发生错误]) --> Type{错误类型}

    Type -->|Webhook 错误| WH_Err[记录错误日志]
    WH_Err --> WH_Return[返回错误信息]
    WH_Return --> End1([结束])

    Type -->|执行超时| Timeout[终止执行]
    Timeout --> TO_Notify[通知用户]
    TO_Notify --> TO_Log[记录超时]
    TO_Log --> End2([结束])

    Type -->|Worker 离线| Offline[标记 Worker 离线]
    Offline --> ReDispatch[重新派发任务]
    ReDispatch --> End3([结束])

    Type -->|OpenCode 调用失败| API_Err[重试或降级]
    API_Err -->|重试成功| Continue[继续执行]
    API_Err -->|重试失败| Fallback[使用 fallback]
    Continue --> End4([结束])
    Fallback --> End5([结束])
```

---

## 10. 快速参考图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ClawKit 快速参考                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  启动命令:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ pnpm quickstart          # 一键部署                          │  │
│  │ node ./packages/cli/dist/index.js onboard -f <file>          │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  访问地址:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Web Console:  http://127.0.0.1:8787                        │  │
│  │ Claude Code:   http://127.0.0.1:18000                       │  │
│  │ OpenCode:     http://127.0.0.1:4096                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  任务状态:                                                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ pending → approved → dispatching → running → done/failed     │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

*文档版本：1.0.0*
*最后更新：2026-09-12*
*支持 Mermaid 渲染的工具：GitHub, GitLab, VS Code, MkDocs, Notion, Miro 等*
