"""Async engine, session factory, schema creation and demo seeding."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.models import Base, PatientProfile, User

log = logging.getLogger("mediflow.db")

engine = create_async_engine(
    settings.resolved_database_url,
    echo=False,
    future=True,
    connect_args={"check_same_thread": False} if settings.resolved_database_url.startswith("sqlite") else {},
)

SessionFactory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


if settings.resolved_database_url.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_demo_user()


async def seed_demo_user() -> None:
    """Idempotent: the demo account referenced by README, tests and screenshots."""
    from app.services.auth import hash_password

    async with SessionFactory() as db:
        existing = await db.scalar(select(User).where(User.email == settings.demo_email))
        if existing:
            await _ensure_sample_report(db, existing.id)
            return
        user = User(
            email=settings.demo_email,
            password_hash=hash_password(settings.demo_password),
            display_name=settings.demo_display_name,
        )
        db.add(user)
        await db.flush()
        db.add(
            PatientProfile(
                user_id=user.id,
                birth_year=1991,
                sex="female",
                height_cm=164,
                weight_kg=56,
                allergies=["青霉素"],
                conditions=["偏头痛"],
                medications=[],
                smoker="never",
                summary="32 岁女性，偏头痛病史 5 年，青霉素过敏，无长期用药。",
            )
        )

        # A ready-made report so /reports is never empty on first open (and screenshots
        # do not depend on an upload).
        await _ensure_sample_report(db, user.id)

        await db.commit()
        log.info("seeded demo user %s", settings.demo_email)


async def _ensure_sample_report(db, user_id: str) -> None:
    from sqlalchemy import func

    from app.db.models import Report

    count = await db.scalar(select(func.count()).select_from(Report).where(Report.user_id == user_id))
    if count:
        return
    try:
        from app.services.reports import build_sample_insight, sample_text

        insight = build_sample_insight()
        db.add(
            Report(
                user_id=user_id,
                filename="2026-09 体检报告（示例）.pdf",
                status="ready",
                raw_text=sample_text(),
                insight=insight,
                citations=insight.get("citations", []),
            )
        )
        await db.commit()
    except Exception as exc:  # noqa: BLE001 - seeding is best effort
        log.warning("sample report seed skipped: %s", exc)


async def dispose() -> None:
    await engine.dispose()
