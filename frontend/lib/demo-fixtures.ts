import type {
  AgentCard,
  Citation,
  Insights,
  IntakeSnapshot,
  Memory,
  Message,
  Meta,
  PatientProfile,
  ReportInsight,
  SafetyFlag,
  SessionSummary,
  SlotKey,
} from "./types";
import { SLOT_ORDER } from "./format";

export const DEMO_DISCLAIMER =
  "Super-Doctor 提供健康信息与就医建议，不做诊断、不开处方。回答基于公开的中文临床指南与专家共识，并标注可查证的来源。紧急情况请立即拨打 120 或前往最近的急诊。";

export const DEMO_PROFILE: PatientProfile = {
  birth_year: 1992,
  sex: "female",
  height_cm: 165,
  weight_kg: 58.4,
  allergies: ["青霉素"],
  conditions: ["高血压（1 级）"],
  medications: ["氨氯地平 5mg 每日一次"],
  smoker: "never",
  summary: "规律随访，家庭血压多在 128/82 mmHg 左右；对青霉素过敏。",
};

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@superdoctor.ai",
  display_name: "体验用户",
  profile: DEMO_PROFILE,
};

const CIT: Record<string, Citation> = {
  orthostatic: {
    id: "hypertension-2024#2",
    title: "卧立位血压测量与体位性低血压",
    source: "《中国高血压防治指南（2024年修订版）》",
    section: "第 3 章 · 血压测量与评估",
    snippet:
      "由卧位转为站立位后 3 分钟内，收缩压下降 ≥20 mmHg 或舒张压下降 ≥10 mmHg，可诊断为体位性低血压。测量前应静坐 5 分钟，避免咖啡因、吸烟与憋尿。",
    score: 0.93,
  },
  redflags: {
    id: "syncope-2023#1",
    title: "晕厥与先兆晕厥的危险分层",
    source: "《晕厥诊断与治疗中国专家共识（2023）》",
    section: "第 2 章 · 危险分层",
    snippet:
      "伴随胸痛、呼吸困难、意识丧失、单侧肢体无力或持续心悸的头晕属于高风险特征，应尽快急诊评估；反复发作或驾驶中发作者建议暂停驾驶。",
    score: 0.89,
  },
  anemia: {
    id: "anemia-2022#4",
    title: "贫血的筛查与鉴别",
    source: "《中国贫血诊治专家共识（2022）》",
    section: "第 4 章 · 实验室检查",
    snippet:
      "血常规是头晕伴乏力、面色苍白患者的一线检查。成年女性血红蛋白 <115 g/L 提示贫血，需进一步明确缺铁、慢性病或失血等原因。",
    score: 0.86,
  },
  lipid: {
    id: "lipid-2023#3",
    title: "LDL-C 目标值与降脂治疗时机",
    source: "《中国血脂管理指南（2023年）》",
    section: "第 5 章 · 降脂目标",
    snippet:
      "低危人群 LDL-C 目标为 <3.4 mmol/L，中危 <2.6 mmol/L，高危 <1.8 mmol/L。生活方式干预 3–6 个月后仍未达标者，应结合整体风险评估是否启动药物治疗。",
    score: 0.95,
  },
  lipidLife: {
    id: "lipid-2023#7",
    title: "血脂异常的生活方式干预",
    source: "《中国血脂管理指南（2023年）》",
    section: "第 4 章 · 生活方式治疗",
    snippet:
      "限制饱和脂肪与反式脂肪，增加膳食纤维与深海鱼摄入；每周至少 150 分钟中等强度有氧运动；超重者减重 5%–10% 可显著改善甘油三酯与 HDL-C。",
    score: 0.91,
  },
  childFever: {
    id: "fever-child-2024#2",
    title: "儿童发热的家庭观察与退热",
    source: "《儿童发热诊疗与家庭护理专家共识（2024）》",
    section: "第 1 章 · 家庭护理",
    snippet:
      "评估发热儿童时，精神状态比体温数值更重要。2 岁以上儿童体温 ≥38.5℃ 且明显不适时可按体重使用对乙酰氨基酚或布洛芬，避免交替使用与超剂量。",
    score: 0.94,
  },
  childRedFlag: {
    id: "fever-child-2024#6",
    title: "发热儿童的就医指征",
    source: "《儿童发热诊疗与家庭护理专家共识（2024）》",
    section: "第 3 章 · 就医指征",
    snippet:
      "出现持续嗜睡或难以唤醒、呼吸急促、抽搐、皮肤瘀点瘀斑、尿量明显减少，或发热超过 3 天不退，应及时就医。3 个月以下婴儿发热需立即就诊。",
    score: 0.9,
  },
  chestPain: {
    id: "acs-2023#1",
    title: "急性胸痛的院前识别与处理",
    source: "《急性冠脉综合征急诊快速诊治指南（2023）》",
    section: "第 2 章 · 院前急救",
    snippet:
      "突发胸骨后压榨性疼痛，伴大汗、呼吸困难、恶心或放射至左肩臂，应高度怀疑急性冠脉综合征。立即拨打 120，保持静息，避免自行驾车；无医生指导不要自行服用硝酸甘油或阿司匹林。",
    score: 0.96,
  },
  coffee: {
    id: "hypertension-2024#9",
    title: "咖啡因与血压",
    source: "《中国高血压防治指南（2024年修订版）》",
    section: "第 6 章 · 生活方式干预",
    snippet:
      "咖啡因可使血压短时升高约 5–10 mmHg。血压控制稳定者可适量饮用（每日不超过 1–2 杯），避免与降压药同时服用，并注意监测血压反应。",
    score: 0.87,
  },
  gerd: {
    id: "gerd-2020#3",
    title: "功能性消化不良与胃镜检查指征",
    source: "《中国胃食管反流病多学科诊疗共识（2020）》",
    section: "第 3 章 · 检查策略",
    snippet:
      "持续两周以上的餐后腹胀，若伴消瘦、黑便、吞咽困难、贫血或夜间痛醒，应尽快行胃镜检查；无报警症状者可先进行幽门螺杆菌检测与饮食调整。",
    score: 0.84,
  },
};

