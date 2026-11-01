"""Post-generation guard.

The model is instructed not to prescribe; this module makes that true even when the model
disobeys. Text is released to the client **sentence by sentence**: a sentence that matches a
prescriptive or diagnostic pattern never leaves the process. That is the difference between a
disclaimer and a guarantee, and it costs one regex per sentence.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# A drug + a number + a unit is a prescription, not education.
_PRESCRIPTION = re.compile(
    r"(服用|口服|吃|用|每次|每日|每天|一日|一天).{0,12}?"
    r"(\d+(?:\.\d+)?)\s*(mg|毫克|g|克|ml|毫升|片|粒|袋|支|iu|单位)",
    re.IGNORECASE,
)
# Any bare dose-looking number is refused, even outside an imperative sentence: this
# product never states how much of a drug to take. `g/L`, `mg/dL` and friends are lab
# units, not doses, and are excluded by the look-ahead.
_DOSE_AMOUNT = re.compile(
    r"(?<![\w/])\d+(?:\.\d+)?\s*(?:mg|毫克|μg|微克|g|克|片|粒|袋|支|iu|单位)(?![a-zA-Z/])",
    re.IGNORECASE,
)
# "再加一片" / "剂量加倍" style adjustments.
_DOSE_ADJUST = re.compile(r"(加|减|停|换).{0,4}(量|一片|半片|剂量|颗|粒)")
# Definitive diagnosis.
_DIAGNOSIS = re.compile(
    r"(你|您)(就是|得了|患了|是)(了)?\s*(?!不是)"
    r"[\u4e00-\u9fff]{0,6}(病|炎|癌|症|综合征|感染)"
)
_CONFIRM = re.compile(r"确诊为|可以确诊|明确诊断")

SAFE_REPLACEMENT = "（具体用药需要医生根据你的情况开具，这里不提供剂量建议。）"

_SENTENCE_END = re.compile(r"(?<=[。！？；\n])")


@dataclass
class GuardResult:
    text: str
    violated: bool
    codes: list[str]


class SentenceGuard:
    """Buffers streamed text, releases whole sentences, sanitises violations."""

    def __init__(self) -> None:
        self._buffer = ""
        self.violations: list[str] = []

    def feed(self, delta: str) -> str:
        """Return the sanitised text that is safe to send now (may be empty)."""
        self._buffer += delta
        released = ""
        while True:
            match = _SENTENCE_END.search(self._buffer)
            if not match:
                break
            end = match.end()
            sentence, self._buffer = self._buffer[:end], self._buffer[end:]
            released += self._sanitize(sentence)
        return released

    def flush(self) -> str:
        rest, self._buffer = self._buffer, ""
        return self._sanitize(rest)

    def _sanitize(self, sentence: str) -> str:
        if not sentence.strip():
            return sentence
        codes = []
        if _PRESCRIPTION.search(sentence) or _DOSE_AMOUNT.search(sentence):
            codes.append("prescription")
        if _DOSE_ADJUST.search(sentence):
            codes.append("dose_adjustment")
        if _DIAGNOSIS.search(sentence) or _CONFIRM.search(sentence):
            codes.append("definitive_diagnosis")
        if not codes:
            return sentence
        self.violations.extend(codes)
        return SAFE_REPLACEMENT

    @property
    def violated(self) -> bool:
        return bool(self.violations)


def check(text: str) -> GuardResult:
    """One-shot check used by tests and the eval harness."""
    guard = SentenceGuard()
    out = guard.feed(text) + guard.flush()
    return GuardResult(text=out, violated=guard.violated, codes=sorted(set(guard.violations)))
