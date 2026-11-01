"""SQLAlchemy models.

Design notes
------------
* One database, two memory layers: `messages` is short-term (thread scoped, TTL by
  `created_at`), `patient_profiles` + `memories` are long-term (user scoped).
* `runs` is the observability table: every assistant turn produces one row, which is
  what `/insights` aggregates. It is append-only.
* JSON columns are used for evolving shapes (citations, intake slots, markers) so the
  schema stays small — see docs/api-contract.md for the shapes.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def new_id() -> str:
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(80), default="用户")

    profile: Mapped[PatientProfile | None] = relationship(back_populates="user", uselist=False)


class PatientProfile(Base, TimestampMixin):
    """Long-term memory, structured: what a clinician would want before the first sentence."""

    __tablename__ = "patient_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    allergies: Mapped[list[str]] = mapped_column(JSON, default=list)
    conditions: Mapped[list[str]] = mapped_column(JSON, default=list)
    medications: Mapped[list[str]] = mapped_column(JSON, default=list)
    smoker: Mapped[str | None] = mapped_column(String(16), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="profile")


class ChatSession(Base, TimestampMixin):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120), default="新的问诊")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_level: Mapped[str] = mapped_column(String(16), default="routine")
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    messages: Mapped[list[Message]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))  # user | assistant
    content: Mapped[str] = mapped_column(Text)
    agent: Mapped[str | None] = mapped_column(String(32), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)  # citations, intake, safety, usage
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class IntakeForm(Base):
    """Structured history-taking slots for one session (the 'examiner' output)."""

    __tablename__ = "intake_forms"

    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True)
    slots: Mapped[dict] = mapped_column(JSON, default=dict)
    completeness: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Report(Base, TimestampMixin):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(16), default="parsing")
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    insight: Mapped[dict] = mapped_column(JSON, default=dict)
    citations: Mapped[list] = mapped_column(JSON, default=list)


class Memory(Base):
    """Long-term, unstructured: durable facts worth recalling across sessions."""

    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(32), default="fact")  # fact | preference | event
    content: Mapped[str] = mapped_column(Text)
    importance: Mapped[float] = mapped_column(Float, default=0.5)
    content_hash: Mapped[str] = mapped_column(String(40), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_used_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Run(Base):
    """One assistant turn. Powers /insights and the eval harness."""

    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    session_id: Mapped[str] = mapped_column(String(32), index=True)
    user_id: Mapped[str] = mapped_column(String(32), index=True)
    trace_id: Mapped[str] = mapped_column(String(32), index=True)
    agents: Mapped[list] = mapped_column(JSON, default=list)
    route: Mapped[dict] = mapped_column(JSON, default=dict)
    safety_level: Mapped[str] = mapped_column(String(16), default="routine")
    status: Mapped[str] = mapped_column(String(16), default="ok")
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    model: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


Index("ix_messages_session_created", Message.session_id, Message.created_at)
Index("ix_runs_user_created", Run.user_id, Run.created_at)
