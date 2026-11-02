"""Lab report parsing and interpretation.

Parsing is deterministic (a marker dictionary + line scan), because a lab report is a
table, not prose — a model that "reads" it is slower, more expensive and less reliable than
a dictionary plus a number. The model is only used for the part that actually needs
language: explaining what the numbers mean and what to ask the doctor.
"""

from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass

from app.agents.prompts import DISCLAIMER
from app.config import settings
from app.rag import citations_from, search

log = logging.getLogger("super-doctor.reports")


@dataclass(frozen=True)
class MarkerSpec:
    key: str
    name: str
    aliases: tuple[str, ...]
    unit: str
    low: float | None
    high: float | None
    critical_low: float | None = None
    critical_high: float | None = None
    note: str = ""
    topic: str = ""

    def status(self, value: float) -> str:
        if self.critical_low is not None and value <= self.critical_low:
            return "critical"
        if self.critical_high is not None and value >= self.critical_high:
            return "critical"
        if self.low is not None and value < self.low:
            return "low"
        if self.high is not None and value > self.high:
            return "high"
        return "normal"


SPECS: tuple[MarkerSpec, ...] = (
    MarkerSpec("wbc", "白细胞计数", ("白细胞", "WBC"), "×10⁹/L", 3.5, 9.5, 1.0, 30.0,
               "反映感染、炎症或血液系统状态", "血常规 白细胞"),
    MarkerSpec("hgb", "血红蛋白", ("血红蛋白", "HGB", "Hb"), "g/L", 115, 175, 70, None,
               "判断是否贫血；不同性别参考区间不同", "贫血 血红蛋白"),
    MarkerSpec("plt", "血小板计数", ("血小板", "PLT"), "×10⁹/L", 125, 350, 20, 1000,
               "参与凝血，过低有出血风险", "血小板 出血"),
    MarkerSpec("neut", "中性粒细胞百分比", ("中性粒细胞", "NEUT"), "%", 40, 75, None, None,
               "细菌感染时常见升高", "白细胞 感染"),
    MarkerSpec("glu", "空腹血糖", ("空腹血糖", "血糖", "GLU"), "mmol/L", 3.9, 6.1, 2.8, 13.9,
               "糖尿病筛查与血糖控制的核心指标", "糖尿病 血糖"),
    MarkerSpec("hba1c", "糖化血红蛋白", ("糖化血红蛋白", "HbA1c"), "%", 4.0, 6.0, None, 9.0,
               "反映近 2–3 个月平均血糖", "糖尿病 糖化血红蛋白"),
    MarkerSpec("tc", "总胆固醇", ("总胆固醇", "TC"), "mmol/L", None, 5.2, None, None,
               "血脂的一项，需结合 LDL-C 看", "血脂 总胆固醇"),
    MarkerSpec("tg", "甘油三酯", ("甘油三酯", "TG"), "mmol/L", None, 1.7, None, 5.6,
               "受饮食与饮酒影响大，需空腹复查", "血脂 甘油三酯"),
    MarkerSpec("ldl", "低密度脂蛋白胆固醇", ("低密度脂蛋白", "LDL"), "mmol/L", None, 3.4, None, None,
               "动脉粥样硬化最关键的血脂指标", "低密度脂蛋白 血脂"),
    MarkerSpec("hdl", "高密度脂蛋白胆固醇", ("高密度脂蛋白", "HDL"), "mmol/L", 1.0, None, None, None,
               "俗称“好胆固醇”，偏低是风险因素", "血脂 高密度脂蛋白"),
    MarkerSpec("ua", "血尿酸", ("尿酸", "UA"), "μmol/L", None, 420, None, None,
               "与痛风、代谢综合征相关", "尿酸 痛风"),
    MarkerSpec("cr", "肌酐", ("肌酐", "Cr"), "μmol/L", 44, 106, None, 700,
               "评估肾功能，受肌肉量影响", "肌酐 肾功能"),
    MarkerSpec("alt", "丙氨酸氨基转移酶", ("谷丙转氨酶", "ALT"), "U/L", None, 40, None, 500,
               "肝细胞损伤的敏感指标", "肝功能 转氨酶"),
    MarkerSpec("ast", "天门冬氨酸氨基转移酶", ("谷草转氨酶", "AST"), "U/L", None, 40, None, 500,
               "肝细胞与心肌损伤均可升高", "肝功能 转氨酶"),
    MarkerSpec("tsh", "促甲状腺激素", ("促甲状腺激素", "TSH"), "mIU/L", 0.27, 4.2, None, None,
               "甲状腺功能的一线筛查指标", "甲状腺 促甲状腺激素"),
    MarkerSpec("ft4", "游离甲状腺素", ("游离甲状腺素", "FT4"), "pmol/L", 12.0, 22.0, None, None,
               "配合 TSH 判断甲亢或甲减", "甲状腺 功能"),
    MarkerSpec("tbil", "总胆红素", ("总胆红素", "TBIL"), "μmol/L", None, 21.0, None, 300,
               "升高可见于肝细胞损伤或胆道梗阻", "胆红素 肝功能"),
    MarkerSpec("ldl_ratio", "低密度/高密度比值", ("LDL/HDL", "低密度/高密度"), "", None, 3.5, None, None,
               "粗略反映血脂风险结构", "血脂 风险"),
)

_NUMBER = re.compile(r"-?\d+(?:\.\d+)?")

MOCK_SUMMARY = (
    "这份报告里最值得关注的是血脂相关指标：低密度脂蛋白偏高，通常需要结合年龄、血压、血糖、"
    "吸烟与家族史一起评估心血管风险。其余指标大多在参考区间内，单次轻度异常不等于疾病，"
    "建议 3 个月后空腹复查，并带着这份报告面诊。"
)

