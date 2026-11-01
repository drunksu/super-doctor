"""Deterministic red-flag screening.

Two layers, matching the product's safety philosophy:

1. **Fast path (this module)** — auditable regex rules over the patient's own words. No
   model call, no latency, no hallucination, and it runs before anything is generated.
2. **Semantic path** — the intake extractor may report a red flag the rules miss, but it
   can only *raise* severity, never lower it.

A negation window ("没有胸痛", "无发热") suppresses a match, which is the usual failure mode
of naive keyword screening. Patterns allow a few characters between the symptom and the
qualifier because patients do not write "胸痛伴大汗" — they write "胸口压着疼，满头大汗".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

Level = Literal["routine", "attention", "urgent"]

NEGATIONS = ("没有", "不", "无", "未", "否认", "没", "从未")
_NEGATION_WINDOW = 6

URGENT_ACTION = "请立即拨打 120 或前往最近医院急诊；如已出现意识不清、呼吸困难，请让身边的人协助呼救。"


@dataclass(frozen=True)
class Rule:
    code: str
    label: str
    pattern: str
    rationale: str
    level: Level = "urgent"


RULES: tuple[Rule, ...] = (
    # --- cardiovascular -----------------------------------------------------
    Rule(
        "chest_pain_acs",
        "胸痛可能提示急性冠脉综合征",
        r"(?:胸|心口|心前区)[^。！？\n]{0,10}(?:疼|痛|闷|压迫|压着|紧)"
        r"[^。！？\n]{0,25}(?:大汗|冷汗|出汗|湿透|放射|左肩|后背|濒死|憋气|呼吸困难|恶心)"
        r"|(?:大汗|冷汗)[^。！？\n]{0,15}(?:胸|心口)[^。！？\n]{0,8}(?:疼|痛|闷)",
        "胸痛伴随大汗、放射痛或呼吸困难是急性心肌梗死的典型组合，必须立即处理。",
    ),
    Rule(
        "chest_pain_duration",
        "持续不缓解的胸痛",
        r"(?:胸|心口)[^。！？\n]{0,10}(?:疼|痛)[^。！？\n]{0,12}"
        r"(?:\d+|十几|二十几|三十几|半小时|一个多小时)\s*(?:分钟|小时)",
        "静息胸痛持续超过 15 分钟不缓解，需要按急性冠脉综合征处理。",
    ),
    Rule(
        "syncope",
        "晕厥或接近晕厥",
        r"晕倒|晕厥|昏倒|失去意识|眼前发黑[^。！？\n]{0,10}(?:倒地|摔倒|坐下才缓)",
        "晕厥可能提示心律失常、体位性低血压或神经系统问题，需要现场评估。",
    ),
    # --- neurological -------------------------------------------------------
    Rule(
        "stroke_fast",
        "卒中样症状（FAST）",
        r"(?:一侧|单侧|半边|左边|右边|左侧|右侧)[^。！？\n]{0,10}"
        r"(?:手脚|胳膊|手臂|腿|肢体|脸|口角)[^。！？\n]{0,10}"
        r"(?:无力|抬不起|不能动|发麻|麻木|不听使唤|歪|斜)"
        r"|(?:说话|言语|讲话|口齿)[^。！？\n]{0,6}(?:不清|含糊|说不清|大舌头)"
        r"|突然[^。！？\n]{0,8}(?:看不清|看不见|视野缺失|视物成双)",
        "面部歪斜、单侧肢体无力、言语不清同时出现时卒中可能性高，溶栓有时间窗。",
    ),
    Rule(
        "thunderclap_headache",
        "突发剧烈头痛",
        r"(?:突然|猛地|瞬间)[^。！？\n]{0,8}(?:剧烈|要命|爆炸样|最严重)[^。！？\n]{0,4}头痛"
        r"|一生中最(?:剧烈|严重)的头痛|雷击样头痛",
        "雷击样头痛需要排除蛛网膜下腔出血。",
    ),
    Rule(
        "seizure",
        "抽搐或意识丧失",
        r"抽搐|惊厥|抽风|口吐白沫|翻白眼[^。！？\n]{0,6}(?:抽|僵|不动)",
        "首次抽搐需要排除癫痫、低血糖、颅内病变与中毒；儿童需考虑热性惊厥。",
    ),
    Rule(
        "head_trauma",
        "头部外伤后意识改变",
        r"(?:摔|撞|磕)[^。！？\n]{0,8}(?:头|后脑)[^。！？\n]{0,12}(?:昏迷|呕吐|意识|记不清|嗜睡)",
        "头部外伤后出现呕吐、意识改变或进行性嗜睡，需要排除颅内出血。",
    ),
    # --- respiratory / allergy ---------------------------------------------
    Rule(
        "anaphylaxis",
        "严重过敏反应",
        r"(?:皮疹|荨麻疹|全身痒)[^。！？\n]{0,20}(?:呼吸困难|喘不上气|喉咙|喉头|嘴唇肿|吞咽困难)"
        r"|(?:呼吸困难|喉咙发紧)[^。！？\n]{0,12}(?:皮疹|过敏)",
        "过敏反应累及气道时可在数分钟内进展为休克，需要肾上腺素与急诊处理。",
    ),
    Rule(
        "dyspnea",
        "静息状态下呼吸困难",
        r"喘不上气|呼吸困难|憋气|呼吸急促|气短[^。！？\n]{0,6}(?:静息|不动|躺着|说不出话)",
        "静息呼吸困难可见于心衰、肺栓塞、哮喘急性发作等，需要尽快评估。",
    ),
    # --- bleeding / GI ------------------------------------------------------
    Rule(
        "gi_bleeding",
        "消化道出血",
        r"呕血|吐血|(?:吐|呕)[^。！？\n]{0,6}血|黑便|柏油样便|大便[^。！？\n]{0,4}(?:发黑|带血)|便血",
        "呕血与黑便提示上消化道出血，可能快速导致失血性休克。",
    ),
    Rule(
        "hemoptysis",
        "咯血",
        r"咯血|咳血|(?:咳|痰)[^。！？\n]{0,6}血",
        "咯血需要区分呼吸道与消化道来源，大量咯血可致窒息。",
    ),
    Rule(
        "acute_abdomen",
        "急腹症表现",
        r"(?:肚子|腹)[^。！？\n]{0,10}(?:疼|痛)[^。！？\n]{0,20}"
        r"(?:直不起腰|剧烈|无法忍受|冒冷汗|打滚|蜷着|一直吐)"
        r"|(?:肚子|腹)[^。！？\n]{0,8}(?:很硬|板状|按不得|一碰就疼)",
        "剧烈腹痛伴腹膜刺激征提示急腹症（阑尾炎、穿孔、胰腺炎等），需要急诊。",
    ),
    # --- mental health ------------------------------------------------------
    Rule(
        "self_harm",
        "自伤/自杀意念",
        r"自杀|不想活|活着没意思|轻生|结束生命|想好怎么(?:死|结束)|今晚就(?:去|准备)",
        "表达自杀意念需要立即获得专业帮助与陪伴，不能只给建议。",
    ),
    # --- pregnancy / pediatric ---------------------------------------------
    Rule(
        "pregnancy_bleeding",
        "妊娠期出血或胎动异常",
        r"(?:怀孕|妊娠|孕期)[^。！？\n]{0,16}(?:出血|见红|腹痛|胎动[^。！？\n]{0,4}(?:减少|消失))",
        "妊娠期出血、腹痛或胎动减少需要产科急诊评估。",
    ),
    Rule(
        "infant_fever",
        "婴幼儿高热",
        r"(?:宝宝|婴儿|孩子|小孩|儿子|女儿)[^。！？\n]{0,10}(?:高烧|发热|发烧)"
        r"[^。！？\n]{0,10}(?:39|40|三个月|3个月|精神差|抽搐)",
        "3 个月以下婴儿发热，或伴精神反应差、抽搐，需要立即就医而非居家观察。",
    ),
    # --- poisoning ----------------------------------------------------------
    Rule(
        "poisoning",
        "误服或过量服药",
        r"误服|吃错药|过量|喝农药|中毒|吞了(?:一整瓶|很多)",
        "药物过量与中毒需要尽快洗胃或解毒治疗，时间窗很关键。",
    ),
    # --- attention-level ----------------------------------------------------
    Rule(
        "high_fever",
        "持续高热",
        r"(?:发烧|发热)[^。！？\n]{0,10}(?:39|40|三天|3天|一周|反复|不退)",
        "高热持续超过 3 天或反复发作，需要面诊排除感染灶。",
        level="attention",
    ),
    Rule(
        "weight_loss",
        "非预期体重下降",
        r"体重[^。！？\n]{0,8}(?:下降|掉了|减轻)[^。！？\n]{0,6}(?:公斤|斤|kg)"
        r"|(?:瘦了|消瘦)[^。！？\n]{0,8}(?:斤|公斤|kg)",
        "半年内非预期体重下降超过 5% 需要系统排查。",
        level="attention",
    ),
    Rule(
        "blood_pressure_crisis",
        "血压显著升高",
        r"血压[^。！？\n]{0,10}(?:180|190|200|210|220|240)",
        "血压达到 180/120 mmHg 以上属于高血压急症范畴，需要评估靶器官损害。",
        level="attention",
    ),
    Rule(
        "chest_pain",
        "新发或持续的胸痛",
        r"(?:胸|心口|心前区)[^。！？\n]{0,6}(?:疼|痛|闷|压迫|压着|紧)",
        "胸痛的鉴别范围广，首次发作或持续不缓解需要尽快由医生评估。",
        level="attention",
    ),
)


@dataclass
class SafetyAssessment:
    level: Level = "routine"
    flags: list[dict] = field(default_factory=list)
    action: str | None = None

    @property
    def urgent(self) -> bool:
        return self.level == "urgent"

    def as_dict(self) -> dict:
        return {"level": self.level, "flags": self.flags, "action": self.action}


def _negated(text: str, start: int) -> bool:
    window = text[max(0, start - _NEGATION_WINDOW) : start]
    return any(word in window for word in NEGATIONS)


def assess(text: str, *, age: int | None = None) -> SafetyAssessment:
    """Screen free text. Deterministic, idempotent, and cheap enough to call twice."""
    flags: list[dict] = []
    level: Level = "routine"

    for rule in RULES:
        for match in re.finditer(rule.pattern, text):
            if _negated(text, match.start()):
                continue
            flags.append(
                {
                    "code": rule.code,
                    "label": rule.label,
                    "rationale": rule.rationale,
                    "level": rule.level,
                }
            )
            if rule.level == "urgent":
                level = "urgent"
            elif level == "routine":
                level = "attention"
            break

    if age is not None and age < 1 and level == "routine" and re.search(r"发烧|发热|体温", text):
        level = "attention"
        flags.append(
            {
                "code": "infant_fever_watch",
                "label": "1 岁以下婴儿发热",
                "rationale": "婴儿免疫系统尚未成熟，发热需要儿科医生评估。",
                "level": "attention",
            }
        )

    action = URGENT_ACTION if level == "urgent" else None
    return SafetyAssessment(level=level, flags=flags, action=action)


def merge(existing: SafetyAssessment, extra_level: Level | None, extra_flags: list[dict]) -> SafetyAssessment:
    """Severity can only escalate."""
    order = {"routine": 0, "attention": 1, "urgent": 2}
    level = existing.level
    if extra_level and order[extra_level] > order[level]:
        level = extra_level
    flags = [*existing.flags, *[flag for flag in extra_flags if flag not in existing.flags]]
    return SafetyAssessment(
        level=level,
        flags=flags,
        action=URGENT_ACTION if level == "urgent" else None,
    )
