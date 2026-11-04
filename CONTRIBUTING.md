# Contributing

Thanks for looking. This is a small project, so the rules are short.

## Before you write code

Read [README.md](README.md) — at least the **3 分钟看懂** table — and [docs/architecture.md](docs/architecture.md).
Most design questions are already answered there, including the ones this project deliberately does
*not* solve (no imaging, no diagnosis, no prescription).

## Environment

Python 3.12, Node 22, pnpm 9+. No Docker required.

```bash
python -m venv .venv
.venv/Scripts/pip install -e "backend[dev]"    # Windows
# .venv/bin/pip install -e "backend[dev]"      # macOS / Linux
cd frontend && pnpm install
```

## Run the checks locally

CI runs exactly these; please run them before opening a PR.

```bash
# backend (mock mode needs no API key)
cd backend
MODEL_MODE=mock pytest -q          # PowerShell: $env:MODEL_MODE="mock"; pytest -q
ruff check app

# frontend
cd frontend
pnpm typecheck
pnpm build
```

## The most valuable contribution: a guideline document

Retrieval quality is capped by the corpus, so the highest-leverage PR is a new guideline:

1. Add `backend/app/rag/corpus/<id>.md` with front-matter (`id` / `title` / `source` / `year` / `tags`).
2. Split the body with `##`, 2–4 sentences per section, and give "什么时候需要就医" its own section.
3. Add one line to `backend/app/rag/eval_queries.jsonl`: `{"query": "…", "expected_ids": ["…"]}`.
4. Run `pytest` and `python -m app.evals.runner --limit 4` to confirm the new document is retrieved.

## Pull requests

- One intent per PR. Refactors and behaviour changes go in separate PRs.
- Say how you verified it: the commands you ran and what they printed.
- Update both READMEs (`README.md` and `README.en.md`) when you change user-facing behaviour.
- Do not silence a failing check. If a test is wrong, say why in the PR and change the test on purpose.

## Please do not

- Commit real patient data, real consultation transcripts, or API keys. `.env` stays out of git.
- Remove or weaken the medical disclaimer or the red-flag rules to make a demo look smoother.
- Open a public issue for a security problem — see [SECURITY.md](SECURITY.md).

## Commit messages

`type(scope): summary`, types: `feat` / `fix` / `docs` / `chore` / `test` / `refactor`.
Small commits with a real "why" in the body beat one giant commit.

By contributing you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md), and your
contribution is licensed under the [MIT License](LICENSE).
