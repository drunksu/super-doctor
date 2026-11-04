# Deploying the live demo

The demo runs on **Hugging Face Spaces** (Docker SDK). It costs nothing, needs no credit card, and
sleeps only when nobody has touched it for two days — a much better trade than a free tier that
sleeps after fifteen minutes.

## What gets deployed

One container, one public origin:

```
             :7860  nginx
               ├── /api/*  ──▶  uvicorn 127.0.0.1:8000   FastAPI, SSE, /docs proxy
               └── /*      ──▶  next    127.0.0.1:3000   Next.js, built with NEXT_PUBLIC_API_BASE=/api
```

Because the browser only ever talks to the Space's own origin, there is no CORS configuration and
no second host to keep warm. The SSE endpoint is proxied with `proxy_buffering off`, so the answer
still arrives sentence by sentence instead of in one lump.

The Space repository holds **four files** (`deploy/huggingface/`): `README.md`, `Dockerfile`,
`nginx.conf`, `start.sh`. The Dockerfile clones `https://github.com/drunksu/super-doctor` at build
time, so the demo trackers `main` and there is no second copy of the code to keep in sync.

## First deployment

1. Create a Space: <https://huggingface.co/new-space> → SDK **Docker** → blank template.
2. Upload the four files from `deploy/huggingface/` into the Space root
   (web UI: *Files → Add file → Upload files*).
3. Leave the build settings alone; `app_port: 7860` is in the README front-matter.
4. Watch **Logs**. First build takes 5–10 minutes (Node build + Python deps).
5. Open the Space URL, sign in with `demo@superdoctor.ai` / `demo1234`.

No secrets are needed: with no `DEEPSEEK_API_KEY`, `MODEL_MODE=auto` resolves to the offline demo
pipeline, and the UI labels it as a demo.

## Updating the demo

The image is built from a clone of `main`, so a code change is not live until the Space rebuilds:

- *Settings → Factory rebuild* rebuilds from scratch (slow but clean), or
- `git push` an empty commit to the Space repo, or
- push any change to the four files.

## Turning it into a live-model demo (optional)

Add two secrets in *Settings → Variables and secrets* and restart:

| Name | Value |
| --- | --- |
| `DEEPSEEK_API_KEY` | a key with model access |
| `MODEL_MODE` | `live` |

Then `/api/health` reports `model_mode: live`. Note that this spends real tokens on every visitor,
which is why the default deployment stays in demo mode.

## Known limits (stated, not hidden)

- **Cold start**: the first visit after ~48 h idle waits for container boot plus Next.js startup,
  roughly 30–60 s. The free tier is the reason; a paid tier removes it.
- **Ephemeral database**: SQLite lives in `/tmp`, so sessions do not survive a restart. The demo
  account is re-seeded on every boot, which is why the login always works.
- **Per-boot JWT secret**: `start.sh` generates one if none is provided, so old session tokens
  become invalid after a restart. Fine for a demo, deliberately not fine for production.
- **One worker**: a single uvicorn process, no horizontal scaling. This is a demonstration of
  architecture, not a load test.

## Verifying the deployment

```bash
curl https://<space-subdomain>.hf.space/api/health
# {"status":"ok","model_mode":"mock","version":"0.2.0"}

curl -s https://<space-subdomain>.hf.space/openapi.json | head -c 200
```

Then in the browser: sign in, ask `我最近头痛` (normal path) and `胸口疼，冒冷汗，喘不上气`
(red-flag path), and watch the stream arrive incrementally.