MOCK_QUESTIONS = [
    "我的低密度脂蛋白需要用药吗？还是先生活方式干预 3 个月？",
    "我的整体心血管风险属于哪个层级？需要做颈动脉超声吗？",
    "复查血脂前需要空腹多久？大概什么时候复查比较合适？",
    "这些指标和我的家族史有关吗？家人需要一起筛查吗？",
]


def extract_text(filename: str, content: bytes) -> tuple[str, str | None]:
    """Return (text, error). PDFs are parsed locally; images need OCR and are rejected
    with an actionable message instead of silently returning garbage."""
    lowered = filename.lower()
    if lowered.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages), None
        except Exception as exc:  # noqa: BLE001
            log.warning("pdf parse failed: %s", exc)
            return "", "PDF 解析失败，可以试试直接粘贴报告里的数值。"
    if lowered.endswith((".png", ".jpg", ".jpeg", ".webp")):
        return "", "图片报告暂不支持自动识别，请上传 PDF，或把关键数值直接粘贴到对话框。"
    if lowered.endswith((".txt", ".csv")):
        return content.decode("utf-8", errors="ignore"), None
    return "", "暂不支持这种文件格式，请上传 PDF / 图片 / 文本。"


def parse_markers(text: str) -> list[dict]:
    found: dict[str, dict] = {}
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        for spec in SPECS:
            if spec.key in found:
                continue
            if not any(alias.lower() in line.lower() for alias in spec.aliases):
                continue
            numbers = _NUMBER.findall(line.replace(",", ""))
            if not numbers:
                continue
            try:
                value = float(numbers[0])
            except ValueError:
                continue
            status = spec.status(value)
            reference = _reference(spec)
            found[spec.key] = {
                "name": spec.name,
                "value": _fmt(value),
                "unit": spec.unit or None,
                "reference": reference,
                "status": status,
                "note": spec.note,
                "topic": spec.topic,
            }
    return list(found.values())


def _reference(spec: MarkerSpec) -> str:
    if spec.low is not None and spec.high is not None:
        return f"{_fmt(spec.low)}–{_fmt(spec.high)}"
    if spec.high is not None:
        return f"< {_fmt(spec.high)}"
    if spec.low is not None:
        return f"> {_fmt(spec.low)}"
    return "—"


def _fmt(value: float) -> str:
    return f"{value:g}"


def citations_for(markers: list[dict], k: int = 3) -> list[dict]:
    topics = [marker["topic"] for marker in markers if marker.get("topic")] or ["化验 指标 参考范围"]
    hits = search(" ".join(topics[:3]), k=k)
    return citations_from(hits)


async def interpret(filename: str, text: str) -> dict:
    """Build the ReportInsight payload (see docs/api-contract.md)."""
    markers = parse_markers(text)
    citations = citations_for(markers)

    summary = MOCK_SUMMARY
    questions = list(MOCK_QUESTIONS)

    if settings.live_model_enabled and markers:
        try:
            from app.agents.agents import report_agent
            from app.agents.schemas import ReportNarrative

            compact = "\n".join(
                f"{m['name']} {m['value']}{m['unit'] or ''}（参考 {m['reference']}，{m['status']}）"
                for m in markers
            )
            prompt = (
                "【报告内容】\n"
                + compact
                + "\n\n【患者情况】未知，按一般成年人处理。"
                + "\n请给出血清化学报告解读。"
            )
            run = await report_agent().run(prompt)
            narrative: ReportNarrative = run.output
            summary = narrative.summary.strip()
            if narrative.questions_for_doctor:
                questions = narrative.questions_for_doctor[:5]
            if narrative.marker_notes:
                for marker, note in zip(markers, narrative.marker_notes, strict=False):
                    if note:
                        marker["note"] = note
        except Exception as exc:  # noqa: BLE001 - fall back to the deterministic summary
            log.warning("report narrative failed: %s", exc)

    if not markers:
        summary = (
            "没能从这份文件里识别出结构化的检验数值。可以把报告里的项目和数字按"
            "「项目 数值 单位」每行一条贴到对话框，我可以帮你逐项解释。"
        )
        questions = ["这份报告里最需要关注的是哪几项？", "需要复查吗？间隔多久？"]

    return {
        "summary": summary,
        "markers": [
            {key: value for key, value in marker.items() if key != "topic"} for marker in markers
        ],
        "questions_for_doctor": questions,
        "citations": citations,
        "disclaimer": DISCLAIMER,
        "status": "ready" if markers else "failed",
    }


def sample_text() -> str:
    return (
        "项目 结果 单位 参考范围\n"
        "白细胞计数 6.2 ×10⁹/L 3.5-9.5\n"
        "血红蛋白 118 g/L 115-150\n"
        "血小板计数 231 ×10⁹/L 125-350\n"
        "空腹血糖 5.4 mmol/L 3.9-6.1\n"
        "总胆固醇 6.1 mmol/L <5.2\n"
        "甘油三酯 2.8 mmol/L <1.7\n"
        "低密度脂蛋白 4.2 mmol/L <3.4\n"
        "高密度脂蛋白 1.1 mmol/L >1.0\n"
        "尿酸 356 μmol/L <420\n"
        "谷丙转氨酶 28 U/L <40\n"
        "肌酐 62 μmol/L 44-106\n"
    )


def build_sample_insight() -> dict:
    """Deterministic insight used to seed the demo account (no model call)."""
    markers = parse_markers(sample_text())
    return {
        "status": "ready",
        "summary": MOCK_SUMMARY,
        "markers": [{key: value for key, value in marker.items() if key != "topic"} for marker in markers],
        "questions_for_doctor": list(MOCK_QUESTIONS),
        "citations": citations_for(markers),
        "disclaimer": DISCLAIMER,
    }
