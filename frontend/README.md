# Super-Doctor Frontend

Super-Doctor（智能问诊多智能体系统）的前端实现：浅色临床 SaaS 风格，中文界面，覆盖问诊工作台、报告解读、运行洞察、登录与患者档案。

> 健康信息与就医建议，不做诊断、不开处方。出现急症请立即拨打 120。

## 技术栈

- Next.js 15 App Router + TypeScript strict
- Tailwind CSS v4（设计令牌全部落在 `app/globals.css`）
- lucide-react 图标；图表全部手写 SVG，无图表库
- 系统字体栈，不依赖 `next/font` 在线拉取

## 快速开始

```bash
cd frontend
pnpm install
pnpm dev            # http://localhost:3000
```

未启动后端时，应用会自动进入 **演示模式**：使用 `lib/demo-script.ts` 在本地回放与 SSE 契约一致的事件流，所有页面都可截图、可交互。

### 连接后端

默认 API 基址为 `http://127.0.0.1:8000/api`（见 `lib/api.ts`），可覆盖：

```bash
# 真实 FastAPI 后端
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api pnpm dev

# 或使用内置的零依赖 mock 服务（端口 8787）
pnpm mock
NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787/api pnpm dev
```

演示账号：`demo@superdoctor.ai` / `demo1234`（`/login` 已预填）。

> Windows PowerShell 设置环境变量的写法：
> `$env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8787/api"; pnpm dev`

### 构建

```bash
pnpm build
pnpm start
```

## 路由

| 路由 | 说明 |
|---|---|
| `/` | 重定向到 `/consult` |
| `/consult` | 主工作台：图标栏 + 会话列表 + 对话 + 患者上下文 |
| `/reports` | 报告拖拽上传、解析轮询、指标表、问题清单、引用 |
| `/insights` | KPI、每日问诊量 SVG 柱状图、Agent 路由、安全分布、模型配置 |
| `/login` | 邮箱密码登录，JWT 存 localStorage |
| `/settings` | 患者档案、账户、运行环境与免责声明 |

## 演示模式

`components/app-mode-provider.tsx` 会检查 `GET /health` 与本地 token：

- 没有 token，或健康检查失败 → `demo`，显示琥珀色「演示模式」徽标
- 有 token 且 `/health` 正常 → `live`

演示对话由 `lib/demo-script.ts` 生成，事件形状与 `docs/api-contract.md` 完全一致，包含 `run_started`、`agent`、`tool`、`token`、`citation`、`intake`、`safety`、`interrupt`、`done`；按关键字切换头晕 / 胸痛（紧急红旗）/ 儿童发热 / 血脂四种脚本。

## Mock API

`mock/server.mjs` 是无任何 npm 依赖的 Node HTTP 服务，实现契约中的全部路由，包括：

- `POST /auth/login`、`/auth/register`、`GET /me`、`PUT /me/profile`
- 会话 CRUD 与 `POST /chat/stream`（SSE，带真实节奏、工具事件、引用、intake、safety、interrupt、done）
- 报告上传 / 异步解析状态轮询
- `GET /meta/agents`、`GET /insights/summary`、`GET /health`
- CORS，支持浏览器跨域调用

数据保存在内存中，重启即恢复种子数据。

## 目录

```
frontend/
├─ app/
│  ├─ (workspace)/          # 共享图标栏布局
│  │  ├─ consult/page.tsx
│  │  ├─ reports/page.tsx
│  │  ├─ insights/page.tsx
│  │  └─ settings/page.tsx
│  ├─ login/page.tsx
│  ├─ layout.tsx
│  ├─ page.tsx              # / → /consult
│  ├─ globals.css           # 设计令牌 / 动画 / reduced-motion
│  └─ icon.svg
├─ components/
│  ├─ chat-panel.tsx        # 自动滚动、回到最新、免责声明
│  ├─ message-bubble.tsx    # 消息、引用角标、工具 chip、快捷回复
│  ├─ agent-timeline.tsx
│  ├─ session-list.tsx
│  ├─ context-panel.tsx
│  ├─ safety-banner.tsx
│  ├─ citation-card.tsx
│  ├─ composer.tsx
│  ├─ marker-table.tsx
│  ├─ kpi-card.tsx
│  ├─ bar-chart.tsx
│  ├─ upload-zone.tsx
│  ├─ icon-rail.tsx
│  └─ ui/                   # button / input / badge / card / tooltip / skeleton
├─ lib/
│  ├─ types.ts              # 镜像 API 契约
│  ├─ api.ts                # 类型化 fetch + JWT
│  ├─ sse.ts                # POST + ReadableStream SSE 解析（含分块边界 / abort）
│  ├─ format.ts             # 时间、token、延迟、Agent 元数据
│  ├─ demo-script.ts        # 本地 SSE 回放
│  ├─ demo-fixtures.ts      # 演示会话、报告、洞察、引用
│  └─ demo-store.ts         # 演示模式内存数据
└─ mock/server.mjs
```

## 已验证

- `pnpm build` 通过（Next 15.5.28，TypeScript 零报错）
- `pnpm dev` + `curl http://127.0.0.1:3000/consult` 返回 200 HTML
- Mock 服务：health / login / sessions / reports / insights / SSE 全部按契约返回
- 浏览器端演练（Chrome CDP）：演示模式与连 mock 的 live 模式均跑通登录、SSE 流式、引用、紧急红旗、报告上传轮询、洞察加载
- 1280 / 1440 / 1920 / 1024 / 390 宽度下无页面级横向滚动，控制台无错误

## 说明

- 未开启 `output: 'standalone'`（题目中为可选项），便于 `pnpm start` 直接验证。
- 宽度 < 1280 时患者上下文改为抽屉；< 1024 时会话列表与上下文均为抽屉，图标栏变为底部导航。
- 设置页为补充页面（图标栏「设置」与患者档案编辑入口需要）。
- 演示模式下的会话与档案修改只保存在当前浏览器内存，刷新后恢复种子数据。