export const DEMO_CITATIONS = CIT;

/* ------------------------------------------------------------------ */
/* Intake helpers                                                       */
/* ------------------------------------------------------------------ */

export const EMPTY_INTAKE: IntakeSnapshot = {
  chief_complaint: null,
  onset: null,
  duration: null,
  severity: null,
  location: null,
  associated: [],
  history: [],
  medications: [],
  allergies: [],
  completeness: 0,
  missing: [...SLOT_ORDER],
};

function isFilled(intake: IntakeSnapshot, key: SlotKey): boolean {
  const value = intake[key];
  if (Array.isArray(value)) return value.length > 0;
  if (key === "severity") return value !== null && value !== undefined;
  return typeof value === "string" && value.trim().length > 0;
}

export function buildIntake(partial: Partial<IntakeSnapshot>): IntakeSnapshot {
  const merged: IntakeSnapshot = { ...EMPTY_INTAKE, ...partial };
  const missing = SLOT_ORDER.filter((key) => !isFilled(merged, key));
  const filled = SLOT_ORDER.length - missing.length;
  return {
    ...merged,
    completeness: Math.round((filled / SLOT_ORDER.length) * 100) / 100,
    missing,
  };
}

/* ------------------------------------------------------------------ */
/* Demo sessions & transcripts                                          */
/* ------------------------------------------------------------------ */

export const NOW = Date.now();

function isoMinutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function message(input: {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: Message["agent"];
  minutesAgo: number;
  citations?: Citation[];
  intake?: IntakeSnapshot | null;
  safety?: SafetyFlag | null;
  latency?: number | null;
}): Message {
  return {
    id: input.id,
    role: input.role,
    content: input.content,
    agent: input.agent ?? null,
    created_at: isoMinutesAgo(input.minutesAgo),
    citations: input.citations ?? [],
    intake: input.intake ?? null,
    safety: input.safety ?? null,
    latency_ms: input.latency ?? null,
    usage:
      input.role === "assistant"
        ? {
            input_tokens: 640 + Math.round(input.content.length * 0.4),
            output_tokens: Math.round(input.content.length * 1.1),
          }
        : null,
  };
}

