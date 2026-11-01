"""Turn orchestration.

    safety (deterministic rules)
      ├─ urgent ─────────────────────────────► emergency playbook (template, no model)
      └─ routine/attention
           ├─ route: fast path (rules) or supervisor (flash)
           ├─ retrieve: BM25 + TF-IDF + RRF over the local guideline corpus
           ├─ reply: triage (one question) │ clinician (grounded advice) │ reception
           └─ intake: structured extraction in parallel with the reply

Two deliberate choices:

* **Retrieval happens before generation.** The model cannot "forget to search", the
  retrieved chunks are logged, and hallucinated citations become detectable.
* **The guard releases text sentence by sentence.** A sentence that prescribes or
  diagnoses never reaches the client — not even for one frame.
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app.agents.agents import (
    clinician_agent,
    intake_agent,
    smalltalk_agent,
    supervisor_agent,
    triage_agent,
)
from app.agents.guard import SentenceGuard
from app.agents.models import model_label
from app.agents.prompts import DISCLAIMER
from app.agents.schemas import INTAKE_SLOTS, SLOT_LABELS, RouteDecision
from app.rag import citations_from, format_hits, search
from app.safety.rules import SafetyAssessment, assess, merge

log = logging.getLogger("mediflow.pipeline")

Event = tuple[str, dict]

AGENT_LABELS = {
    "supervisor": "调度与分诊",
    "triage": "结构化问诊",
    "clinician": "全科顾问",
    "report": "报告解读",
    "safety": "安全审查",
    "intake": "病史抽取",
}

SYMPTOM_RE = re.compile(
    r"疼|痛|晕|发热|发烧|咳|喘|吐|泻|拉肚子|麻|痒|肿|失眠|心慌|胸闷|乏力|出血|疹|"
    r"难受|不舒服|恶心|便秘|月经|过敏|血压|血糖|血脂|尿酸|甲状腺|贫血|结节|囊肿|体重"
)
LAB_RE = re.compile(
    r"\d+(?:\.\d+)?\s*(?:mmol/L|μmol/L|umol/L|g/L|mg/dL|U/L|IU/L|ng/mL|pg/mL|%|×10\^?\d+)",
    re.IGNORECASE,
)
GREETING_RE = re.compile(
    r"^(你好|hi|hello|在吗|你能做什么|介绍一下你自己|谢谢|好的)[!！。？? ]*$", re.IGNORECASE
)
# A direct question deserves an answer, not another question — even if history is thin.
QUESTION_RE = re.compile(
    r"吗|是不是|需不需要|要不要|能不能|可不可以|怎么|如何|什么|多少|该不该|需要做|"
    r"严重|要紧|正常吗|行不行|要注意"
)


@dataclass
class TurnContext:
    user_text: str
    profile: dict = field(default_factory=dict)
    intake: dict = field(default_factory=dict)
    history: list[dict] = field(default_factory=list)
    memories: list[str] = field(default_factory=list)
    summary: str | None = None
    session_id: str = ""
    trace_id: str = ""
    # Set only by the eval harness: it needs a one-shot "advise" turn to compare answer
    # quality against a single-agent baseline without the triage stage in the way.
    force_route: str | None = None


@dataclass
class TurnResult:
    text: str = ""
    agent: str = "clinician"
    citations: list[dict] = field(default_factory=list)
    intake: dict = field(default_factory=dict)
    safety: dict = field(default_factory=dict)
    agents: list[str] = field(default_factory=list)
    route: dict = field(default_factory=dict)
    input_tokens: int = 0
    output_tokens: int = 0
    model: str = ""
    grounded: bool = True


# --------------------------------------------------------------------------- helpers
def completeness(intake: dict) -> float:
    filled = [slot for slot in SLOT_LABELS if intake.get(slot)]
    return round(len(filled) / len(SLOT_LABELS), 3)


def missing_slots(intake: dict) -> list[str]:
    return [slot for slot in SLOT_LABELS if not intake.get(slot)]


def intake_snapshot(intake: dict) -> dict:
    severity = intake.get("severity")
    return {
        "chief_complaint": intake.get("chief_complaint"),
        "onset": intake.get("onset"),
        "duration": intake.get("duration"),
        "severity": int(severity) if str(severity).isdigit() else None,
        "location": intake.get("location"),
        "associated": _as_list(intake.get("associated")),
        "history": _as_list(intake.get("history")),
        "medications": _as_list(intake.get("medications")),
        "allergies": _as_list(intake.get("allergies")),
        "completeness": completeness(intake),
        "missing": missing_slots(intake),
    }


def _as_list(value: object) -> list[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(item) for item in value]
    return [part.strip() for part in re.split(r"[、,，;；]", str(value)) if part.strip()]


def _transcript(history: list[dict], limit: int = 8) -> str:
    rows = []
    for message in history[-limit:]:
        speaker = "用户" if message.get("role") == "user" else "MediFlow"
        rows.append(f"{speaker}：{message.get('content', '')[:280]}")
    return "\n".join(rows) if rows else "（无）"


def _profile_block(profile: dict) -> str:
    if not profile:
        return "（未填写）"
    bits = []
    if profile.get("age"):
        bits.append(f"{profile['age']} 岁")
    if profile.get("sex"):
        bits.append({"female": "女性", "male": "男性", "other": "其他"}.get(profile["sex"], profile["sex"]))
    if profile.get("allergies"):
        bits.append("过敏：" + "、".join(profile["allergies"]))
    if profile.get("conditions"):
        bits.append("既往：" + "、".join(profile["conditions"]))
    if profile.get("medications"):
        bits.append("在用药物：" + "、".join(profile["medications"]))
    if profile.get("summary"):
        bits.append(profile["summary"])
    return "；".join(bits) or "（未填写）"


def _intake_block(intake: dict) -> str:
    if not intake:
        return "（暂未收集）"
    rows = [f"{SLOT_LABELS[slot]}：{intake[slot]}" for slot in SLOT_LABELS if intake.get(slot)]
    rows.append(f"完整度：{int(completeness(intake) * 100)}%")
    missing = missing_slots(intake)
    if missing:
        rows.append("缺失：" + "、".join(SLOT_LABELS[slot] for slot in missing))
    return "；".join(rows)


def _context_block(ctx: TurnContext) -> str:
    parts = [
        f"【患者档案】{_profile_block(ctx.profile)}",
        f"【问诊记录】{_intake_block(ctx.intake)}",
    ]
    if ctx.memories:
        parts.append("【长期记忆】" + "；".join(ctx.memories[:6]))
    if ctx.summary:
        parts.append(f"【对话摘要】{ctx.summary}")
    parts.append("【最近对话】\n" + _transcript(ctx.history))
    parts.append(f"【本轮用户输入】{ctx.user_text}")
    return "\n".join(parts)


# ------------------------------------------------------------------------- emergency
_EMERGENCY_PLAYBOOK = {
    "stroke_fast": "记住发病时间（最后一次正常的时间点），这决定能不能溶栓；不要喂水喂药；让患者侧卧，保持气道通畅。",
    "chest_pain_acs": "立即停止一切活动，保持坐位或半卧位，解开衣领；不要自行驾车去医院。",
    "anaphylaxis": "如果手边有肾上腺素自动注射器，按说明立即使用；让患者平卧、抬高下肢。",
    "gi_bleeding": "暂时禁食禁水，记录呕血/黑便的量和颜色，便于急诊判断。",
    "self_harm": "请立刻联系身边信任的人陪着你，并拨打 12356 心理援助热线或 120。",
    "seizure": "让患者侧卧、移开周围硬物，不要往嘴里塞东西；记录抽搐持续时间。",
    "dyspnea": "保持坐位、解开衣领，不要平躺；如果有家用制氧机可以吸氧。",
}


def emergency_answer(safety: SafetyAssessment) -> str:
    primary = safety.flags[0] if safety.flags else None
    playbook = _EMERGENCY_PLAYBOOK.get(primary["code"] if primary else "", "")
    reason = primary["rationale"] if primary else "你描述的情况需要现场评估。"
    return (
        "⚠️ 需要立即就医\n\n"
        f"{safety.action}\n\n"
        f"为什么：{reason}\n\n"
        f"现在可以做：{playbook} 让身边的人帮你拨打 120，并说明主要症状和开始时间。\n\n"
        "去急诊时带上：身份证/医保卡、正在服用的药物清单、既往病历；如果记得，把症状开始的确切时间告诉医生。\n\n"
        f"（{DISCLAIMER}）"
    )


# ------------------------------------------------------------------------ fast route
def fast_route(ctx: TurnContext) -> RouteDecision | None:
    text = ctx.user_text.strip()
    if GREETING_RE.match(text):
        return RouteDecision(action="small_talk", focus="寒暄", reason="寒暄或产品问题", confidence=0.95)
    if LAB_RE.search(text) and ctx.intake.get("chief_complaint"):
        return RouteDecision(action="advise", focus="解读指标", reason="用户粘贴了化验数值", confidence=0.9)
    if not ctx.intake.get("chief_complaint") and SYMPTOM_RE.search(text) and len(text) <= 160:
        if not QUESTION_RE.search(text):
            return RouteDecision(
                action="ask_more", focus="补充主诉细节", reason="首轮症状描述，信息不足", confidence=0.9
            )
    if QUESTION_RE.search(text):
        return RouteDecision(
            action="advise", focus="回答用户的问题", reason="用户在直接提问，应当先给答案", confidence=0.75
        )
    return None


def retrieval_query(ctx: TurnContext) -> str:
    parts = [ctx.user_text]
    for slot in ("chief_complaint", "associated", "location"):
        value = ctx.intake.get(slot)
        if value:
            parts.append(str(value)[:40])
    return " ".join(parts)[:240]


# ---------------------------------------------------------------------------- stream
async def _stream_agent(
    agent,
    prompt: str,
    result: TurnResult,
    *,
    agent_id: str,
) -> AsyncIterator[Event]:
    from pydantic_ai.messages import PartDeltaEvent, PartStartEvent, TextPart, TextPartDelta

    guard = SentenceGuard()
    started = time.perf_counter()
    yield ("agent", {"agent": agent_id, "status": "started", "label": AGENT_LABELS[agent_id]})

    usage = None
    try:
        async with agent.run_stream_events(prompt) as stream:
            async for event in stream:
                # The first chunk of a part arrives in PartStartEvent, not as a delta.
                if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
                    safe = guard.feed(event.part.content)
                    if safe:
                        result.text += safe
                        yield ("token", {"text": safe})
                # Thinking deltas carry `content_delta` too; only text is user-facing.
                elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                    text = event.delta.content_delta
                    if not text:
                        continue
                    safe = guard.feed(text)
                    if safe:
                        result.text += safe
                        yield ("token", {"text": safe})
            usage = getattr(stream, "usage", None)
    finally:
        tail = guard.flush()
        if tail:
            result.text += tail
            yield ("token", {"text": tail})

    elapsed = int((time.perf_counter() - started) * 1000)
    if usage is not None:
        result.input_tokens += int(
            getattr(usage, "request_tokens", None) or getattr(usage, "input_tokens", 0) or 0
        )
        result.output_tokens += int(
            getattr(usage, "response_tokens", None) or getattr(usage, "output_tokens", 0) or 0
        )
    yield (
        "agent",
        {"agent": agent_id, "status": "finished", "label": AGENT_LABELS[agent_id], "ms": elapsed},
    )


_citation_token = re.compile(r"\[([a-z0-9\-]+#\d+)\]")
_number_token = re.compile(r"\[(\d{1,2})\]")


def strip_unknown_citations(text: str, valid_ids: set[str]) -> str:
    return _citation_token.sub(lambda m: m.group(0) if m.group(1) in valid_ids else "", text)


def clamp_citation_numbers(text: str, count: int) -> str:
    """Drop `[7]` when only 4 chunks were retrieved."""
    return _number_token.sub(
        lambda m: m.group(0) if 1 <= int(m.group(1)) <= count else "", text
    )


# ------------------------------------------------------------------------------ turn
async def stream_turn(ctx: TurnContext, result: TurnResult) -> AsyncIterator[Event]:
    # 1 — deterministic safety screen ------------------------------------------------
    safety = assess(ctx.user_text)
    if safety.level != "routine":
        yield ("safety", safety.as_dict())

    if safety.urgent:
        result.agent = "safety"
        result.agents = ["safety"]
        result.safety = safety.as_dict()
        result.route = {"action": "emergency", "reason": "红旗症状规则命中", "source": "rules"}
        yield ("agent", {"agent": "safety", "status": "started", "label": AGENT_LABELS["safety"]})
        for chunk in _chunk(emergency_answer(safety)):
            await asyncio.sleep(0)
            result.text += chunk
            yield ("token", {"text": chunk})
        yield ("agent", {"agent": "safety", "status": "finished", "label": AGENT_LABELS["safety"]})
        yield ("intake", intake_snapshot(ctx.intake))
        return

    # 2 — routing --------------------------------------------------------------------
    decision = fast_route(ctx)
    source = "fast_path"
    if ctx.force_route:
        decision = RouteDecision(
            action=ctx.force_route,  # type: ignore[arg-type]
            focus="评测强制路径",
            reason="evaluation harness forced this route",
            confidence=1.0,
        )
        source = "forced"
    yield ("agent", {"agent": "supervisor", "status": "started", "label": AGENT_LABELS["supervisor"]})
    if decision is None:
        decision, source, route_ms = await _supervised_route(ctx, result)
        detail = decision.reason
    else:
        route_ms, detail = 0, f"规则快路径：{decision.reason}"
    yield (
        "agent",
        {
            "agent": "supervisor",
            "status": "finished",
            "label": AGENT_LABELS["supervisor"],
            "ms": route_ms,
            "detail": detail,
        },
    )
    result.route = {
        "action": decision.action,
        "reason": decision.reason,
        "focus": decision.focus,
        "confidence": decision.confidence,
        "source": source,
    }
    result.agents = ["safety", "supervisor"]
    result.intake = dict(ctx.intake)

    # intake extraction runs while the reply streams; it never blocks first token
    extract_task: asyncio.Task | None = None
    if decision.action != "small_talk":
        extract_task = asyncio.create_task(_extract_intake(ctx))

    # 3 — dispatch -------------------------------------------------------------------
    if decision.action == "ask_more":
        result.agent = "triage"
        result.agents.append("triage")
        prompt = (
            _context_block(ctx)
            + "\n\n【本轮任务】只问一个最关键的缺口问题，并说明为什么问。不要给建议，不要复述已知信息。"
        )
        async for event in _stream_agent(triage_agent(), prompt, result, agent_id="triage"):
            yield event

    elif decision.action == "advise":
        result.agent = "clinician"
        result.agents.append("clinician")
        query = retrieval_query(ctx)
        yield ("tool", {"name": "search_guidelines", "args": query[:40], "status": "started", "preview": ""})
        hits = search(query, k=4)
        citations = citations_from(hits)
        yield (
            "tool",
            {
                "name": "search_guidelines",
                "args": "",
                "status": "finished",
                "preview": f"命中 {len(citations)} 条" if citations else "未命中，本轮不引用",
            },
        )
        for citation in citations:
            yield ("citation", citation)

        prompt = (
            _context_block(ctx)
            + "\n\n【指南检索结果】\n"
            + format_hits(hits)
            + "\n\n【本轮任务】按固定结构给出分诊建议与健康指导；每条医学结论标注来源 id。"
        )
        async for event in _stream_agent(clinician_agent(), prompt, result, agent_id="clinician"):
            yield event

        valid_ids = {citation["id"] for citation in citations}
        cleaned = strip_unknown_citations(result.text, valid_ids)
        cleaned = clamp_citation_numbers(cleaned, len(citations))
        if cleaned != result.text:
            result.text = cleaned
        result.citations = citations
        result.grounded = bool(citations)
        if not citations:
            yield (
                "safety",
                {
                    "level": "attention",
                    "flags": [
                        {
                            "code": "ungrounded_answer",
                            "label": "本轮没有命中本地指南",
                            "rationale": "结论来自通用医学常识，仅供参考，建议以面诊为准。",
                            "level": "attention",
                        }
                    ],
                    "action": None,
                },
            )

    else:  # small_talk
        result.agent = "supervisor"
        result.agents.append("supervisor")
        prompt = f"用户说：{ctx.user_text}\n请简短回应。"
        async for event in _stream_agent(smalltalk_agent(), prompt, result, agent_id="supervisor"):
            yield event

    # 4 — post-processing ------------------------------------------------------------
    if extract_task is not None:
        patch = await _await_extraction(extract_task)
        if patch:
            for slot, value in patch.items():
                if slot in INTAKE_SLOTS and value and not result.intake.get(slot):
                    result.intake[slot] = value

    merged = merge(safety, _max_flag_level([]), [])
    if merged.level != safety.level:
        yield ("safety", merged.as_dict())

    if not result.text.strip():
        result.text = "抱歉，这一轮没能生成有效回复。你可以换个说法再描述一次，或直接告诉我最困扰你的症状。"

    result.safety = merged.as_dict()
    result.model = model_label("supervisor" if result.agent == "supervisor" else "worker")
    yield ("intake", intake_snapshot(result.intake))


async def _extract_intake(ctx: TurnContext) -> dict[str, str]:
    try:
        prompt = (
            f"【已有槽位】{_intake_block(ctx.intake)}\n"
            f"【本轮用户输入】{ctx.user_text}\n\n只抽取本轮输入里的信息。"
        )
        run = await intake_agent().run(prompt)
        data = run.output
        patch: dict[str, str] = {}
        for slot, value in (data.captured or {}).items():
            slot = slot.strip()
            if slot in INTAKE_SLOTS and value:
                patch[slot] = str(value).strip()[:30]
        return patch
    except Exception as exc:  # noqa: BLE001 - extraction is best effort
        log.warning("intake extraction failed: %s", exc)
        return {}


async def _await_extraction(task: asyncio.Task) -> dict[str, str]:
    try:
        return await asyncio.wait_for(task, timeout=20)
    except Exception:  # noqa: BLE001 - timeout or failure, the reply already shipped
        task.cancel()
        return {}


def _max_flag_level(flags: list[dict]) -> str | None:
    order = {"attention": 1, "urgent": 2}
    best = None
    for flag in flags:
        if flag.get("level") in order and (best is None or order[flag["level"]] > order[best]):
            best = flag["level"]
    return best


def _chunk(text: str, size: int = 18) -> list[str]:
    return [text[i : i + size] for i in range(0, len(text), size)]


async def _supervised_route(ctx: TurnContext, result: TurnResult) -> tuple[RouteDecision, str, int]:
    """Ask the fast model where this turn goes; fall back to rules if it is unavailable."""
    started = time.perf_counter()
    prompt = (
        _context_block(ctx)
        + f"\n\n【缺失槽位】{'、'.join(SLOT_LABELS[s] for s in missing_slots(ctx.intake)) or '无'}"
        + "\n\n请判断这一轮应该由谁处理。"
    )
    try:
        run = await supervisor_agent().run(prompt)
        decision = run.output
        usage = run.usage
        result.input_tokens += int(getattr(usage, "request_tokens", 0) or 0)
        result.output_tokens += int(getattr(usage, "response_tokens", 0) or 0)
        source = "supervisor"
    except Exception as exc:  # noqa: BLE001 - the fallback is the point
        log.warning("supervisor failed, using heuristic: %s", exc)
        decision = RouteDecision(
            action="ask_more" if completeness(ctx.intake) < 0.5 else "advise",
            focus="补充信息" if completeness(ctx.intake) < 0.5 else "给出建议",
            reason="调度模型不可用，按信息完整度兜底",
            confidence=0.5,
        )
        source = "fallback"
    return decision, source, int((time.perf_counter() - started) * 1000)
