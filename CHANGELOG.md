# Changelog

All notable changes are listed here. The project follows a loose semantic versioning:
`0.x` until the conversation contract (SSE events) stops changing.

## v0.3.0 — 2026-11-06

**Interface**

- Reworked the visual language: warm paper background, one accent colour instead of a palette, and
  a serif face (self-hosted Noto Serif SC) for headings. Sans stays for body text and data.
- Rebuilt the hierarchy of the consultation and sign-in screens; the marketing scaffolding above
  the conversation is gone, so the first thing a visitor sees is the product working.
- Screenshots and the animated demo were re-recorded against the new interface.

**Deployment**

- The image now copies `frontend/public`, so the 60 self-hosted font shards are served; before
  this, every `woff2` returned 404 and the serif silently fell back to a system font in production.

**Documentation**

- New [docs/eval-reading.md](docs/eval-reading.md): how to read the two evaluation tables — what
  `4.06` vs `4.44` with `n=18` can and cannot support, the direction of same-family judge bias,
  what a 0.2–0.4 swing means at this sample size, and why the architecture is still multi-agent.
- README gains a **Design trade-offs** section: why this is not built on a graph framework, and
  what multi-agent actually buys (`+1.5 s` latency and `+54%` tokens are stated as the price).
- Demo-state wording now points at `/api/health` (`model_mode: mock`) instead of promising a badge
  in the interface, so the documentation cannot drift from the UI again.
- Removed material that described the project in terms of its author rather than its users.

**Version** — `/api/health` and the OpenAPI document report `0.3.0`.

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
