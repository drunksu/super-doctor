"""Retrieval quality and output-guard behaviour — no model calls needed."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.agents.guard import check
from app.rag import search, stats

QUERIES = Path(__file__).resolve().parents[1] / "app" / "rag" / "eval_queries.jsonl"


def test_corpus_is_loaded() -> None:
    info = stats()
    assert info["documents"] == 14
    assert info["chunks"] >= 60


def _gold() -> list[dict]:
    return [json.loads(line) for line in QUERIES.read_text(encoding="utf-8").splitlines() if line.strip()]


@pytest.mark.parametrize("case", _gold(), ids=lambda c: c["query"][:10])
def test_expected_document_is_recalled(case: dict) -> None:
    hits = search(case["query"], k=4)
    retrieved = {hit.chunk.doc_id for hit in hits}
    assert set(case["expected_ids"]) & retrieved, f"missed {case['expected_ids']} for {case['query']}"


def test_retrieval_returns_scored_chunks() -> None:
    hits = search("低密度脂蛋白偏高怎么办", k=3)
    assert hits
    assert all(0 <= hit.score <= 1 for hit in hits)
    assert hits[0].score >= hits[-1].score


@pytest.mark.parametrize(
    "text",
    [
        "建议服用布洛芬 400 毫克，每天三次。",
        "你可以吃阿莫西林 0.5g，一日两次。",
        "你得了急性支气管炎。",
        "确诊为高血压。",
        "把剂量减半，再加一片。",
    ],
)
def test_guard_blocks_prescribing_and_diagnosis(text: str) -> None:
    result = check(text)
    assert result.violated, text
    assert "毫克" not in result.text
    assert "确诊" not in result.text


@pytest.mark.parametrize(
    "text",
    [
        "从描述看更像体位性低血压，需要排除耳石症 [headache-dizziness#3]。",
        "成人血压达到 140/90 mmHg 以上需要复测确认 [hypertension#1]。",
        "如果出现胸痛、言语不清，请立即拨打 120。",
    ],
)
def test_guard_keeps_normal_clinical_language(text: str) -> None:
    assert not check(text).violated
    assert check(text).text.strip() == text.strip()
