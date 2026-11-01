"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.api import routes_auth, routes_chat, routes_meta, routes_reports, routes_sessions
from app.api.errors import ApiError, api_error_handler
from app.config import settings
from app.db.session import dispose, init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s :: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("mediflow")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    from app.rag.service import stats

    log.info("MediFlow %s starting · model_mode=%s · corpus=%s",
             settings.version, settings.model_mode_resolved, stats())
    yield
    await dispose()
    log.info("MediFlow stopped")


app = FastAPI(
    title="MediFlow API",
    version=settings.version,
    description="Triage-first medical consultation agents: supervisor routing, structured "
    "history taking, guideline-grounded advice, report interpretation, and a deterministic "
    "red-flag screen that runs before any model call.",
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_exception_handler(ApiError, api_error_handler)

for module in (routes_auth, routes_sessions, routes_chat, routes_reports, routes_meta):
    app.include_router(module.router, prefix=settings.api_prefix)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/health", include_in_schema=False)
async def health_root() -> dict:
    return {"status": "ok", "model_mode": settings.model_mode_resolved, "version": settings.version}