const dizzyIntake = buildIntake({
  chief_complaint: "头晕",
  onset: "1 周前",
  duration: "每次数秒",
  severity: 4,
  location: "头部",
  associated: ["眼前发黑", "偶尔心慌"],
  history: ["高血压 1 级", "否认糖尿病"],
  medications: ["氨氯地平 5mg qd"],
  allergies: ["青霉素"],
});

const dizzySafety: SafetyFlag = {
  level: "attention",
  flags: [
    {
      code: "orthostatic_hypotension",
      label: "体位性低血压可能",
      rationale: "起身时出现头重脚轻与眼前发黑，符合体位性低血压的典型表现。",
    },
    {
      code: "fall_risk",
      label: "跌倒风险",
      rationale: "短暂黑蒙可能增加跌倒风险，夜间起床时尤其需要注意。",
    },
  ],
  action: "起身分三步，若出现晕厥或黑蒙加重请立即就医",
};

const dizzyTranscript: Message[] = [
  message({
    id: "dizzy-1",
    role: "user",
    content:
      "最近一周总是头晕，早上起床和蹲下站起来的时候最明显，有时候眼前会发黑。",
    minutesAgo: 38,
  }),
  message({
    id: "dizzy-2",
    role: "assistant",
    agent: "triage",
    content:
      "我先确认几个细节，帮助判断头晕的类型。\n\n1. 头晕时是天旋地转，还是头重脚轻、眼前发黑？\n2. 每次大概持续几秒，还是几分钟？\n3. 有没有伴随耳鸣、心慌、出汗或恶心？",
    minutesAgo: 37,
    intake: buildIntake({
      chief_complaint: "头晕",
      onset: "1 周前",
      associated: ["眼前发黑"],
    }),
    latency: 1420,
  }),
  message({
    id: "dizzy-3",
    role: "user",
    content: "是头重脚轻、眼前发黑，几秒钟就好。没有耳鸣，偶尔心慌。",
    minutesAgo: 30,
  }),
  message({
    id: "dizzy-4",
    role: "assistant",
    agent: "clinician",
    content:
      "从你的描述看，更像是体位性低血压引起的短暂脑供血不足：起身时血压来不及调节，出现头重脚轻和眼前发黑[1]。\n\n可以先做三件事：\n· 起床分三步：先侧卧 30 秒，再坐起 30 秒，扶稳后再站。\n· 每天分次饮水 1500–2000 mL，避免空腹和长时间热水澡。\n· 记录发作时间、持续时长和当时血压，就诊时带给医生。\n\n如果出现晕厥、胸痛、说话不清或一侧肢体无力，请立即就医或拨打 120[2]。",
    minutesAgo: 29,
    citations: [CIT.orthostatic, CIT.redflags],
    intake: dizzyIntake,
    safety: dizzySafety,
    latency: 2380,
  }),
  message({
    id: "dizzy-5",
    role: "user",
    content: "那我需要去医院查什么？",
    minutesAgo: 12,
  }),
  message({
    id: "dizzy-6",
    role: "assistant",
    agent: "clinician",
    content:
      "建议到全科或心内科做一次基础评估：卧立位血压、血常规（排除贫血）、心电图；如果发作频繁，医生可能加做动态心电图[1][2]。\n\n目前不需要自行服药。把发作记录和家庭血压带给医生，能明显提高就诊效率。",
    minutesAgo: 11,
    citations: [CIT.orthostatic, CIT.redflags],
    intake: dizzyIntake,
    safety: dizzySafety,
    latency: 1960,
  }),
];

const lipidIntake = buildIntake({
  chief_complaint: "低密度脂蛋白胆固醇偏高",
  onset: "本次体检发现",
  duration: "首次发现",
  severity: 2,
  associated: ["无明显不适"],
  history: ["否认高血压、糖尿病", "无早发心血管病家族史"],
  medications: ["无"],
  allergies: ["青霉素"],
});

