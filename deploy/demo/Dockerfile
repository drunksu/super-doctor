# syntax=docker/dockerfile:1
#
# One container that serves the whole demo on a single origin. Build context is the repository root:
#
#   $PORT (nginx) ─┬─ /api/* ──> uvicorn 127.0.0.1:8000   (FastAPI + SSE + /docs)
#                  └─ /*    ──> next    127.0.0.1:3000   (Next.js, built with NEXT_PUBLIC_API_BASE=/api)
#
# Used by Render (`render.yaml` points here) and by `docker build -f deploy/demo/Dockerfile .` locally.

# ---------------------------------------------------------------------------- web build
FROM node:22-slim AS web

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

WORKDIR /app
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

# Same origin behind nginx, so relative paths work and there is no CORS list to maintain.
ENV NEXT_PUBLIC_API_BASE=/api
RUN pnpm build

# ---------------------------------------------------------------------------- runtime
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends nginx ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# `next start` needs a node runtime; the official slim image is the same Debian release.
COPY --from=web /usr/local/bin/node /usr/local/bin/node

# --- API -------------------------------------------------------------------
WORKDIR /app/api
COPY backend/pyproject.toml ./
RUN mkdir -p app && pip install --no-cache-dir .
COPY backend/app ./app

# --- web -------------------------------------------------------------------
WORKDIR /app/web
COPY --from=web /app/package.json /app/pnpm-lock.yaml ./
COPY --from=web /app/next.config.ts ./
COPY --from=web /app/.next ./.next
# This project has no `public/` directory (static files live under .next and are served by
# `next start`). Copying it unconditionally is what failed the first Render build.
COPY --from=web /app/node_modules ./node_modules

# --- proxy -----------------------------------------------------------------
COPY deploy/demo/nginx.conf /app/nginx.conf
COPY deploy/demo/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# No model key is set, so `auto` resolves to the offline demo pipeline; `/api/health` reports
# `model_mode: mock` so nobody has to guess. `PORT` is injected by the host.
ENV MODEL_MODE=auto \
    VERSION=0.2.0 \
    DATABASE_URL=sqlite+aiosqlite:////tmp/super-doctor.db \
    PORT=7860

EXPOSE 7860
CMD ["/app/start.sh"]
