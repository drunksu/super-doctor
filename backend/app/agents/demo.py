"""Offline demo pipeline.

Runs when no model key is configured (or `MODEL_MODE=mock`). It replays the same event
protocol with scripted, clinically conservative Chinese text so the product can be
demoed, screenshotted and tested without an API key. It is deliberately *not* a fake
model: it produces fixed content, and `/health` reports `model_mode: mock` so nobody can
mistake a scripted demo for a model run.
"""

from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator

from app.agents.pipeline import (
    AGENT_LABELS,
    Event,
    TurnContext,
    TurnResult,
    _chunk,
    completeness,
    emergency_answer,
    intake_snapshot,
    missing_slots,
    strip_unknown_citations,
)
from app.agents.prompts import DISCLAIMER
from app.rag import citations_from, search
from app.safety.rules import assess

GREETING = re.compile(r"^(你好|hi|hello|在吗|你能做什么|介绍一下你自己|谢谢|好的)[!！。？? ]*$", re.IGNORECASE)
LAB = re.compile(r"(mmol/L|μmol/L|g/L|mg/dL|U/L|报告|化验|体检|指标)", re.IGNORECASE)

TRIAGE_TEXT = (
    "先确认一个关键点：你头晕的时候，是感觉天旋地转（像坐船、周围在转），"
    "还是头重脚轻、站起来眼前发黑？\n\n这两种方向差别很大：前者更偏向耳朵里的平衡系统，"
    "后者更常和血压、血容量有关。你更接近哪一种？"
)

GENERIC_ADVICE = (
    "从你描述的情况看，更像是良性的、和体位或疲劳相关的变化，但还需要排除血压和贫血方面的问题。\n\n"
    "可能的方向：\n"
    "- 体位性低血压：起身时眼前发黑、几秒钟缓解，和起身过快、饮水少有关。\n"
    "- 睡眠不足或焦虑：头晕伴随注意力不集中、心慌。\n"
    "- 贫血：伴随乏力、面色偏白、活动后气短。\n\n"
    "现在可以做：起床时先在床边坐 1 分钟；每天分次喝水 1500–2000 毫升；记录发作的时间点和持续多久。\n\n"
    "什么情况必须就医：出现晕倒、说话不清、一侧肢体无力、胸痛，或头晕持续加重影响走路，请尽快就诊。"
    "如果只是反复发作但每次几秒钟，建议挂全科或神经内科，带上这份记录。\n\n"
    f"（{DISCLAIMER}）"
)

LAB_ADVICE = (
    "这份结果里最需要关注的是低密度脂蛋白（LDL-C），它和动脉粥样硬化的关系最直接；"
    "甘油三酯和总胆固醇也偏高，通常一起看。\n\n"
    "- LDL-C 偏高：它是“坏胆固醇”，越高、暴露时间越长，血管风险越大。\n"
    "- 甘油三酯偏高：常和精制碳水、酒精、体重增加有关，复查前需要空腹 10 小时以上。\n"
    "- 总胆固醇偏高：需要结合 LDL-C 和高密度脂蛋白一起判断，单看总值意义有限。\n\n"
    "现在可以做：减少含糖饮料和酒精，每周至少 150 分钟中等强度运动，主食里加一部分粗粮；3 个月后复查血脂。\n\n"
    "什么情况必须就医：如果同时有糖尿病、高血压、吸烟，或直系亲属在 55 岁前得过心梗/脑梗，"
    "建议尽快面诊评估是否需要药物；如果出现胸痛、活动后气短，请立即就医。\n\n"
    f"（{DISCLAIMER}）"
)

SMALLTALK = (
    "我是 MediFlow，可以帮你把症状理清楚、判断该不该去医院、解读体检指标。"
    "你可以直接说哪里不舒服、多久了，我们从最困扰你的那一件事开始。"
)


def _pick(scenario: str, query: str, count: int = 2) -> list[dict]:
    hits = search(query, k=count)
    return citations_from(hits)