const lipidSafety: SafetyFlag = {
  level: "routine",
  flags: [],
  action: null,
};

const lipidTranscript: Message[] = [
  message({
    id: "lipid-1",
    role: "user",
    content: "体检报告说低密度脂蛋白胆固醇 4.1，需要吃药吗？",
    minutesAgo: 128,
  }),
  message({
    id: "lipid-2",
    role: "assistant",
    agent: "clinician",
    content:
      "低密度脂蛋白胆固醇（LDL-C）4.1 mmol/L 属于偏高[1]。是否需要用药取决于整体心血管风险，而不是单个数字。\n\n决定因素包括年龄、血压、血糖、吸烟、家族史和既往心脑血管事件。建议先补齐这些信息，再由医生评估。",
    minutesAgo: 127,
    citations: [CIT.lipid],
    intake: buildIntake({
      chief_complaint: "低密度脂蛋白胆固醇偏高",
      onset: "本次体检发现",
      severity: 2,
      associated: ["无明显不适"],
      allergies: ["青霉素"],
    }),
    safety: lipidSafety,
    latency: 2140,
  }),
  message({
    id: "lipid-3",
    role: "user",
    content: "我 34 岁，没有高血压和糖尿病，家里也没有人得过心梗。",
    minutesAgo: 122,
  }),
  message({
    id: "lipid-4",
    role: "assistant",
    agent: "clinician",
    content:
      "按你提供的信息，属于低危人群。多数低危成人的 LDL-C 目标是 <3.4 mmol/L，可以先进行 3–6 个月的生活方式干预[1]：\n\n· 减少饱和脂肪和反式脂肪，每周吃 2 次深海鱼；\n· 每周至少 150 分钟中等强度有氧运动；\n· 控制体重，戒烟限酒。\n\n复查仍明显偏高，或出现其他危险因素时，再与医生讨论药物治疗[1]。",
    minutesAgo: 121,
    citations: [CIT.lipid, CIT.lipidLife],
    intake: lipidIntake,
    safety: lipidSafety,
    latency: 2260,
  }),
];

const feverSafety: SafetyFlag = {
  level: "attention",
  flags: [
    {
      code: "pediatric_fever",
      label: "幼儿发热需观察精神状态",
      rationale: "2 岁儿童体温 38.5℃，需要关注精神反应、补水与尿量。",
    },
  ],
  action: "若持续嗜睡、呼吸急促或发热超过 3 天，请及时就医",
};

const feverIntake = buildIntake({
  chief_complaint: "发热 38.5℃",
  onset: "今天上午",
  duration: "约 6 小时",
  severity: 6,
  location: "全身",
  associated: ["食欲下降", "精神尚可"],
  history: ["既往体健"],
  medications: ["对乙酰氨基酚（按体重）"],
  allergies: ["无已知过敏"],
});

const feverTranscript: Message[] = [
  message({
    id: "fever-1",
    role: "user",
    content: "孩子发烧 38.5℃，需要去医院吗？",
    minutesAgo: 26 * 60,
  }),
  message({
    id: "fever-2",
    role: "assistant",
    agent: "clinician",
    content:
      "38.5℃ 属于中度发热，先看孩子的精神状态比看数字更重要。2 岁孩子如果精神好、能喝水、尿量正常，可以先居家观察[1]。\n\n居家处理：\n· 减少衣物，保持室温 24–26℃，不要捂汗；\n· 少量多次补水，母乳或配方奶照常；\n· 体温 ≥38.5℃ 且明显不适时，可按体重使用对乙酰氨基酚或布洛芬，严格按说明书剂量。\n\n出现持续嗜睡、呼吸急促、抽搐、皮疹或 3 天不退热，请及时就医[2]。",
    minutesAgo: 26 * 60 - 1,
    citations: [CIT.childFever, CIT.childRedFlag],
    intake: feverIntake,
    safety: feverSafety,
    latency: 2650,
  }),
  message({
    id: "fever-3",
    role: "user",
    content: "两岁半，精神状态还可以，就是不太想吃饭。",
    minutesAgo: 25 * 60,
  }),
  message({
    id: "fever-4",
    role: "assistant",
    agent: "clinician",
    content:
      "精神好是积极的信号。暂时不想吃饭不必强迫，保证水分和奶量即可；体温升高时孩子食欲下降很常见，退热后通常会恢复[1]。\n\n建议每 4 小时测一次体温并记录，观察 48 小时。如果出现嗜睡、呼吸急促或尿量明显减少，请及时就医[2]。",
    minutesAgo: 25 * 60 - 1,
    citations: [CIT.childFever, CIT.childRedFlag],
    intake: feverIntake,
    safety: feverSafety,
    latency: 1840,
  }),
];

