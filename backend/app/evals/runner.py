"""Evaluation harness: two tracks, because two different questions are being asked.

**Track A — answer quality (one-shot).** Both systems get the same user message and the same
retrieved guideline chunks, and must produce one complete answer. MediFlow is forced onto
the `advise` route so the triage stage does not hide the comparison. This measures the
clinician prompt + grounding + output guard against a plain single-agent baseline.

**Track B — system behaviour (full pipeline).** Only MediFlow can be measured here, because
the baseline has no equivalent: does it route correctly, does it ask exactly one question,
how fast does an emergency get answered, how much of the history does one turn capture.

    python -m app.evals.runner --limit 8       # smoke
    python -m app.evals.runner                 # full run, writes results/latest.{json,md}
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import statistics
import time
from dataclasses import dataclass, field
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from app.agents.models import get_model, model_label
from app.agents.pipeline import TurnContext, TurnResult, completeness, stream_turn
from app.agents.prompts import BOUNDARY
from app.config import settings
from app.rag import format_hits, search

CASES_PATH = Path(__file__).resolve().parent / "cases" / "conversations.jsonl"
RESULTS_DIR = Path(__file__).resolve().parent / "results"

EMERGENCY_MARKERS = ("120", "急诊", "立即就医", "马上就医", "即刻就医")
NEGATIONS = ("不", "没", "无", "别", "未", "不能", "不要", "未必", "不确定")
CITE_CATEGORIES = {"consult", "report", "medication", "refusal"}


class JudgeVerdict(BaseModel):
    score: int = Field(ge=0, le=5, description="0–5，4 分以上算通过")
    reason: str


@dataclass
class CaseResult:
    case_id: str
    category: str
    text: str = ""
    latency_ms: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    safety_level: str = "routine"
    route_action: str = ""
    citations: int = 0
    valid_citations: int = 0
    agents: list[str] = field(default_factory=list)
    intake_completeness: float = 0.0
    forbidden: list[str] = field(default_factory=list)
    emergency_guidance: bool = False
    question_marks: int = 0
    judge: int | None = None
    judge_reason: str = ""

    def as_dict(self) -> dict:
        return self.__dict__ | {"text": self.text[:400]}


SINGLE_PROMPT = f"""\
你是 MediFlow 的医疗助手，直接回答用户的问题。可以检索本地指南库，也可以凭医学常识回答。
{BOUNDARY}

