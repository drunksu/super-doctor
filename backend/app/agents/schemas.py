"""Typed contracts for model output. Every model call returns one of these — no free-form
parsing, no "parse the JSON out of the reply" code paths.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RouteAction = Literal["ask_more", "advise", "small_talk"]

INTAKE_SLOTS: tuple[str, ...] = (
    "chief_complaint",
    "onset",
    "duration",
    "severity",
    "location",
    "associated",
    "history",
    "medications",
    "allergies",
)

SLOT_LABELS = {
    "chief_complaint": "主要不适",
    "onset": "起病方式",
    "duration": "持续时间",
    "severity": "严重程度",
    "location": "部位",
    "associated": "伴随症状",
    "history": "既往史",
    "medications": "在用药物",
    "allergies": "过敏史",
}


class RouteDecision(BaseModel):
    """Supervisor output: where this turn goes and why."""

    action: RouteAction = Field(description="ask_more 继续追问；advise 给出建议；small_talk 寒暄或说明")
    focus: str = Field(description="本轮最需要确认或回答的一个点，10 字以内")
    reason: str = Field(description="一句话说明为什么这样路由")
    confidence: float = Field(default=0.8, ge=0, le=1)


class ReportNarrative(BaseModel):
    summary: str = Field(description="2–3 句白话总结，说明整体印象与最值得关注的一项")
    marker_notes: list[str] = Field(default_factory=list, description="与 markers 顺序一致的逐项说明")
    questions_for_doctor: list[str] = Field(default_factory=list, description="3–5 个就诊时可以问医生的问题")


class ClinicalPlan(BaseModel):
    """Optional structured side-channel used by the eval harness and the UI overview."""

    directions: list[str] = Field(default_factory=list, description="可能的方向（不是诊断）")
    when_to_seek_care: list[str] = Field(default_factory=list)
    self_care: list[str] = Field(default_factory=list)


class IntakeExtraction(BaseModel):
    """Slot filling from one user message. Values stay close to the user's own words."""

    captured: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "本轮用户消息中能确定的槽位。key 只能是 chief_complaint / onset / duration / "
            "severity / location / associated / history / medications / allergies；"
            "value 用用户原话，20 字以内。不确定就不要填。"
        ),
    )
    red_flags: list[str] = Field(default_factory=list, description="用户明确提到的危险信号，没有就留空")