const coffeeTranscript: Message[] = [
  message({
    id: "coffee-1",
    role: "user",
    content: "服用降压药期间能喝咖啡吗？",
    minutesAgo: 2 * 24 * 60,
  }),
  message({
    id: "coffee-2",
    role: "assistant",
    agent: "clinician",
    content:
      "血压控制稳定时可以适量饮用，但咖啡因会让血压短时升高约 5–10 mmHg[1]。建议每天不超过 1–2 杯，避免与降压药同一时间服用，喝完 1 小时后测一次血压，观察自己的反应。\n\n如果出现心慌、失眠或血压明显升高，就先停掉咖啡，并把记录带给医生。",
    minutesAgo: 2 * 24 * 60 - 1,
    citations: [CIT.coffee],
    intake: buildIntake({
      chief_complaint: "高血压用药与咖啡",
      duration: "长期",
      severity: 1,
      associated: ["无明显不适"],
      history: ["高血压 1 级"],
      medications: ["氨氯地平 5mg qd"],
      allergies: ["青霉素"],
    }),
    latency: 2020,
  }),
];

const bloatTranscript: Message[] = [
  message({
    id: "bloat-1",
    role: "user",
    content: "饭后胃胀两周了，需要做胃镜吗？",
    minutesAgo: 5 * 24 * 60,
  }),
  message({
    id: "bloat-2",
    role: "assistant",
    agent: "clinician",
    content:
      "持续两周的餐后腹胀，先看有没有「报警症状」：消瘦、黑便、吞咽困难、贫血、夜间痛醒或持续呕吐[1]。\n\n如果没有这些情况，可以先做幽门螺杆菌检测，并记录饮食与症状的关系，减少高脂、酒精和碳酸饮料。若调整两周仍无改善，或出现上述任一症状，建议尽快消化内科就诊并考虑胃镜。",
    minutesAgo: 5 * 24 * 60 - 1,
    citations: [CIT.gerd],
    intake: buildIntake({
      chief_complaint: "餐后腹胀",
      onset: "2 周前",
      duration: "2 周",
      severity: 4,
      location: "上腹部",
      associated: ["嗳气", "饭后加重"],
      history: ["否认胃病史"],
    }),
    latency: 1880,
  }),
];

export const DEMO_SESSIONS: SessionSummary[] = [
  {
    id: "demo-session-dizzy",
    title: "早上起来头晕，站起来更明显",
    created_at: isoMinutesAgo(60 * 24 * 2),
    updated_at: isoMinutesAgo(11),
    last_message:
      "建议到全科或心内科做一次基础评估：卧立位血压、血常规、心电图……",
    message_count: 6,
    safety_level: "attention",
  },
  {
    id: "demo-session-lipid",
    title: "体检报告：低密度脂蛋白偏高",
    created_at: isoMinutesAgo(60 * 30),
    updated_at: isoMinutesAgo(121),
    last_message: "低危成人 LDL-C 目标 <3.4 mmol/L，可先生活方式干预 3–6 个月。",
    message_count: 4,
    safety_level: "routine",
  },
  {
    id: "demo-session-fever",
    title: "孩子发烧 38.5℃，需要去医院吗？",
    created_at: isoMinutesAgo(60 * 30),
    updated_at: isoMinutesAgo(25 * 60),
    last_message: "精神好是积极的信号，保证水分和奶量，观察 48 小时。",
    message_count: 4,
    safety_level: "attention",
  },
  {
    id: "demo-session-coffee",
    title: "服用降压药期间能喝咖啡吗",
    created_at: isoMinutesAgo(60 * 24 * 3),
    updated_at: isoMinutesAgo(2 * 24 * 60),
    last_message: "每天不超过 1–2 杯，避免与降压药同时服用。",
    message_count: 2,
    safety_level: "routine",
  },
  {
    id: "demo-session-bloat",
    title: "饭后胃胀两周，需要做胃镜吗",
    created_at: isoMinutesAgo(60 * 24 * 6),
    updated_at: isoMinutesAgo(5 * 24 * 60),
    last_message: "无报警症状可先查幽门螺杆菌，调整两周无改善再就诊。",
    message_count: 2,
    safety_level: null,
  },
];

