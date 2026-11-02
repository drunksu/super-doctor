"""Streaming chat endpoint (SSE over POST)."""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from app.api.deps import current_user
from app.api.errors import not_found
from app.db.models import User
from app.schemas import ChatRequest
from app.services import chat

log = logging.getLogger("super-doctor.api.chat")
router = APIRouter(tags=["chat"])


@router.post("/chat/stream")
async def chat_stream(payload: ChatRequest, user: User = Depends(current_user)):
    try:
        session, _ = await chat.session_messages(user, payload.session_id)
    except ValueError:
        raise not_found("会话") from None

    await chat.save_user_message(payload.session_id, payload.message.strip())

    async def event_source():
        yield chat.sse(
            "run_started",
            {"run_id": payload.session_id, "session_id": payload.session_id, "trace_id": session.id[:12]},
        )
        try:
            async for event, data in chat.run_turn_events(user, payload.session_id, payload.message.strip()):
                yield chat.sse(event, data)
        except Exception as exc:  # noqa: BLE001 - the stream must always terminate cleanly
            log.exception("chat stream failed")
            yield chat.sse("error", {"code": "upstream_unavailable", "message": str(exc)[:200]})

    return EventSourceResponse(event_source(), ping=20000, headers={"Cache-Control": "no-cache"})


@router.get("/chat/health")
async def chat_health() -> dict:
    return {"ok": True, "json": json.dumps({"ok": True})}
