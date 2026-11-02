"""Agent definitions.

Four agents, each with one job and one output contract:

| agent      | tier    | output          | does                                        |
|------------|---------|-----------------|---------------------------------------------|
| supervisor | flash   | RouteDecision   | decides where the turn goes                 |
| intake     | flash   | IntakeExtraction| fills history-taking slots from free text   |
| triage     | v4-pro  | text            | asks exactly one question                   |
| clinician  | v4-pro  | text            | guidance grounded in pre-retrieved chunks   |
| report     | v4-pro  | ReportNarrative | explains lab values                         |

Retrieval is *not* a model decision here: the pipeline retrieves before generation and
injects the chunks. That makes grounding observable (you can log what the model saw),
keeps latency predictable, and removes a whole class of "the model forgot to search"
failures. The trade-off is discussed in docs/architecture.md.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache

from pydantic_ai import Agent
from pydantic_ai.models import ModelSettings

from app.agents.models import get_model
from app.agents.prompts import (
    CLINICIAN_PROMPT,
    INTAKE_PROMPT,
    REPORT_PROMPT,
    SUPERVISOR_PROMPT,
    TRIAGE_PROMPT,
)
from app.agents.schemas import IntakeExtraction, ReportNarrative, RouteDecision

log = logging.getLogger("super-doctor.agents")


@dataclass
class AgentDeps:
    """Kept for tests and for future tool use; the pipeline no longer relies on tools."""

    patient: dict = field(default_factory=dict)
    intake: dict = field(default_factory=dict)
    citations: list[dict] = field(default_factory=list)
    flags: list[dict] = field(default_factory=list)


@lru_cache(maxsize=1)
def triage_agent() -> Agent[None, str]:
    # A question does not need a chain of thought: thinking off is ~7x faster to first token.
    return Agent(
        get_model("worker"),
        instructions=TRIAGE_PROMPT,
        model_settings=ModelSettings(max_tokens=320, timeout=60, thinking=False),
        name="triage",
    )


@lru_cache(maxsize=1)
def clinician_agent() -> Agent[None, str]:
    # Thinking is off here too: with `reasoning_effort=low` the same turn took ~38 s and
    # produced 2.5k tokens (most of them chain of thought) versus ~2 s without it. The
    # structure comes from the prompt, not from the model thinking longer.
    return Agent(
        get_model("worker"),
        instructions=CLINICIAN_PROMPT,
        model_settings=ModelSettings(max_tokens=800, timeout=90, thinking=False),
        name="clinician",
    )


@lru_cache(maxsize=1)
def supervisor_agent() -> Agent[None, RouteDecision]:
    return Agent(
        get_model("supervisor"),
        output_type=RouteDecision,
        instructions=SUPERVISOR_PROMPT,
        model_settings=ModelSettings(max_tokens=300, timeout=30, thinking=False),
        name="supervisor",
    )


@lru_cache(maxsize=1)
def intake_agent() -> Agent[None, IntakeExtraction]:
    return Agent(
        get_model("supervisor"),
        output_type=IntakeExtraction,
        instructions=INTAKE_PROMPT,
        model_settings=ModelSettings(max_tokens=400, timeout=40, thinking=False),
        name="intake",
    )


@lru_cache(maxsize=1)
def smalltalk_agent() -> Agent[None, str]:
    return Agent(
        get_model("supervisor"),
        instructions=(
            "你是 Super-Doctor 的接待助手。用一两句话回应寒暄或产品问题，不要给医学建议；"
            "如果用户在描述症状，提醒他可以直接说哪里不舒服。不承诺疗效，不做诊断。中文，60 字以内。"
        ),
        model_settings=ModelSettings(max_tokens=200, timeout=30),
        name="supervisor",
    )


@lru_cache(maxsize=1)
def report_agent() -> Agent[None, ReportNarrative]:
    return Agent(
        get_model("worker"),
        output_type=ReportNarrative,
        instructions=REPORT_PROMPT,
        model_settings=ModelSettings(max_tokens=1200, timeout=90),
        name="report",
    )


def reset_agents() -> None:
    """Used by tests when settings change."""
    for factory in (
        triage_agent,
        clinician_agent,
        supervisor_agent,
        intake_agent,
        smalltalk_agent,
        report_agent,
    ):
        factory.cache_clear()
