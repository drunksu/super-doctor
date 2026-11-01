"""Meta endpoints: agent catalog, analytics, health."""

from __future__ import annotations

import datetime as dt

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.config import settings
from app.db.models import ChatSession, IntakeForm, Message, Run, User
from app.db.session import get_db
from app.schemas import AgentCard, DailyPoint, HealthOut, InsightsOut, RouteCount

router = APIRouter(tags=["meta"])

AGENTS: list[AgentCard] = [
    AgentCard(
        id="supervisor",
        name="调度器",
        role="路由与衔接",
        color="#0e7490",
        description="用快模型判断这一轮该追问、该建议，还是该寒暄；多数轮次走规则快路径。",
    ),
    AgentCard(
        id="triage",
        name="结构化问诊",
        role="补齐病史",
        color="#7c3aed",
        description="一次只问一个问题，把主诉、起病、部位、伴随症状、既往史补成结构化槽位。",
    ),
    AgentCard(
        id="clinician",
        name="全科顾问",
        role="分诊建议",
        color="#0f766e",
        description="先检索本地指南库再回答，给出可能方向、现在就做的事、必须就医的指征。",
    ),
    AgentCard(
        id="report",
        name="报告解读",
        role="化验解释",
        color="#b45309",
        description="逐项解释检验指标，标注偏离程度，生成可以问医生的问题清单。",
    ),
    AgentCard(
        id="safety",
        name="安全审查",
        role="红旗分诊与输出护栏",
        color="#b91c1c",
        description="确定性规则先筛红旗症状；输出侧做句级护栏，阻断处方与确诊式表达。",
    ),
]


@router.get("/meta/agents")
async def meta_agents() -> dict:
    return {
        "agents": [agent.model_dump() for agent in AGENTS],
        "disclaimer": "MediFlow 提供健康信息与就医建议，不做诊断、不开处方；如有紧急症状请立即就医。",
        "models": {"supervisor": settings.model_supervisor, "worker": settings.model_worker},
        "mode": settings.model_mode_resolved,
    }


@router.get("/insights/summary", response_model=InsightsOut)
async def insights(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> InsightsOut:
    runs = (await db.scalars(select(Run).where(Run.user_id == user.id).order_by(Run.created_at))).all()
    sessions = await db.scalar(select(func.count()).select_from(ChatSession).where(ChatSession.user_id == user.id))
    messages = await db.scalar(
        select(func.count())
        .select_from(Message)
        .join(ChatSession, ChatSession.id == Message.session_id)
        .where(ChatSession.user_id == user.id)
    )

    latencies = sorted(run.latency_ms for run in runs if run.latency_ms)
    avg_latency = int(sum(latencies) / len(latencies)) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95) - 1] if latencies else 0

    route_counter: dict[str, int] = {}
    safety_counter = {"routine": 0, "attention": 0, "urgent": 0}
    daily_counter: dict[str, int] = {}
    for run in runs:
        for agent in run.agents or []:
            route_counter[agent] = route_counter.get(agent, 0) + 1
        if run.safety_level in safety_counter:
            safety_counter[run.safety_level] += 1
        day = run.created_at.date().isoformat()
        daily_counter[day] = daily_counter.get(day, 0) + 1

    today = dt.date.today()
    daily = [
        DailyPoint(date=(today - dt.timedelta(days=offset)).isoformat(),
                   runs=daily_counter.get((today - dt.timedelta(days=offset)).isoformat(), 0))
        for offset in range(6, -1, -1)
    ]

    forms = (
        await db.scalars(
            select(IntakeForm).join(ChatSession, ChatSession.id == IntakeForm.session_id).where(
                ChatSession.user_id == user.id
            )
        )
    ).all()
    intake_completion = round(sum(form.completeness for form in forms) / len(forms), 3) if forms else 0.0

    return InsightsOut(
        runs=len(runs),
        sessions=int(sessions or 0),
        messages=int(messages or 0),
        avg_latency_ms=avg_latency,
        p95_latency_ms=p95,
        tokens={
            "input": sum(run.input_tokens for run in runs),
            "output": sum(run.output_tokens for run in runs),
        },
        routes=[RouteCount(agent=agent, count=count) for agent, count in sorted(
            route_counter.items(), key=lambda item: item[1], reverse=True
        )],
        safety=safety_counter,
        daily=daily,
        intake_completion=intake_completion,
    )


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status="ok", model_mode=settings.model_mode_resolved, version=settings.version)
