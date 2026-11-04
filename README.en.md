<p align="center">
  <img src="docs/images/logo.svg" width="52%" alt="Super-Doctor" />
</p>

<div align="center">

<a href="https://github.com/drunksu/super-doctor/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/drunksu/super-doctor?style=flat&logo=github&color=0e7490"/></a>
<a href="https://super-doctor.onrender.com"><img alt="live demo" src="https://img.shields.io/badge/live%20demo-super--doctor.onrender.com-46a758"/></a>
<a href="https://github.com/drunksu/super-doctor/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/drunksu/super-doctor/actions/workflows/ci.yml/badge.svg?branch=main"/></a>
<img alt="python" src="https://img.shields.io/badge/python-3.12-3776ab?logo=python&logoColor=white"/>
<img alt="next" src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white"/>
<a href="LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-64748b"/></a>
<a href="#install"><img alt="no API key needed" src="https://img.shields.io/badge/demo%20mode-no%20API%20key-0e7490"/></a>

</div>

<div align="center">

🚀 [Framework](#framework) · ⚡ [Install](#install) · 🎬 [Screens](#screens) · 🧠 [Python API](#python-api) · 📊 [Evaluation](#evaluation) · 🤝 [Contributing](#contributing) · 📄 [Citation](#citation)

</div>

---

# Super-Doctor: a triage-first medical consultation system

A patient says "I don't feel well". The system turns that into a structured history, triages it,
and answers with **citable** guidance — and if the description contains a red flag, it becomes
an emergency response *before* any model is called.

> **Live demo**: <https://super-doctor.onrender.com> — free instance, so the first visit after it
> has been idle takes ~30–60 s to wake up (then it is quick). No API key: sign in with
> `demo@superdoctor.ai` / `demo1234`. With no model key configured the backend runs its offline
> demo pipeline and the UI says "demo mode" instead of pretending a model answered.

> Health information and care guidance only. No diagnosis, no prescription, no medical imaging.
> Not a medical device. In an emergency, call your local emergency number.
> Full terms: [DISCLAIMER.md](docs/DISCLAIMER.md).

## The 3-minute tour

| Time | What you will see | Where |
| --- | --- | --- |
| 30 s | What it is: one sentence plus two diagrams (Router roles, six stages) | intro · [Framework](#framework) |
| 1 min | Where the judgement sits: red-flag rules run before any model call; the Router only decides, Workers own isolated contexts; the guard checks the answer sentence by sentence | [Framework](#framework) |
| 2 min | Why trust it: 62 pytest cases, the evaluation method with a three-run variance table, and known limits stated up front | [Evaluation](#evaluation) |
| 3 min | Run it: open the [live demo](https://super-doctor.onrender.com) (free instance, ~30–60 s to wake), or run locally — with no key the backend falls back to demo mode | [Install](#install) |

## News

- **v0.2.0** (2026-11) — renamed to Super-Doctor; README restructured around framework, install,
  usage, evaluation and reproducibility; added rendered diagrams, a CI gate and a three-run
  variance table.
- **v0.1.0** (2026-11) — first public version: six-stage pipeline, three memory layers,
  guideline retrieval, SSE streaming, report interpretation, 62 tests.

See [CHANGELOG.md](CHANGELOG.md).

---

## Framework

One deterministic gate, then two layers of agents. The **router** layer only decides what should
happen (ask, answer, escalate); the **worker** layer owns an isolated context and writes one
piece of the conversation.

<p align="center">
  <img src="docs/images/diagram-roles.png" width="92%" alt="Router and worker roles" />
</p>

<p align="center">
  <img src="docs/images/diagram-stages.png" width="72%" alt="Six stages of a turn" />
</p>

### Router layer (decisions only)

- **Safety screen** — 19 deterministic rules with a negation window, running before any model
  call. A red flag ends the turn with **zero model calls**.
- **Supervisor** (`deepseek-flash`) — decides follow-up vs answer vs small talk; most turns are
  resolved by the rule fast path.
- **Intake extractor** (`deepseek-flash`) — turns free text into 9 structured slots while the
  answer is already streaming.

### Worker layer (isolated contexts)

- **Triage** (`deepseek-v4-pro`) — asks exactly one question, and says why it is asking.
- **Clinician** (`deepseek-v4-pro`) — directions, what to do now, when to seek care; every claim
  carries a citation number.
- **Report interpreter** (`deepseek-v4-pro`) — lab values in plain language, plus questions to
  ask the doctor.

### Why "Super-Doctor"

The name points at the [Super-agent](https://github.com/deepseek-ai/dsh-superagent-prototype)
design DeepSeek Harness published on 2026-10-31: a resident router owning human interaction,
isolated workers running in parallel, and events that skip the queue when they matter. In a
medical setting, the thing that must never queue is an emergency.

| Super-agent property | Where it lands here |
| --- | --- |
| **Continuous** — one agent across channels | one session spans follow-up, advice and review; slots and profile accumulate |
| **Efficient** — parallel, non-blocking | intake extraction runs alongside generation; the reply streams sentence by sentence |
| **Proactive** — acts when it should, quiet otherwise | a red flag answers immediately; thin signals get one question |
| **Persistent** — recovers from failure | empty retrieval degrades with a flag; supervisor timeout falls back to a heuristic; bad PDFs return an actionable error |

The prototype is a coding agent for GitHub/Feishu; this project keeps its **router + isolated
workers + event triage** structure and drops the channel and authorization model.

---

## Install

Python 3.12, Node 22, pnpm 9+. No Docker required.

```bash
git clone https://github.com/drunksu/super-doctor.git
cd super-doctor

python -m venv .venv
.venv/bin/pip install -e "backend[dev]"           # macOS / Linux
# .venv/Scripts/pip install -e "backend[dev]"     # Windows

cp backend/.env.example backend/.env              # add DEEPSEEK_API_KEY
.venv/bin/python -m uvicorn app.main:app --port 8000 --app-dir backend

cd frontend && pnpm install && pnpm dev           # http://localhost:3000
```

Sign in with `demo@superdoctor.ai` / `demo1234`. API docs: <http://127.0.0.1:8000/docs>.

Docker: `cp .env.example .env && docker compose up --build`. The compose file is provided but
was not exercised on the author's machine (no Docker there); the local path is verified.

**No API key?** `MODEL_MODE=auto` falls back to a scripted offline demo with the same SSE
contract, and `/api/health` reports `model_mode: mock` — it never pretends to be a model.

---

## Screens

<p align="center">
  <img src="docs/images/consult-advice.png" width="92%" alt="Consultation workspace" />
</p>

Agent timeline with real per-stage timings; citation numbers map to the guideline passages on the right.

<p align="center">
  <img src="docs/images/consult-emergency.png" width="92%" alt="Red-flag path" />
</p>

Red flag: banner + one-tap 120, answered without a model call (0 ms).

<table>
  <tr>
    <td width="50%"><img src="docs/images/reports.png" alt="Report interpretation" /></td>
    <td width="50%"><img src="docs/images/insights.png" alt="Runtime analytics" /></td>
  </tr>
</table>

---

## Python API

The pipeline is a plain async generator — no server needed:

```python
import asyncio
from app.agents.pipeline import TurnContext, TurnResult, stream_turn

async def main() -> None:
    result = TurnResult()
    async for event, data in stream_turn(TurnContext(user_text="头晕两周了"), result):
        if event == "token":
            print(data["text"], end="", flush=True)
    print("\n", [c["id"] for c in result.citations])

asyncio.run(main())
```

Evaluation harness:

```bash
cd backend
python -m app.evals.runner --limit 8     # smoke
python -m app.evals.runner               # full run → app/evals/results/
```

---

## Memory and recovery

| Layer | Scope | Storage | Lifetime |
| --- | --- | --- | --- |
| Message window | session | `messages` | 30-day TTL |
| Rolling summary | session | `sessions.summary` | with the session |
| Structured profile | user | `patient_profiles` | permanent |
| Semantic memory | user | `memories` | permanent, decayed by use |

The structured profile is never summarised — an allergy must not be compressed. Degradation is
designed, not incidental: supervisor timeout falls back to a completeness heuristic, empty
retrieval answers with an `ungrounded_answer` flag, unreadable PDFs return an actionable error.

---

## Evaluation

Two tracks, because two different questions are being asked
([method](docs/evaluation.md)). Track A forces Super-Doctor onto the `advise` route and gives
both systems identical retrieved chunks, so only answer quality is compared.

| Track A · answer quality (18 cases) | Super-Doctor | Single-agent baseline |
| --- | --- | --- |
| LLM-as-judge mean (0–5) | 4.06 | 4.44 |
| Judge pass rate (≥4) | 0.83 | 0.94 |
| Valid citation rate | 1.00 | 1.00 |
| Forbidden phrasing hits | 0 | 0 |
| Average latency | 5.86 s | 4.31 s |
| Average output tokens | 222 | 144 |

| Track B · behaviour | Result |
| --- | --- |
| Emergency routing accuracy (6 cases) | 100% |
| First answer on an emergency | 0 ms (template, no model) |
| First-turn follow-up rate | 100% |
| One-question compliance | 75% |
| Slots captured after one turn | 32% |

Across three consecutive runs the same code scored 4.06 / 4.11 / 4.22 (baseline steady at 4.44),
so the real gap is 0.2–0.4 — small-sample noise, not a capability difference.

## Reproducibility

Two runs are never byte-identical: sampling varies, the model IDs behind
`MODEL_SUPERVISOR`/`MODEL_WORKER` move with provider releases, and the judge is a model too
(same family, so it self-prefers). What *is* fixed: retrieval (deterministic BM25 + TF-IDF + RRF
over an in-repo corpus), the safety screen (rules), and citation validation (server-side).
Read the evaluation numbers together with the model version and date.

---

## Safety model

1. **Gate** — 19 rules, negation-aware, severity can only escalate; `urgent` never reaches a model.
2. **Grounding** — claims must come from this turn's chunks; out-of-range citation numbers are deleted.
3. **Sentence guard** — "drug + dose", definitive diagnoses and dose adjustments are replaced before sending.

---

## Known limits

- No diagnosis, no prescription, no imaging (there is no OCR path; the UI says so).
- 32 evaluation cases with self-authored rubrics — behaviour, not medicine.
- Single-tenant; a real deployment needs row-level security and field-level encryption.
- Sparse retrieval; an `EmbeddingProvider` seam exists for a real embedding service.
- `docker-compose.yml` is still unverified locally (no Docker on this machine). The deploy image *is* verified: the live demo is built from `deploy/demo/Dockerfile`.
- **The live demo runs on Render's free plan**: it sleeps after 15 minutes without traffic (~30–60 s to wake), SQLite lives in `/tmp` so sessions do not survive a restart (the demo account is re-seeded every boot), and `JWT_SECRET` is generated per boot. Those are free-tier trade-offs, stated rather than hidden.

## Contributing

The highest-value contribution is a **guideline document**: add a `.md` under
`backend/app/rag/corpus/` with front-matter, split sections with `##`, add a line to
`backend/app/rag/eval_queries.jsonl`, then run `pytest` and a short evaluation.
CI runs `ruff`, `pytest`, `pnpm typecheck` and `pnpm build`.

## Citation

```bibtex
@misc{superdoctor2026,
  title        = {Super-Doctor: A Triage-First Medical Consultation Multi-Agent System},
  author       = {Super-Doctor contributors},
  year         = {2026},
  howpublished = {\url{https://github.com/drunksu/super-doctor}}
}
```

## Docs

[Architecture](docs/architecture.md) · [Evaluation](docs/evaluation.md) · [API contract](docs/api-contract.md) · [Demo script](docs/demo.md) · [中文 README](README.md)

## License

[MIT License](LICENSE) · usage boundaries and medical disclaimer: [DISCLAIMER.md](docs/DISCLAIMER.md).