export const DEMO_TRANSCRIPTS: Record<string, Message[]> = {
  "demo-session-dizzy": dizzyTranscript,
  "demo-session-lipid": lipidTranscript,
  "demo-session-fever": feverTranscript,
  "demo-session-coffee": coffeeTranscript,
  "demo-session-bloat": bloatTranscript,
};

/* ------------------------------------------------------------------ */
/* Semantic memory                                                      */
/* ------------------------------------------------------------------ */

export const DEMO_MEMORIES: Memory[] = [
  {
    id: "demo-memory-penicillin",
    kind: "fact",
    content: "对青霉素过敏",
    created_at: isoMinutesAgo(60 * 24 * 46),
    last_used_at: isoMinutesAgo(11),
  },
  {
    id: "demo-memory-gallbladder",
    kind: "event",
    content: "去年做过胆囊手术",
    created_at: isoMinutesAgo(60 * 24 * 33),
    last_used_at: isoMinutesAgo(2 * 24 * 60),
  },
  {
    id: "demo-memory-bp",
    kind: "preference",
    content: "每天早餐后测血压",
    created_at: isoMinutesAgo(60 * 24 * 12),
    last_used_at: null,
  },
];

/* ------------------------------------------------------------------ */
/* Reports                                                              */
/* ------------------------------------------------------------------ */

export const DEMO_REPORT: ReportInsight = {
  id: "report-demo-lipid",
  filename: "2026-05-年度体检报告.pdf",
  created_at: isoMinutesAgo(60 * 26),
  status: "ready",
  patient_hint: { sex: "female", age: 34 },
  summary:
    "本次体检报告以血脂异常为主：低密度脂蛋白胆固醇和总胆固醇偏高，高密度脂蛋白胆固醇偏低，属于混合型血脂异常倾向。肝功能、肾功能、血糖和甲状腺功能未见明显异常，尿酸轻度升高。建议先进行 3–6 个月生活方式干预，并由医生结合整体风险决定是否用药。",
  markers: [
    {
      name: "低密度脂蛋白胆固醇（LDL-C）",
      value: "4.12",
      unit: "mmol/L",
      reference: "< 3.40",
      status: "high",
      note: "与动脉粥样硬化风险相关。低危人群可先生活方式干预 3–6 个月后复查。",
    },
    {
      name: "总胆固醇（TC）",
      value: "6.21",
      unit: "mmol/L",
      reference: "< 5.20",
      status: "high",
      note: "受饮食与遗传共同影响，建议结合 LDL-C 一起评估。",
    },
    {
      name: "高密度脂蛋白胆固醇（HDL-C）",
      value: "0.92",
      unit: "mmol/L",
      reference: "> 1.00",
      status: "low",
      note: "偏低会削弱血管保护作用，规律有氧运动与戒烟有帮助。",
    },
    {
      name: "甘油三酯（TG）",
      value: "1.68",
      unit: "mmol/L",
      reference: "< 1.70",
      status: "normal",
      note: "接近上限，注意酒精与精制碳水摄入，复查即可。",
    },
    {
      name: "空腹血糖（FPG）",
      value: "5.3",
      unit: "mmol/L",
      reference: "3.9 – 6.1",
      status: "normal",
      note: "目前正常，建议每年复查一次。",
    },
    {
      name: "谷丙转氨酶（ALT）",
      value: "32",
      unit: "U/L",
      reference: "7 – 40",
      status: "normal",
      note: "肝细胞损伤的常用指标，目前处于正常范围。",
    },
    {
      name: "肌酐（Cr）",
      value: "68",
      unit: "μmol/L",
      reference: "41 – 81",
      status: "normal",
      note: "反映肾小球滤过功能，目前正常。",
    },
    {
      name: "尿酸（UA）",
      value: "372",
      unit: "μmol/L",
      reference: "155 – 357",
      status: "high",
      note: "轻度升高，多饮水、少喝含糖饮料与啤酒，3 个月后复查。",
    },
    {
      name: "血红蛋白（Hb）",
      value: "118",
      unit: "g/L",
      reference: "115 – 150",
      status: "normal",
      note: "接近下限，若出现乏力、头晕可加查铁代谢。",
    },
    {
      name: "促甲状腺激素（TSH）",
      value: "2.10",
      unit: "mIU/L",
      reference: "0.27 – 4.20",
      status: "normal",
      note: "甲状腺功能筛查指标，目前正常。",
    },
  ],
  questions_for_doctor: [
    "我的整体心血管风险属于哪一档？现在需要用药吗？",
    "低密度脂蛋白需要降到多少？多久复查一次？",
    "高密度脂蛋白偏低需要特别处理吗？",
    "尿酸轻度升高和饮食有关吗？需要复查吗？",
    "目前服用的降压药会影响血脂或尿酸吗？",
  ],
  citations: [CIT.lipid, CIT.lipidLife],
  disclaimer:
    "报告解读仅用于帮助理解检验结果，不构成诊断或治疗建议。请将完整报告交给医生结合病史判断。",
};