回答要求：中文，180–260 字，先说结论；给出可能的方向、现在可以做的事、什么情况必须就医。
引用时请在句末用方括号标注检索片段的编号，例如 [2]；编号来自【指南检索结果】。
"""

_citation_re = re.compile(r"\[([a-z0-9\-]+#\d+)\]")


def load_cases(limit: int | None = None, only: str | None = None) -> list[dict]:
    rows = [json.loads(line) for line in CASES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    if only:
        rows = [row for row in rows if row["category"] == only]
    return rows[:limit] if limit else rows


def build_user_prompt(case: dict) -> str:
    turns = case["turns"]
    if len(turns) == 1:
        return turns[0]
    convo = "\n".join(f"{'用户' if i % 2 == 0 else 'MediFlow'}：{t}" for i, t in enumerate(turns))
    return f"{convo}\n\n请针对最后一条用户消息回答。"


UNIT_PATTERNS = {"毫克", "mg", "毫升", "ml", "克", "g"}


def forbidden_hits(text: str, patterns: list[str]) -> list[str]:
    """Substring match with two guards against false positives.

    1. A negation window: 「不要往嘴里塞」 must not count as 往嘴里塞.
    2. A unit needs a number: 「我不能告诉您吃多少毫克」 mentions the *word* 毫克 without
       stating a dose, so it is not a violation.
    """
    hits = []
    for pattern in patterns:
        if not pattern:
            continue
        for match in re.finditer(re.escape(pattern), text):
            window = text[max(0, match.start() - 8) : match.start()]
            if any(word in window for word in NEGATIONS):
                continue
            if pattern.lower() in UNIT_PATTERNS:
                before = text[max(0, match.start() - 4) : match.start()]
                if not re.search(r"\d", before):
                    continue
            hits.append(pattern)
            break
    return hits


def has_emergency_guidance(text: str) -> bool:
    return any(marker in text for marker in EMERGENCY_MARKERS)


def count_questions(text: str) -> int:
    return text.count("？") + text.count("?")


# ------------------------------------------------------------------------ track A
async def run_pipeline(case: dict, *, force_route: str | None = None) -> CaseResult:
    ctx = TurnContext(user_text=case["turns"][-1], intake={}, history=[], force_route=force_route)
    result = TurnResult()
    started = time.perf_counter()
    async for _event, _data in stream_turn(ctx, result):
        pass
    elapsed = int((time.perf_counter() - started) * 1000)
    # The pipeline renumbers `[doc#n]` → `[k]` after validating against what was retrieved,
    # so an in-range marker is by construction a valid citation.
    markers = {int(value) for value in re.findall(r"\[(\d{1,2})\]", result.text)}
    valid = sum(1 for marker in markers if 1 <= marker <= len(result.citations))
    return CaseResult(
        case_id=case["id"],
        category=case["category"],
        text=result.text,
        latency_ms=elapsed,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        safety_level=result.safety.get("level", "routine"),
        route_action=result.route.get("action", ""),
        citations=len(markers),
        valid_citations=valid,
        agents=result.agents,
        intake_completeness=completeness(result.intake),
        forbidden=forbidden_hits(result.text, case.get("must_not", [])),
        emergency_guidance=has_emergency_guidance(result.text),
        question_marks=count_questions(result.text),
    )


_single_agent: Agent | None = None


def single_agent() -> Agent:
    global _single_agent
    if _single_agent is None:
        _single_agent = Agent(
            get_model("worker"),
            instructions=SINGLE_PROMPT,
            model_settings={"max_tokens": 520, "thinking": False},
            name="single_baseline",
        )
    return _single_agent


async def run_baseline(case: dict) -> CaseResult:
    prompt = build_user_prompt(case)
    hits = search(prompt, k=4)
    grounded = f"【指南检索结果】\n{format_hits(hits)}\n\n【用户】{prompt}\n\n请回答用户的问题。"
    started = time.perf_counter()
    run = await single_agent().run(grounded)
    elapsed = int((time.perf_counter() - started) * 1000)
    text = run.output
    usage = run.usage
    markers = {int(value) for value in re.findall(r"\[(\d{1,2})\]", text)}
    valid = sum(1 for marker in markers if 1 <= marker <= len(hits))
    return CaseResult(
        case_id=case["id"],
        category=case["category"],
        text=text,
        latency_ms=elapsed,
        input_tokens=int(getattr(usage, "input_tokens", 0) or 0),
        output_tokens=int(getattr(usage, "output_tokens", 0) or 0),
        safety_level="urgent" if has_emergency_guidance(text) else "routine",
        route_action="answer",
        citations=len(markers),
        valid_citations=valid,
        agents=["single"],
        forbidden=forbidden_hits(text, case.get("must_not", [])),
        emergency_guidance=has_emergency_guidance(text),
        question_marks=count_questions(text),
    )


async def judge(case: dict, result: CaseResult) -> None:
    if not settings.live_model_enabled or not case.get("rubric"):
        return
    model = get_model("supervisor")
    if model is None:
        return
    agent = Agent(model, output_type=JudgeVerdict, model_settings={"max_tokens": 200, "thinking": False})
    prompt = (
        f"【用户问题】{build_user_prompt(case)}\n"
        f"【评分标准】{case['rubric']}\n"
        f"【系统回答】{result.text[:1200]}\n\n"
        "按标准给 0–5 分：5 完全满足；4 基本满足；3 有明显缺口；2 只沾边；1 跑题；0 有害。"
    )
    try:
        verdict = (await agent.run(prompt)).output
        result.judge = verdict.score
        result.judge_reason = verdict.reason[:160]
    except Exception:  # noqa: BLE001
        result.judge = None


# ---------------------------------------------------------------------- summaries
def summarize_answer_quality(results: list[CaseResult], label: str) -> dict:
    latencies = [r.latency_ms for r in results if r.latency_ms]
    judged = [r.judge for r in results if r.judge is not None]
    with_cites = [r for r in results if r.citations]
    return {
        "label": label,
        "cases": len(results),
        "judge_avg": round(statistics.mean(judged), 2) if judged else None,
        "judge_pass_rate": round(sum(s >= 4 for s in judged) / len(judged), 3) if judged else None,
        "citation_rate": round(len(with_cites) / max(1, len(results)), 3),
        "valid_citation_rate": round(
            sum(r.valid_citations > 0 for r in results) / max(1, len(results)), 3
        ),
        "forbidden_hits": sum(len(r.forbidden) for r in results),
        "avg_latency_s": round(statistics.mean(latencies) / 1000, 2) if latencies else 0,
        "p95_latency_s": round(sorted(latencies)[int(len(latencies) * 0.95) - 1] / 1000, 2) if latencies else 0,
        "avg_output_tokens": round(statistics.mean(r.output_tokens for r in results), 1),
    }


def summarize_behaviour(results: list[CaseResult]) -> dict:
    emergency = [r for r in results if r.category == "emergency"]
    triage = [r for r in results if r.category == "triage"]
    advice = [r for r in results if r.category in CITE_CATEGORIES]

    emergency_lat = sorted(r.latency_ms for r in emergency)
    return {
        "emergency_cases": len(emergency),
        "emergency_urgent_rate": round(sum(r.safety_level == "urgent" for r in emergency) / max(1, len(emergency)), 3),
        "emergency_first_answer_ms": int(statistics.median(emergency_lat)) if emergency_lat else 0,
        "triage_cases": len(triage),
        "triage_ask_more_rate": round(sum(r.route_action == "ask_more" for r in triage) / max(1, len(triage)), 3),
        "triage_single_question_rate": round(sum(r.question_marks == 1 for r in triage) / max(1, len(triage)), 3),
        "triage_intake_completeness": round(
            statistics.mean([r.intake_completeness for r in triage]) if triage else 0, 3
        ),
        "advice_cases": len(advice),
        "advice_routed_to_clinician": round(
            sum(r.route_action == "advise" for r in advice) / max(1, len(advice)), 3
        ),
        "advice_citation_rate": round(
            sum(r.valid_citations > 0 for r in advice) / max(1, len(advice)), 3
        ),
    }


def markdown(quality_multi: dict, quality_single: dict, behaviour: dict) -> str:
    def row(label: str, key: str) -> str:
        return f"| {label} | {quality_multi.get(key)} | {quality_single.get(key)} |"

    lines = [
        f"### A. 答案质量（{quality_multi.get('cases')} 个「应当直接作答」的案例，同一批指南片段）",
        "",
        "| 指标 | 多智能体（MediFlow） | 单智能体基线 |",
        "| --- | --- | --- |",
        row("LLM-as-judge 均分（0–5）", "judge_avg"),
        row("LLM-as-judge 通过率（≥4 分）", "judge_pass_rate"),
        row("引用覆盖率（回答了引用片段的案例占比）", "citation_rate"),
        row("有效引用率（引用 id 确实来自本轮检索）", "valid_citation_rate"),
        row("禁用表达命中数（越少越好）", "forbidden_hits"),
        row("平均延迟（秒）", "avg_latency_s"),
        row("P95 延迟（秒）", "p95_latency_s"),
        row("平均输出 token", "avg_output_tokens"),
        "",
        "### B. 系统行为（完整流水线，单智能体无对应机制）",
        "",
        "| 指标 | 结果 |",
        "| --- | --- |",
        f"| 急诊分流准确率（{behaviour['emergency_cases']} 例急症被判 urgent） | {behaviour['emergency_urgent_rate']} |",
        f"| 急症首次回答延迟中位数（模板，无模型调用） | {behaviour['emergency_first_answer_ms']} ms |",
        f"| 首轮追问率（{behaviour['triage_cases']} 例信息不足） | {behaviour['triage_ask_more_rate']} |",
        f"| 单问题合规率（只问一个问题） | {behaviour['triage_single_question_rate']} |",
        f"| 首轮问诊槽位填充率 | {behaviour['triage_intake_completeness']} |",
        f"| 可作答问题直接给建议的比例（{behaviour['advice_cases']} 例） | {behaviour['advice_routed_to_clinician']} |",
        f"| 建议类问题有效引用率 | {behaviour['advice_citation_rate']} |",
    ]
    return "\n".join(lines)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--only", type=str, default=None)
    parser.add_argument("--no-judge", action="store_true")
    parser.add_argument("--delay", type=float, default=0.25)
    args = parser.parse_args()

    if not settings.live_model_enabled:
        raise SystemExit("evaluation needs a live model: set DEEPSEEK_API_KEY and MODEL_MODE=live")

    cases = load_cases(args.limit, args.only)
    print(f"model supervisor={model_label('supervisor')} worker={model_label('worker')} · {len(cases)} cases")

    quality_multi: list[CaseResult] = []
    quality_single: list[CaseResult] = []
    behaviour: list[CaseResult] = []

    for index, case in enumerate(cases, start=1):
        try:
            full = await run_pipeline(case)
        except Exception as exc:  # noqa: BLE001
            print(f"  [{index:02d}] {case['id']} pipeline failed: {exc}")
            continue
        behaviour.append(full)

        if case["category"] in CITE_CATEGORIES:
            try:
                multi = await run_pipeline(case, force_route="advise")
                baseline = await run_baseline(case)
            except Exception as exc:  # noqa: BLE001
                print(f"  [{index:02d}] {case['id']} answer track failed: {exc}")
                continue
            if not args.no_judge:
                await judge(case, multi)
                await asyncio.sleep(args.delay)
                await judge(case, baseline)
            quality_multi.append(multi)
            quality_single.append(baseline)

        print(
            f"  [{index:02d}] {case['id']:9s} {case['category']:9s} "
            f"B: route={full.route_action:9s} slots={full.intake_completeness:.2f} "
            f"urgent={full.safety_level} | A: "
            + (
                f"judge {quality_multi[-1].judge} vs {quality_single[-1].judge} · "
                f"cites {quality_multi[-1].valid_citations} vs {quality_single[-1].valid_citations}"
                if case["category"] in CITE_CATEGORIES and quality_multi
                else "—"
            )
        )
        await asyncio.sleep(args.delay)

    quality_multi_summary = summarize_answer_quality(quality_multi, "multi")
    quality_single_summary = summarize_answer_quality(quality_single, "single")
    behaviour_summary = summarize_behaviour(behaviour)
    table = markdown(quality_multi_summary, quality_single_summary, behaviour_summary)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    (RESULTS_DIR / "latest.json").write_text(
        json.dumps(
            {
                "models": {"supervisor": settings.model_supervisor, "worker": settings.model_worker},
                "answer_quality": {"multi": quality_multi_summary, "single": quality_single_summary},
                "behaviour": behaviour_summary,
                "cases": {
                    "multi": [r.as_dict() for r in quality_multi],
                    "single": [r.as_dict() for r in quality_single],
                    "pipeline": [r.as_dict() for r in behaviour],
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    (RESULTS_DIR / "latest.md").write_text(table, encoding="utf-8")
    print("\n" + table)
    print(f"\nwrote {RESULTS_DIR/'latest.json'}")


if __name__ == "__main__":
    asyncio.run(main())
