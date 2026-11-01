# Demo script (for the GIF / screen recording)

Roughly 90 seconds, screen-recorded at 1440×900, browser at 100% zoom, Chinese UI.

## Pre-flight

```powershell
# backend
cd backend; ..\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

# frontend
cd frontend; pnpm dev --port 3000
```

Open `http://localhost:3000/login`, sign in with `demo@mediflow.ai` / `demo1234`.
Clear the session list first (delete old sessions) so the empty state is clean.

## Beat 1 — empty state (0:00–0:08)

Hover the three example cards. Click 「早上起来头晕，站起来更明显」.

## Beat 2 — structured triage (0:08–0:30)

Send. While it streams, point at:

- the agent timeline: 调度与分诊 → 结构化问诊 (the second chip pulses)
- the right panel: 问诊进度 jumps from 0% to 33% as slots fill
- the reply is exactly one question

Then type: 「站起来几秒就好，最近两周了，平时血压 118/76」 and send.

## Beat 3 — grounded advice (0:30–0:55)

The supervisor turns into 全科顾问. Point at:

- 「检索指南」 tool chip → 命中 4 条
- inline citation chips `[1] [2]` in the answer
- the 引用来源 panel filling with 4 guideline cards
- the footer: 用时 x.xs · tokens · 4 条引用

## Beat 4 — red flag (0:55–1:10)

New session. Type: 「我爸胸口压着疼，满头大汗，已经十几分钟了」

Expect: red banner at the top, the answer opens with 立即拨打 120, no model latency
(~1 s), and a `tel:120` button. This is the beat that shows the safety gate.

## Beat 5 — report (1:10–1:25)

Go to 报告. The seeded 体检报告 is already there. Point at the marker table: 低密度脂蛋白
4.2 偏高 (amber), 甘油三酯 2.8 偏高, then the 「可以问医生的问题」 list.

## Beat 6 — insights (1:25–1:35)

Go to 洞察. KPIs, 每日问诊量 bars, Agent 路由分布 (调度器 / 结构化问诊 / 全科顾问 /
安全审查). End on the model card: supervisor `deepseek-flash` / worker `deepseek-v4-pro`.

## Recording notes

- Use a 1280×800 or 1440×900 window; the layout is tuned for ≥1280 px.
- Hide the bookmark bar and OS taskbar.
- Frame rate 30 fps; the GIF should be ≤ 12 MB (trim idle time between beats).
- The demo-mode badge appears if the backend is down — check `/api/health` before recording.
