"""Lab report upload, parsing and retrieval."""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user
from app.api.errors import ApiError, not_found
from app.config import settings
from app.db.models import Report, User
from app.db.session import SessionFactory, get_db
from app.schemas import ReportInsight, ReportListItem
from app.services import reports as report_service

log = logging.getLogger("mediflow.api.reports")
router = APIRouter(tags=["reports"])


def _insight_payload(report: Report) -> ReportInsight:
    data = report.insight or {}
    return ReportInsight(
        id=report.id,
        filename=report.filename,
        created_at=report.created_at,
        status=data.get("status", report.status),  # type: ignore[arg-type]
        patient_hint=data.get("patient_hint"),
        summary=data.get("summary", ""),
        markers=data.get("markers", []),
        questions_for_doctor=data.get("questions_for_doctor", []),
        citations=data.get("citations", []) or report.citations,
        disclaimer=data.get("disclaimer", ""),
    )


async def _process(report_id: str, filename: str, text: str) -> None:
    try:
        insight = await report_service.interpret(filename, text)
    except Exception as exc:  # noqa: BLE001
        log.exception("report interpretation failed")
        insight = {
            "status": "failed",
            "summary": f"解读失败：{exc}",
            "markers": [],
            "questions_for_doctor": [],
            "citations": [],
            "disclaimer": "",
        }
    async with SessionFactory() as db:
        report = await db.get(Report, report_id)
        if report is None:
            return
        report.insight = insight
        report.citations = insight.get("citations", [])
        report.status = insight.get("status", "ready")
        await db.commit()


@router.post("/reports", status_code=202)
async def upload_report(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise ApiError("file_too_large", f"文件不能超过 {settings.max_upload_mb} MB", 413)
    filename = file.filename or "report"
    text, error = report_service.extract_text(filename, content)

    report = Report(user_id=user.id, filename=filename, status="parsing", raw_text=text[:20000])
    db.add(report)
    await db.commit()
    await db.refresh(report)

    if error:
        report.status = "failed"
        report.insight = {
            "status": "failed",
            "summary": error,
            "markers": [],
            "questions_for_doctor": [],
            "citations": [],
            "disclaimer": "",
        }
        await db.commit()
    elif text.strip():
        asyncio.create_task(_process(report.id, filename, text))
    else:
        report.status = "failed"
        report.insight = {
            "status": "failed",
            "summary": "这份文件没有可提取的文字，可能是扫描件。可以试试上传文字版 PDF。",
            "markers": [],
            "questions_for_doctor": [],
            "citations": [],
            "disclaimer": "",
        }
        await db.commit()
    return {"report_id": report.id, "status": report.status}


@router.post("/reports/text", status_code=202)
async def paste_report(
    payload: dict,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    text = str(payload.get("text", "")).strip()
    if len(text) < 10:
        raise ApiError("bad_request", "请至少粘贴一行检验结果", 400)
    report = Report(
        user_id=user.id,
        filename=str(payload.get("filename") or "粘贴的检验结果.txt"),
        status="parsing",
        raw_text=text[:20000],
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    asyncio.create_task(_process(report.id, report.filename, text))
    return {"report_id": report.id, "status": "parsing"}


@router.get("/reports", response_model=dict)
async def list_reports(
    user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> dict:
    rows = (
        await db.scalars(
            select(Report).where(Report.user_id == user.id).order_by(Report.created_at.desc()).limit(20)
        )
    ).all()
    items = [
        ReportListItem(
            id=row.id,
            filename=row.filename,
            created_at=row.created_at,
            status=row.status,
            marker_count=len((row.insight or {}).get("markers", [])),
            summary=(row.insight or {}).get("summary", "")[:120],
        ).model_dump()
        for row in rows
    ]
    return {"reports": items}


@router.get("/reports/{report_id}", response_model=ReportInsight)
async def get_report(
    report_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
) -> ReportInsight:
    report = await db.get(Report, report_id)
    if report is None or report.user_id != user.id:
        raise not_found("报告")
    return _insight_payload(report)
