"""Short-term memory: the message window, plus a rolling summary.

`thread_id` is the boundary: messages belong to a session and nothing from another session
can enter this window. The summary is what keeps a long consultation from blowing the
context budget without losing the thread — it is regenerated every N messages, not on
every turn, so it costs one call per six messages instead of one per message.
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import ChatSession, Message

log = logging.getLogger("super-doctor.memory.short")


async def load_history(db: AsyncSession, session_id: str, limit: int | None = None) -> list[dict]:
    limit = limit or settings.max_context_messages
    rows = (
        await db.scalars(
            select(Message)
            .where(Message.session_id == session_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
    ).all()
    return [{"role": row.role, "content": row.content} for row in reversed(rows)]


async def prune_old_messages(db: AsyncSession, session_id: str, keep_days: int | None = None) -> int:
    """TTL for short-term memory. Returns the number of rows removed."""
    import datetime as dt

    keep_days = keep_days or settings.intake_ttl_days
    cutoff = dt.datetime.now(dt.UTC) - dt.timedelta(days=keep_days)
    rows = (
        await db.scalars(select(Message).where(Message.session_id == session_id, Message.created_at < cutoff))
    ).all()
    for row in rows:
        await db.delete(row)
    return len(rows)


async def count_messages(db: AsyncSession, session_id: str) -> int:
    return int(await db.scalar(select(func.count()).select_from(Message).where(Message.session_id == session_id)) or 0)


async def summarize_session(session_id: str) -> None:
    """Regenerate the session summary with the fast model. Safe to call in a background task."""
    if not settings.live_model_enabled:
        return

    from app.agents.models import get_model
    from app.agents.prompts import SUMMARY_PROMPT
    from app.db.session import SessionFactory

    async with SessionFactory() as db:
        session = await db.get(ChatSession, session_id)
        if session is None:
            return
        total = await count_messages(db, session_id)
        if total < 2 or total % settings.summary_every_messages != 0:
            return
        rows = (
            await db.scalars(
                select(Message).where(Message.session_id == session_id).order_by(Message.created_at).limit(40)
            )
        ).all()
        transcript = "\n".join(f"{'用户' if m.role == 'user' else 'Super-Doctor'}：{m.content}" for m in rows)

    try:
        from pydantic_ai import Agent

        model = get_model("supervisor")
        if model is None:
            return
        agent = Agent(model, instructions=SUMMARY_PROMPT, model_settings={"max_tokens": 220})
        result = await agent.run(transcript[-6000:])
        summary = result.output.strip()
    except Exception as exc:  # noqa: BLE001 - a missing summary must never break a chat turn
        log.warning("summarize failed for %s: %s", session_id, exc)
        return

    async with SessionFactory() as db:
        session = await db.get(ChatSession, session_id)
        if session is not None:
            session.summary = summary
            await db.commit()
