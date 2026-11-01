"""Wire types — these mirror docs/api-contract.md one-to-one."""

from __future__ import annotations

import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_serializer

AgentId = Literal["supervisor", "triage", "clinician", "report", "safety"]
SafetyLevel = Literal["routine", "attention", "urgent"]


def _as_utc(value: dt.datetime | None) -> dt.datetime | None:
    """SQLite drops tzinfo; the API must still speak UTC so the browser can localise it."""
    if value is None:
        return None
    return value.replace(tzinfo=dt.UTC) if value.tzinfo is None else value


class UtcSerialized(BaseModel):
    """Serialise datetimes with an explicit offset, without repeating a validator everywhere."""

    @field_serializer("created_at", "updated_at", check_fields=False, when_used="json")
    def _serialize_datetime(self, value: dt.datetime | None) -> str | None:
        converted = _as_utc(value)
        return converted.isoformat() if converted else None


# --------------------------------------------------------------------------- auth
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(default="体验用户", max_length=40)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PatientProfileOut(BaseModel):
    birth_year: int | None = None
    sex: Literal["female", "male", "other"] | None = None
    height_cm: float | None = None
    weight_kg: float | None = None
    allergies: list[str] = []
    conditions: list[str] = []
    medications: list[str] = []
    smoker: Literal["never", "former", "current"] | None = None
    summary: str | None = None


class UserOut(BaseModel):
    id: str
    email: str
    display_name: str
    profile: PatientProfileOut | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ------------------------------------------------------------------------ session
class SessionSummary(UtcSerialized):
    id: str
    title: str
    created_at: dt.datetime
    updated_at: dt.datetime
    last_message: str | None = None
    message_count: int = 0
    safety_level: SafetyLevel | None = None


class Citation(BaseModel):
    id: str
    title: str
    source: str
    section: str
    snippet: str
    score: float = 0.0


class IntakeSnapshot(BaseModel):
    chief_complaint: str | None = None
    onset: str | None = None
    duration: str | None = None
    severity: int | None = None
    location: str | None = None
    associated: list[str] = []
    history: list[str] = []
    medications: list[str] = []
    allergies: list[str] = []
    completeness: float = 0.0
    missing: list[str] = []


class SafetyFlag(BaseModel):
    level: SafetyLevel = "routine"
    flags: list[dict] = []
    action: str | None = None


class MessageOut(UtcSerialized):
    id: str
    role: Literal["user", "assistant"]
    content: str
    agent: AgentId | None = None
    created_at: dt.datetime
    citations: list[Citation] = []
    intake: IntakeSnapshot | None = None
    safety: SafetyFlag | None = None
    latency_ms: int | None = None
    usage: dict | None = None


class SessionDetail(BaseModel):
    session: SessionSummary
    messages: list[MessageOut]


class ChatRequest(BaseModel):
    session_id: str
    message: str = Field(min_length=1, max_length=4000)


# --------------------------------------------------------------------- meta/misc
class AgentCard(BaseModel):
    id: AgentId
    name: str
    role: str
    color: str
    description: str


class MarkerOut(BaseModel):
    name: str
    value: str
    unit: str | None = None
    reference: str | None = None
    status: Literal["low", "normal", "high", "critical"] = "normal"
    note: str = ""


class ReportInsight(UtcSerialized):
    id: str
    filename: str
    created_at: dt.datetime
    status: Literal["parsing", "ready", "failed"] = "ready"
    patient_hint: dict | None = None
    summary: str = ""
    markers: list[MarkerOut] = []
    questions_for_doctor: list[str] = []
    citations: list[Citation] = []
    disclaimer: str = ""


class ReportListItem(UtcSerialized):
    id: str
    filename: str
    created_at: dt.datetime
    status: str
    marker_count: int = 0
    summary: str = ""


class RouteCount(BaseModel):
    agent: AgentId
    count: int


class DailyPoint(BaseModel):
    date: str
    runs: int


class InsightsOut(BaseModel):
    runs: int = 0
    sessions: int = 0
    messages: int = 0
    avg_latency_ms: int = 0
    p95_latency_ms: int = 0
    tokens: dict = {"input": 0, "output": 0}
    routes: list[RouteCount] = []
    safety: dict = {"routine": 0, "attention": 0, "urgent": 0}
    daily: list[DailyPoint] = []
    intake_completion: float = 0.0


class HealthOut(BaseModel):
    status: str = "ok"
    model_mode: Literal["live", "mock"]
    version: str
