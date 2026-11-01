"""Password hashing and JWT helpers."""

from __future__ import annotations

import datetime as dt

import bcrypt
import jwt

from app.config import settings

ALGORITHM = settings.jwt_algorithm


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: str, *, expires_minutes: int | None = None) -> str:
    now = dt.datetime.now(dt.UTC)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int(
            (now + dt.timedelta(minutes=expires_minutes or settings.jwt_ttl_minutes)).timestamp()
        ),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None
