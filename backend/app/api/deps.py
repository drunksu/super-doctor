"""Request dependencies: bearer auth."""

from __future__ import annotations

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.errors import unauthorized
from app.db.models import User
from app.db.session import get_db
from app.services.auth import decode_access_token


async def current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise unauthorized()
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_access_token(token)
    if not user_id:
        raise unauthorized()
    user = await db.get(User, user_id)
    if user is None:
        raise unauthorized()
    return user