async def stream_demo(ctx: TurnContext, result: TurnResult) -> AsyncIterator[Event]:
    safety = assess(ctx.user_text)
    if safety.level != "routine":
        yield ("safety", safety.as_dict())
    if safety.urgent:
        result.agent = "safety"
        result.agents = ["safety"]
        result.route = {"action": "emergency", "reason": "红旗症状规则命中", "source": "rules"}
        result.safety = safety.as_dict()
        yield ("agent", {"agent": "safety", "status": "started", "label": AGENT_LABELS["safety"]})
        answer = emergency_answer(safety)
        for chunk in _chunk(answer):
            await asyncio.sleep(0.01)
            result.text += chunk
            yield ("token", {"text": chunk})
        yield ("agent", {"agent": "safety", "status": "finished", "label": AGENT_LABELS["safety"]})
        result.safety = safety.as_dict()
        yield ("intake", intake_snapshot(ctx.intake))
        return

    text = ctx.user_text.strip()
    yield ("agent", {"agent": "supervisor", "status": "started", "label": AGENT_LABELS["supervisor"]})
    await asyncio.sleep(0.15)

    if GREETING.match(text):
        agent, body, action = "supervisor", SMALLTALK, "small_talk"
        citations: list[dict] = []
        yield ("agent", {"agent": "supervisor", "status": "finished", "label": AGENT_LABELS["supervisor"], "ms": 120})
    elif LAB.search(text):
        agent, body, action = "clinician", LAB_ADVICE, "advise"
        citations = _pick("lab", "低密度脂蛋白 血脂 参考范围")
        yield ("agent", {"agent": "supervisor", "status": "finished", "label": AGENT_LABELS["supervisor"], "ms": 260, "detail": "用户粘贴了化验数值"})
    elif not ctx.intake.get("chief_complaint"):
        agent, body, action = "triage", TRIAGE_TEXT, "ask_more"
        citations = _pick("dizziness", "头晕 体位性低血压 危险信号", 1)
        ctx.intake.update({"chief_complaint": text[:24], "onset": "未确认", "duration": "未确认"})
        yield ("agent", {"agent": "supervisor", "status": "finished", "label": AGENT_LABELS["supervisor"], "ms": 180, "detail": "首轮症状描述，信息不足"})
    else:
        agent, body, action = "clinician", GENERIC_ADVICE, "advise"
        citations = _pick("consult", "头晕 贫血 体位性低血压")
        yield ("agent", {"agent": "supervisor", "status": "finished", "label": AGENT_LABELS["supervisor"], "ms": 210, "detail": "信息已足够"})

    result.agent = agent
    result.agents = ["safety", "supervisor", agent]
    result.route = {"action": action, "reason": "演示模式固定路由", "source": "demo"}
    result.model = "mock"
    result.safety = safety.as_dict()

    yield ("agent", {"agent": agent, "status": "started", "label": AGENT_LABELS[agent]})
    if agent == "clinician":
        yield ("tool", {"name": "search_guidelines", "args": "相关指南", "status": "started", "preview": ""})
        await asyncio.sleep(0.25)
        yield (
            "tool",
            {
                "name": "search_guidelines",
                "args": "",
                "status": "finished",
                "preview": f"命中 {len(citations)} 条",
            },
        )

    valid_ids = {citation["id"] for citation in citations}
    for name, value in _intake_updates(text, ctx.intake):
        ctx.intake[name] = value
    for chunk in _chunk(body):
        await asyncio.sleep(0.012)
        result.text += chunk
        yield ("token", {"text": chunk})
    await asyncio.sleep(0.1)
    yield ("agent", {"agent": agent, "status": "finished", "label": AGENT_LABELS[agent], "ms": 900})

    if citations:
        result.text = strip_unknown_citations(result.text, valid_ids)
        for citation in citations:
            yield ("citation", citation)
    result.citations = citations
    result.intake = ctx.intake
    yield ("intake", intake_snapshot(ctx.intake))


def _intake_updates(text: str, intake: dict) -> list[tuple[str, str]]:
    updates: list[tuple[str, str]] = []
    if not intake.get("chief_complaint"):
        updates.append(("chief_complaint", text[:24]))
    if re.search(r"天|周|个月|年", text) and not intake.get("duration"):
        updates.append(("duration", "约 " + re.search(r"\d*\s*[天周月年]", text).group(0)))  # type: ignore[union-attr]
    if not intake.get("severity") and re.search(r"[1-9]\s*分|十级|很疼|剧烈", text):
        updates.append(("severity", "6"))
    return updates


def demo_completeness(ctx: TurnContext) -> float:
    return completeness({**ctx.intake, **{"chief_complaint": ctx.intake.get("chief_complaint") or ""}})


def demo_missing(ctx: TurnContext) -> list[str]:
    return missing_slots(ctx.intake)