/* ------------------------------------------------------------------ */
/* Insights & meta                                                      */
/* ------------------------------------------------------------------ */

function dailySeries(): { date: string; runs: number }[] {
  const values = [42, 51, 47, 63, 58, 71, 66, 74, 69, 82, 76, 88, 79, 94];
  return values.map((runs, index) => {
    const d = new Date(NOW - (values.length - 1 - index) * 24 * 60 * 60 * 1000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    return { date, runs };
  });
}

export const DEMO_INSIGHTS: Insights = {
  runs: 1284,
  sessions: 326,
  messages: 5942,
  avg_latency_ms: 2410,
  p95_latency_ms: 5120,
  tokens: { input: 1_842_000, output: 612_400 },
  routes: [
    { agent: "supervisor", count: 1284 },
    { agent: "triage", count: 1106 },
    { agent: "clinician", count: 1088 },
    { agent: "safety", count: 1284 },
    { agent: "report", count: 218 },
  ],
  safety: { routine: 1102, attention: 154, urgent: 28 },
  daily: dailySeries(),
  intake_completion: 0.78,
};

export const DEMO_AGENTS: AgentCard[] = [
  {
    id: "supervisor",
    name: "Supervisor",
    role: "分诊调度",
    color: "#0e7490",
    description: "理解问题、规划路径，把任务交给合适的专科智能体。",
  },
  {
    id: "triage",
    name: "Triage",
    role: "结构化问诊",
    color: "#4f46e5",
    description: "把主诉拆成起病、部位、程度、伴随症状等结构化槽位。",
  },
  {
    id: "clinician",
    name: "Clinician",
    role: "全科顾问",
    color: "#0d9488",
    description: "结合指南给出健康信息、就医建议与可问医生的问题。",
  },
  {
    id: "report",
    name: "Report",
    role: "报告解读",
    color: "#7c3aed",
    description: "把化验单指标翻译成可理解的语言，标出异常与复查建议。",
  },
  {
    id: "safety",
    name: "Safety",
    role: "安全审查",
    color: "#b45309",
    description: "红旗症状筛查、用药风险提醒，必要时建议立即就医。",
  },
];

export const DEMO_META: Meta = {
  agents: DEMO_AGENTS,
  disclaimer: DEMO_DISCLAIMER,
  models: { supervisor: "deepseek-flash", worker: "deepseek-v4-pro" },
};
