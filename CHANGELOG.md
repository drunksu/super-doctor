# Changelog

All notable changes are listed here. The project follows a loose semantic versioning:
`0.x` until the conversation contract (SSE events) stops changing.

## v0.2.0 — 2026-11-02

**Brand and packaging**

- Renamed from the working title to **Super-Doctor**, and linked the design explicitly to
  the Super-agent prototype DeepSeek Harness published on 2026-10-31 (router + isolated
  workers + event triage → red flags never queue behind a model).
- Rewrote the README around the framework, installation, usage, evaluation and
  reproducibility sections; added rendered diagrams, a CI gate and this changelog.

**Evaluation**

- Two-track harness: answer quality against a single-agent baseline with identical
  retrieval context, plus behaviour metrics the baseline has no equivalent for.
- Added a three-run variance table — the judge is noisy at n=18, and the README says so.

## v0.1.0 — 2026-11-01

**First public version**

- Turn pipeline: deterministic red-flag screen → rule/supervisor routing → hybrid
  retrieval → streamed answer → parallel intake extraction → sentence-level output guard.
- Five typed roles on PydanticAI 2.x: supervisor, intake extractor, triage, clinician,
  report interpreter; the safety layer is rules, not a model.
- Three memory layers (message window, rolling summary, structured profile + semantic
  recall) and a 14-document / 70-chunk Chinese guideline corpus with RRF fusion.
- FastAPI + SSE + JWT + SQLAlchemy async; SQLite by default, Postgres-ready.
- Next.js 15 workspace: consultation with an agent timeline and live citations, report
  interpretation, runtime analytics, login.
- 62 tests covering safety rules, retrieval recall, the output guard, the SSE protocol and
  report parsing.
