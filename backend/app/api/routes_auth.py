"""Auth and profile routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.api.errors import ApiError, invalid_credentials
from app.db.models import PatientProfile, User
from app.db.session import get_db
from app.schemas import (
    LoginIn,
    PatientProfileOut,
    RegisterIn,
    TokenOut,
    UserOut,
)
from app.services.auth import create_access_token, hash_password, verify_password

router = APIRouter(tags=["auth"])


def _profile_out(profile: PatientProfile | None) -> PatientProfileOut | None:
    if profile is None:
        return None
    return PatientProfileOut(
        birth_year=profile.birth_year,
        sex=profile.sex,  # type: ignore[arg-type]
        height_cm=profile.height_cm,
        weight_kg=profile.weight_kg,
        allergies=profile.allergies or [],
        conditions=profile.conditions or [],
        medications=profile.medications or [],
        smoker=profile.smoker,  # type: ignore[arg-type]
        summary=profile.summary,
    )


@router.post("/auth/register", response_model=TokenOut, status_code=201)
async def register(payload: RegisterIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    existing = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise ApiError("email_taken", "这个邮箱已经注册过了", 409)
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut(id=user.id, email=user.email, display_name=user.display_name),
    )


@router.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn, db: AsyncSession = Depends(get_db)) -> TokenOut:
    user = await db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials()
    profile = await db.get(PatientProfile, user.id)
    return TokenOut(
        access_token=create_access_token(user.id),
        user=UserOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            profile=_profile_out(profile),
        ),
    )


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)) -> UserOut:
    profile = await db.get(PatientProfile, user.id)
    return UserOut(
        id=user.id, email=user.email, display_name=user.display_name, profile=_profile_out(profile)
    )


@router.put("/me/profile", response_model=PatientProfileOut)
async def update_profile(
    payload: PatientProfileOut,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> PatientProfileOut:
    profile = await db.get(PatientProfile, user.id)
    if profile is None:
        profile = PatientProfile(user_id=user.id)
        db.add(profile)
    for field, value in payload.model_dump().items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return _profile_out(profile)  # type: ignore[return-value]
