## What changed

<!-- One paragraph. If it is user-facing, say what a user now sees. -->

## Why

<!-- The problem, not the diff. Link the issue or the doc line that promised this. -->

## How I verified it

<!-- Commands and the result, not "works on my machine". -->

```
cd backend && MODEL_MODE=mock pytest -q
ruff check backend/app
cd frontend && pnpm typecheck && pnpm build
```

## Checklist

- [ ] Tests cover the new behaviour, or the PR says why they are not needed.
- [ ] `pytest`, `ruff check backend/app`, `pnpm typecheck` and `pnpm build` pass.
- [ ] `README.md` and `README.en.md` updated together when behaviour changed.
- [ ] The red-flag gate, the sentence-level guard and the disclaimer are untouched or the change is explained above.
- [ ] No real patient data, transcripts, secrets or `.env` files in the diff.
