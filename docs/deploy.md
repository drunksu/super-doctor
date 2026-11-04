# Deploying the public demo

The demo runs on **Render** (free web service, Docker runtime, no credit card). The free plan sleeps
after 15 minutes without traffic, so the first visit afterwards waits for the container to boot.
That is stated in the README and in the demo itself rather than hidden — a host that sleeps is a
hosting fact, not a defect in the project.

Hugging Face Spaces was the first choice, but its Docker SDK was not available on this account
(only Static and Gradio), and a Static Space cannot run FastAPI while a Gradio Space would replace
the frontend this project is actually about.

## Current deployment

| | |
| --- | --- |
| URL | <https://super-doctor.onrender.com> |
| Service | `super-doctor` · Render web service · free plan · singapore |
| Source | `main`, built from `deploy/demo/Dockerfile` |
| Verified | 2026-11-04 — `/api/health` → `{"status":"ok","model_mode":"mock","version":"0.2.0"}`; `/` renders the consultation page; `/openapi.json` serves the full contract |

The first three deploys failed and the fixes are part of the history: a `COPY` of a `public/`
directory this project does not have, nginx not creating its temp parent directories, and nginx
daemonising instead of staying in the foreground. They are worth naming because the failures were
all at the edges — the build, the Next.js server, uvicorn, the demo seeding and `/api/health` were
already working.

## What gets deployed

One container, one public origin:

```
             $PORT  nginx
               ├── /api/*  ──▶  uvicorn 127.0.0.1:8000   FastAPI, SSE, /docs proxy
               └── /*      ──▶  next    127.0.0.1:3000   Next.js, built with NEXT_PUBLIC_API_BASE=/api
```

Because the browser only ever talks to one origin there is no CORS configuration and no second host
to keep warm. `/api/` is proxied with `proxy_buffering off`, so answers still arrive sentence by
sentence instead of in one lump.

## First deployment (Blueprint)

`render.yaml` at the repository root describes everything, so the dashboard work is a few clicks:

1. Render → **New** → **Blueprint**.
2. Connect `drunksu/super-doctor` and pick the `main` branch.
3. Apply. Render creates one web service from `deploy/demo/Dockerfile` with context `.`.
4. First build takes 5–10 minutes (Node build + Python deps). Watch the build log.
5. Open `https://<service-name>.onrender.com`, sign in with `demo@superdoctor.ai` / `demo1234`.

No secrets are needed: with no `DEEPSEEK_API_KEY`, `MODEL_MODE=auto` resolves to the offline demo
pipeline and the UI labels it as a demo.

## Updating the demo

`autoDeploy: true`, so anything pushed to `main` rebuilds automatically. Nothing else to do.

## Turning it into a live-model demo (optional)

Add two environment variables in the Render dashboard and redeploy:

| Name | Value |
| --- | --- |
| `DEEPSEEK_API_KEY` | a key with model access |
| `MODEL_MODE` | `live` |

`/api/health` then reports `model_mode: live`. This spends real tokens on every visitor, which is
why the default deployment stays in demo mode.

## Known limits (stated, not hidden)

- **Cold start**: after 15 minutes idle the first request waits for the container (~30–60 s). The
  free plan is the reason; a paid instance removes it.
- **Ephemeral database**: SQLite lives in `/tmp`, so sessions do not survive a restart. The demo
  account is re-seeded on every boot, which is why the login always works.
- **Per-boot JWT secret**: `start.sh` generates one when none is provided, so old tokens become
  invalid after a restart. Fine for a demo, deliberately not fine for production.
- **One process each**: one uvicorn worker, one Next server. This demonstrates architecture, not
  load capacity.

## Verifying a deployment

```bash
curl -s https://<service-name>.onrender.com/api/health
# {"status":"ok","model_mode":"mock","version":"0.2.0"}

curl -s https://<service-name>.onrender.com/openapi.json | head -c 200
```

Then in the browser: sign in, ask `我最近头痛` (normal path) and `胸口疼，冒冷汗，喘不上气`
(red-flag path), and watch the stream arrive incrementally.

## Running the same image locally

```bash
docker build -f deploy/demo/Dockerfile -t super-doctor-demo .
docker run --rm -p 7860:7860 super-doctor-demo
# open http://localhost:7860
```

This is also the fastest way to test a Dockerfile change without waiting for a Render build.
