"""Session CRUD."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.api.errors import not_found
from app.db.models import User
from app.db.session import get_db
from app.schemas import MessageOut, SessionDetail, SessionSummary
from app.services import chat

router = APIRouter(tags=["sessions"])


@router.get("/sessions")
async def list_sessions(user: User = Depends(current_user)) -> dict:
    return {"sessions": await chat.list_sessions(user)}


@router.post("/sessions", status_code=201)
async def create_session(payload: dict | None = None, user: User = Depends(current_user)) -> SessionSummary:
    title = (payload or {}).get("title") or "新的问诊"
    session = await chat.ensure_session(user, title=title)
    return SessionSummary(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        last_message=None,
        message_count=0,
        safety_level="routine",
    )


@router.get("/sessions/{session_id}/messages", response_model=SessionDetail)
async def get_messages(
    session_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> SessionDetail:
    try:
        session, messages = await chat.session_messages(user, session_id)
    except ValueError:
        raise not_found("会话") from None
    return SessionDetail(
        session=SessionSummary(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            last_message=messages[-1].content[:60] if messages else None,
            message_count=len(messages),
            safety_level=session.safety_level,  # type: ignore[arg-type]
        ),
        messages=[MessageOut(**chat.message_payload(message)) for message in messages],
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, user: User = Depends(current_user)) -> Response:
    if not await chat.delete_session(user, session_id):
        raise not_found("会话")
    return Response(status_code=204)
