"""The safety screen is the product's hard floor: these tests are the specification."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.safety.rules import assess, merge

CASES = Path(__file__).resolve().parents[1] / "app" / "evals" / "cases" / "conversations.jsonl"


def _cases() -> list[dict]:
    return [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]


@pytest.mark.parametrize("case", [c for c in _cases() if c["category"] == "emergency"], ids=lambda c: c["id"])
def test_every_emergency_case_is_flagged_urgent(case: dict) -> None:
    result = assess(case["turns"][0])
    assert result.level == "urgent", f"{case['id']} should be urgent, got {result.level}"
    assert result.flags, "an urgent screen must carry at least one flag"
    assert result.action and "120" in result.action


@pytest.mark.parametrize(
    "text",
    [
        "最近总是头晕，早上起来尤其明显",
        "体检报告说低密度脂蛋白偏高，需要吃药吗",
        "孩子发烧 38.5 度，精神还可以",
        "我想问一下高血压平时要注意什么",
    ],
)
def test_common_consultations_are_not_alarming(text: str) -> None:
    assert assess(text).level == "routine"


@pytest.mark.parametrize(
    "text",
    [
        "我没有胸痛，就是有点心慌",
        "没有发烧，也不咳嗽",
        "否认晕倒，只是站起来眼前一黑",
    ],
)
def test_negation_suppresses_matches(text: str) -> None:
    assert assess(text).level == "routine", assess(text).flags


def test_chest_pain_with_sweat_beats_plain_chest_pain() -> None:
    plain = assess("胸口有点闷")
    acs = assess("胸口压着疼，满头大汗，十几分钟了")
    assert plain.level in {"attention", "urgent"}
    assert acs.level == "urgent"
    assert acs.flags[0]["code"] in {"chest_pain_acs", "chest_pain_duration"}


def test_merge_never_lowers_severity() -> None:
    routine = assess("最近睡不好")
    escalated = merge(routine, "urgent", [{"code": "x", "label": "x", "rationale": "x", "level": "urgent"}])
    assert escalated.level == "urgent"
    assert escalated.action and "120" in escalated.action

    urgent = assess("胸痛伴大汗")
    kept = merge(urgent, "routine", [])
    assert kept.level == "urgent"
