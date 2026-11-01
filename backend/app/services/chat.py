"""Chat turn service: context assembly, pipeline selection, persistence.

The route stays thin; everything that decides *what a turn means* lives here so the eval
harness can drive the same code path the HTTP API drives.
"""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import time
import uuid

from sqlalchemy import select

from app.agents.demo import stream_demo
from app.agents.pipeline import TurnContext, TurnResult, stream_turn
from app.config import settings
from app.db.models import ChatSession, IntakeForm, Message, Run, User
from app.db.session import SessionFactory
from app.memory import long_term, short_term
from app.rag import citations_from, search
from app.schemas import _as_utc

log = logging.getLogger("mediflow.chat")


def use_mock() -> bool:
    return not settings.live_model_enabled


async def build_context(user: User, session_id: str, text: str) -> TurnContext:
    async with SessionFactory() as db:
        profile = await long_term.profile_dict(db, user.id)
        form = await db.get(IntakeForm, session_id)
        session = await db.get(ChatSession, session_id)
        history = await short_term.load_history(db, session_id)
        memories = await long_term.recall(db, user.id, text)
        summary = session.summary if session else None
    return TurnContext(
        user_text=text,
        profile=profile,
        intake=dict(form.slots) if form else {},
        history=history,
        memories=memories,
        summary=summary,
        session_id=session_id,
        trace_id=uuid.uuid4().hex[:12],
    )


async def save_user_message(session_id: str, text: str) -> None:
    async with SessionFactory() as db:
        session = await db.get(ChatSession, session_id)
        if session is None:
            return
        db.add(Message(session_id=session_id, role="user", content=text))
        if session.title in {"新的问诊", ""}:
            session.title = text[:22]
        session.updated_at = dt.datetime.now(dt.UTC)
        await db.commit()


async def load_intake(session_id: str) -> dict:
    async with SessionFactory() as db:
        form = await db.get(IntakeForm, session_id)
        return dict(form.slots) if form else {}


async def save_intake(session_id: str, slots: dict, completeness: float) -> None:
    async with SessionFactory() as db:
        form = await db.get(IntakeForm, session_id)
        if form is None:
            form = IntakeForm(session_id=session_id, slots=slots, completeness=completeness)
            db.add(form)
        else:
            form.slots = slots
            form.completeness = completeness
            form.updated_at = dt.datetime.now(dt.UTC)
        await db.commit()


async def save_assistant_message(
    session_id: str,
    result: TurnResult,
    *,
    latency_ms: int,
) -> str:
    async with SessionFactory() as db:
        message = Message(
            session_id=session_id,
            role="assistant",
            content=result.text,
            agent=result.agent,
            latency_ms=latency_ms,
            meta={
                "citations": result.citations,
                "safety": result.safety,
                "route": result.route,
                "intake": result.intake,
                "usage": {"input_tokens": result.input_tokens, "output_tokens": result.output_tokens},
            },
        )
        db.add(message)
        session = await db.get(ChatSession, session_id)
        if session is not None:
            session.safety_level = result.safety.get("level", "routine")
            session.updated_at = dt.datetime.now(dt.UTC)
        await db.flush()
        db.add(
            Run(
                session_id=session_id,
                user_id=session.user_id if session else "",
                trace_id=uuid.uuid4().hex[:12],
                agents=result.agents,
                route=result.route,
                safety_level=result.safety.get("level", "routine"),
                status="ok",
                latency_ms=latency_ms,
                input_tokens=result.input_tokens,
                output_tokens=result.output_tokens,
                model=result.model,
            )
        )
        await db.commit()
        return message.id


async def run_turn_events(user: User, session_id: str, text: str):
    """Yield (event, data) pairs for one turn and return the final result through closure."""
    ctx = await build_context(user, session_id, text)
    result = TurnResult()
    started = time.perf_counter()
    generator = stream_demo(ctx, result) if use_mock() else stream_turn(ctx, result)
    async for event, data in generator:
        yield event, data
    elapsed = int((time.perf_counter() - started) * 1000)

    if result.intake:
        from app.agents.pipeline import completeness

        await save_intake(session_id, result.intake, completeness(result.intake))

    message_id = await save_assistant_message(session_id, result, latency_ms=elapsed)
    yield (
        "done",
        {
            "message_id": message_id,
            "latency_ms": elapsed,
            "usage": {"input_tokens": result.input_tokens, "output_tokens": result.output_tokens},
            "agents": result.agents,
            "citations": result.citations,
            "safety": result.safety,
            "route": result.route,
        },
    )
    asyncio.create_task(_background(user.id, session_id, text, result.text))


async def _background(user_id: str, session_id: str, user_text: str, answer: str) -> None:
    try:
        await short_term.summarize_session(session_id)
        await long_term.extract_and_store(user_id, f"用户：{user_text}\nMediFlow：{answer}")
    except Exception as exc:  # noqa: BLE001
        log.warning("background task failed: %s", exc)


async def ensure_session(user: User, session_id: str | None = None, title: str | None = None) -> ChatSession:
    async with SessionFactory() as db:
        if session_id:
            session = await db.get(ChatSession, session_id)
            if session and session.user_id == user.id:
                return session
        session = ChatSession(user_id=user.id, title=title or "新的问诊")
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session


async def list_sessions(user: User, limit: int = 40) -> list[dict]:
    async with SessionFactory() as db:
        sessions = (
            await db.scalars(
                select(ChatSession)
                .where(ChatSession.user_id == user.id, ChatSession.archived.is_(False))
                .order_by(ChatSession.updated_at.desc())
                .limit(limit)
            )
        ).all()
        rows = []
        for session in sessions:
            messages = (
                await db.scalars(
                    select(Message)
                    .where(Message.session_id == session.id)
                    .order_by(Message.created_at.desc())
                    .limit(1)
                )
            ).all()
            count = await short_term.count_messages(db, session.id)
            rows.append(
                {
                    "id": session.id,
                    "title": session.title,
                    # SQLite hands back naive datetimes; the API must speak UTC so the
                    # browser can localise them (otherwise everything reads "8 hours ago").
                    "created_at": _as_utc(session.created_at),
                    "updated_at": _as_utc(session.updated_at),
                    "last_message": messages[0].content[:60] if messages else None,
                    "message_count": count,
                    "safety_level": session.safety_level,
                }
            )
        return rows


async def session_messages(user: User, session_id: str) -> tuple[ChatSession, list[Message]]:
    async with SessionFactory() as db:
        session = await db.get(ChatSession, session_id)
        if session is None or session.user_id != user.id:
            raise ValueError("session not found")
        messages = (
            await db.scalars(
                select(Message).where(Message.session_id == session_id).order_by(Message.created_at)
            )
        ).all()
        return session, list(messages)


def message_payload(message: Message) -> dict:
    meta = message.meta or {}
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "agent": message.agent,
        "created_at": message.created_at,
        "citations": meta.get("citations", []),
        "intake": meta.get("intake"),
        "safety": meta.get("safety"),
        "latency_ms": message.latency_ms,
        "usage": meta.get("usage"),
    }


async def delete_session(user: User, session_id: str) -> bool:
    async with SessionFactory() as db:
        session = await db.get(ChatSession, session_id)
        if session is None or session.user_id != user.id:
            return False
        await db.delete(session)
        await db.commit()
        return True


def sse(event: str, data: dict) -> dict:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False, default=str)}


def retrieval_preview(text: str, k: int = 3) -> list[dict]:
    return citations_from(search(text, k=k))
