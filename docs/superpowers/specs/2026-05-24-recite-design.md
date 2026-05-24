# Recite — English Presentation 背诵练习 App 设计文档

日期：2026-05-24
状态：已通过设计评审，待写实现计划

## 1. 目标

帮助用户反复背诵、练习英文 presentation 的 Web App。内置 OpenAI Agents SDK
分析用户的演讲稿，自动生成结构化学习计划，并通过「遮挡填空 + 间隔重复」让用户
快速进入学习状态、稳定记忆。

## 2. 技术栈

- **Next.js 15**（App Router + TypeScript）
- **Tailwind CSS** — 承载 Nothing 设计系统（实现阶段调用 `nothing-design` skill）
- **Supabase** — Auth（登录）+ Postgres（数据）+ Storage（原始上传文件）
- **OpenAI Agents SDK**（`@openai/agents`，TS）— 运行在 Next.js Route Handler
  （Node runtime）中，做演讲稿分析与计划生成
- **文件解析（服务端）**：
  - PDF → `unpdf`
  - PPTX → `JSZip` 解压 + 读取 `ppt/slides/slideN.xml` 提取文字
  - md / txt → 直接读取
- **部署**：Vercel。`vercel.json` 为分析路由设置 `maxDuration`；
  环境变量注入 `OPENAI_API_KEY` 与 Supabase keys

## 3. 数据模型（Postgres / Supabase）

所有表带 `user_id` 并启用 RLS，用户只能访问自己的数据。

- `presentations`：`id, user_id, title, raw_text, source_type, created_at`
- `segments`：分段拆解结果
  `id, presentation_id, order_index, title, content, difficulty, hints(jsonb), created_at`
- `study_plans`：`id, presentation_id, user_id, generated_at, meta(jsonb)`
- `daily_tasks`：`id, plan_id, day_index, segment_ids(jsonb), task_type, done`
- `practice_records`：间隔重复调度（SM-2 lite）
  `id, segment_id, user_id, ease, interval_days, repetitions, due_at, last_reviewed_at`

## 4. 核心流程

### 4.1 上传
用户上传 PPT/PDF/md/txt → 文件存入 Supabase Storage → 服务端解析为纯文本
→ 创建 `presentations` 记录。

### 4.2 Agent 分析（OpenAI Agents SDK）
- 输入：`raw_text`
- Agent 使用 **zod 结构化输出**，返回：
  ```
  {
    segments: [{ title, content, difficulty, hints[] }],
    dailySchedule: [{ dayIndex, segmentIndexes[], taskType }]
  }
  ```
- 落库：写入 `segments`、`study_plans`、`daily_tasks`，并为每个 segment 初始化
  `practice_records`（首个 `due_at = 今天`）。
- 计划包含两块（用户选定）：**分段拆解** 与 **每日任务 + 间隔重复**。

### 4.3 练习（遮挡填空 + 间隔重复）
- 取今日到期（`due_at <= now`）的 segment。
- 遮挡该 segment 的关键句/词，用户回忆后揭示原文并自评：
  `Again / Hard / Good / Easy`。
- 按 SM-2 lite 更新 `ease / interval_days / repetitions / due_at`。

### 4.4 快速进入学习状态
Dashboard 提供一个主 CTA「进入状态」，一键给出：今日到期卡片队列 +
一段由 agent 生成的开场热身白，降低启动决策成本。

## 5. 页面

- `/login` — Supabase Auth 登录/注册
- `/`（dashboard）— 今日计划概览、到期复习数、「进入状态」CTA
- `/upload` — 上传文件并触发分析（带 loading / 进度反馈）
- `/presentation/[id]` — 计划详情（分段列表 + 每日排程）
- `/practice/[id]` — 练习会话（遮挡卡片 + 自评）

## 6. 组件边界

- `lib/parse/*` — 文件解析（按类型分模块，输入文件 buffer，输出纯文本）
- `lib/agent/*` — agent 定义 + zod schema + 调用封装（输入文本，输出结构化计划）
- `lib/srs/*` — SM-2 lite 调度纯函数（输入当前记录 + 评分，输出新调度，可单测）
- `lib/supabase/*` — server / client / middleware 三个 Supabase 客户端
- `app/api/*` — Route Handlers：upload-parse、analyze、practice-review
- `components/*` — Nothing 风格 UI 组件

## 7. UI

Nothing 设计系统：单色基底 + 点阵/glyph 字体 + 红色强调 + 网格布局。
实现阶段调用 `nothing-design` skill 统一处理视觉规范。

## 8. 实现顺序（核心闭环优先）

1. 脚手架 + Tailwind + Nothing 基础样式 + Vercel 配置
2. `lib/srs` 纯函数 + 单测（无外部依赖，先打地基）
3. 文件解析 + 分析 agent（先用 mock/内存跑通 上传→分析→分段）
4. 练习闭环（遮挡卡片 + 自评 + SRS 调度）
5. 叠加 Supabase（Auth + 表 + RLS + 持久化），替换内存层
6. Dashboard「进入状态」CTA + 打磨

## 9. 范围与非目标

- 范围：单一 cohesive MVP，覆盖 上传 → 分析 → 计划 → 练习 → 跨设备同步。
- 非目标（YAGNI）：语音识别评分（用户已明确选自测）、团队/分享、付费、
  多语言界面、移动 App。

## 10. 配置与密钥

- `OPENAI_API_KEY` — 本地 `.env.local`（不提交），生产配 Vercel 环境变量
- `OPENAI_BASE_URL` — OpenAI 接口地址，做成可配置变量（支持代理 / 兼容端点）；
  未设置时回落到官方默认地址
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 同上
- `SUPABASE_SERVICE_ROLE_KEY` — 仅服务端使用
