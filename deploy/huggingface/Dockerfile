# syntax=docker/dockerfile:1
#
# One container that serves the whole demo on a single origin:
#
#   :7860 (nginx) ─┬─ /api/* ──> uvicorn 127.0.0.1:8000   (FastAPI + SSE)
#                  └─ /*    ──> next    127.0.0.1:3000   (Next.js, built with API_BASE=/api)
#
# The Space itself only holds this folder; the source is cloned at build time so the Space repo
# stays four small files and never drifts from `main`.

ARG REF=main

# ---------------------------------------------------------------------------- web build
FROM node:22-slim AS web
ARG REF

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable \
 && corepack prepare pnpm@11.21.0 --activate

RUN git clone --depth 1 --branch "$REF" https://github.com/drunksu/super-doctor /src

WORKDIR /src/frontend
RUN pnpm install --frozen-lockfile

# Same origin behind nginx, so relative paths work and there is no CORS to configure.
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
COPY --from=web /src/backend/pyproject.toml ./
RUN mkdir -p app && pip install --no-cache-dir .
COPY --from=web /src/backend/app ./app

# --- web -------------------------------------------------------------------
WORKDIR /app/web
COPY --from=web /src/frontend/package.json /src/frontend/pnpm-lock.yaml ./
COPY --from=web /src/frontend/next.config.ts ./
COPY --from=web /src/frontend/.next ./.next
COPY --from=web /src/frontend/public ./public
COPY --from=web /src/frontend/node_modules ./node_modules

# --- proxy -----------------------------------------------------------------
# These two files sit next to this Dockerfile in the Space root, so the build context (the Space
# repo, not the cloned tree) is what is copied here.
COPY nginx.conf /app/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# No model key on the Space: `auto` resolves to the offline demo pipeline, and the UI labels it
# as a demo instead of pretending a model answered.
ENV MODEL_MODE=auto \
    VERSION=0.2.0 \
    DATABASE_URL=sqlite+aiosqlite:////tmp/super-doctor.db

EXPOSE 7860
CMD ["/app/start.sh"]
