"""Long-term memory: what survives the session.

Two shapes, because they answer different questions:

* **structured** (`patient_profiles`) — age, sex, allergies, conditions, medications. Always
  injected, never summarised, because an allergy is not something to compress.
* **unstructured** (`memories`) — durable facts extracted from conversation, recalled by
  similarity when relevant. Bounded to a handful per turn so it cannot crowd out the window.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Memory, PatientProfile, User

log = logging.getLogger("mediflow.memory.long")


def _age(birth_year: int | None) -> int | None:
    if not birth_year:
        return None
    return max(0, dt.date.today().year - birth_year)


async def profile_dict(db: AsyncSession, user_id: str) -> dict:
    profile = await db.get(PatientProfile, user_id)
    if profile is None:
        return {}
    return {
        "age": _age(profile.birth_year),
        "sex": profile.sex,
        "height_cm": profile.height_cm,
        "weight_kg": profile.weight_kg,
        "allergies": profile.allergies or [],
        "conditions": profile.conditions or [],
        "medications": profile.medications or [],
        "smoker": profile.smoker,
        "summary": profile.summary,
    }


async def add_memory(db: AsyncSession, user_id: str, kind: str, content: str, importance: float = 0.6) -> Memory | None:
    content = content.strip()
    if len(content) < 4:
        return None
    digest = hashlib.sha1(f"{user_id}:{content}".encode()).hexdigest()[:32]
    exists = await db.scalar(select(Memory).where(Memory.content_hash == digest))
    if exists:
        return None
    memory = Memory(
        user_id=user_id, kind=kind, content=content, importance=importance, content_hash=digest
    )
    db.add(memory)
    await db.flush()
    return memory


async def recall(db: AsyncSession, user_id: str, query: str, k: int = 4) -> list[str]:
    rows = (
        await db.scalars(select(Memory).where(Memory.user_id == user_id).order_by(Memory.importance.desc()).limit(80))
    ).all()
    if not rows:
        return []
    if len(rows) <= k:
        return [row.content for row in rows]

    from app.rag.index import tokenize

    query_tokens = set(tokenize(query))
    if not query_tokens:
        return [row.content for row in rows[:k]]

    scored: list[tuple[float, Memory]] = []
    for row in rows:
        tokens = set(tokenize(row.content))
        overlap = len(tokens & query_tokens) / (len(query_tokens) ** 0.5 + 1e-6)
        scored.append((overlap + 0.15 * row.importance, row))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [row.content for _, row in scored[:k]]


async def touch(db: AsyncSession, user_id: str, memories: list[str]) -> None:
    if not memories:
        return
    rows = (await db.scalars(select(Memory).where(Memory.user_id == user_id, Memory.content.in_(memories)))).all()
    now = dt.datetime.now(dt.UTC)
    for row in rows:
        row.last_used_at = now


async def extract_and_store(user_id: str, conversation: str) -> None:
    """Background extraction with the fast model. Failures are logged, never raised."""
    if not settings.live_model_enabled:
        return

    from pydantic_ai import Agent

    from app.agents.models import get_model
    from app.agents.prompts import MEMORY_PROMPT
    from app.db.session import SessionFactory

    model = get_model("supervisor")
    if model is None:
        return
    try:
        agent = Agent(model, instructions=MEMORY_PROMPT, model_settings={"max_tokens": 220})
        result = await agent.run(conversation[-4000:])
        raw = result.output.strip()
    except Exception as exc:  # noqa: BLE001
        log.warning("memory extraction failed: %s", exc)
        return
    if not raw or raw.upper().startswith("NONE"):
        return

    async with SessionFactory() as db:
        for line in raw.splitlines():
            line = line.strip(" -•\t")
            if "|" not in line:
                continue
            kind, content = line.split("|", 1)
            kind = kind.strip().lower()
            if kind not in {"fact", "preference", "event"}:
                kind = "fact"
            content = re.sub(r"\s+", " ", content.strip())
            if 4 <= len(content) <= 120:
                await add_memory(db, user_id, kind, content)
        await db.commit()


async def user_display(db: AsyncSession, user_id: str) -> str:
    user = await db.get(User, user_id)
    return user.display_name if user else "用户"
