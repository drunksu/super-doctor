#!/usr/bin/env node
/**
 * Super-Doctor mock API — dependency-free Node HTTP server implementing
 * docs/api-contract.md, including POST /chat/stream SSE with realistic pacing.
 *
 *   pnpm mock                  # http://127.0.0.1:8787/api
 *   MOCK_PORT=9000 pnpm mock
 *
 * Point the frontend at it with:
 *   NEXT_PUBLIC_API_BASE=http://127.0.0.1:8787/api pnpm dev
 */
import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT ?? process.env.PORT ?? 8787);
const DEMO_EMAIL = "demo@superdoctor.ai";
const DEMO_PASSWORD = "demo1234";
const VERSION = "1.0.0-mock";

const DISCLAIMER =
  "Super-Doctor 提供健康信息与就医建议，不做诊断、不开处方。回答基于公开的中文临床指南与专家共识，并标注可查证的来源。紧急情况请立即拨打 120 或前往最近的急诊。";

const CITATIONS = {
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
};

const AGENTS = [
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

const MODELS = { supervisor: "deepseek-flash", worker: "deepseek-v4-pro" };

const SLOT_KEYS = [
  "chief_complaint",
  "onset",
  "duration",
  "severity",
  "location",
  "associated",
  "history",
  "medications",
  "allergies",
];

const EMPTY_INTAKE = {
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
  missing: [...SLOT_KEYS],
};

function buildIntake(partial) {
  const merged = { ...EMPTY_INTAKE, ...partial };
  const missing = SLOT_KEYS.filter((key) => {
    const value = merged[key];
    if (Array.isArray(value)) return value.length === 0;
    if (key === "severity") return value == null;
    return typeof value !== "string" || value.trim() === "";
  });
  return {
    ...merged,
    completeness: Math.round(((SLOT_KEYS.length - missing.length) / SLOT_KEYS.length) * 100) / 100,
    missing,
  };
}

const isoAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const PROFILE = {
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

const USER = {
  id: "user-demo",
  email: DEMO_EMAIL,
  display_name: "体验用户",
  profile: PROFILE,
};

/* Semantic memory: what /api/memory lists, and what the chat turn says it injected. */
const memoryStore = [
  {
    id: "mem-penicillin",
    kind: "fact",
    content: "对青霉素过敏",
    created_at: isoAgo(60 * 24 * 46),
    last_used_at: isoAgo(11),
  },
  {
    id: "mem-gallbladder",
    kind: "event",
    content: "去年做过胆囊手术",
    created_at: isoAgo(60 * 24 * 33),
    last_used_at: isoAgo(2 * 24 * 60),
  },
  {
    id: "mem-blood-pressure",
    kind: "preference",
    content: "每天早餐后测血压",
    created_at: isoAgo(60 * 24 * 12),
    last_used_at: null,
  },
];

/* ------------------------------------------------------------------ */
/* Seed sessions                                                        */
/* ------------------------------------------------------------------ */

function assistantMessage(id, content, minutesAgo, options = {}) {
  return {
    id,
    role: "assistant",
    content,
    agent: options.agent ?? "clinician",
    created_at: isoAgo(minutesAgo),
    citations: options.citations ?? [],
    intake: options.intake ?? null,
    safety: options.safety ?? null,
    latency_ms: options.latency ?? 2400,
    usage: {
      input_tokens: 700 + Math.round(content.length * 0.4),
      output_tokens: Math.round(content.length * 1.05),
    },
  };
}

function userMessage(id, content, minutesAgo) {
  return {
    id,
    role: "user",
    content,
    agent: null,
    created_at: isoAgo(minutesAgo),
    citations: [],
    intake: null,
    safety: null,
    latency_ms: null,
    usage: null,
  };
}

const dizzySafety = {
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

const lipidSafety = { level: "routine", flags: [], action: null };

const feverSafety = {
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

const sessions = new Map();
const transcripts = new Map();

function seedSession(session, messages) {
  sessions.set(session.id, session);
  transcripts.set(session.id, messages);
}

seedSession(
  {
    id: "sess-dizzy-001",
    title: "早上起来头晕，站起来更明显",
    created_at: isoAgo(60 * 30),
    updated_at: isoAgo(11),
    last_message: null,
    message_count: 4,
    safety_level: "attention",
  },
  [
    userMessage(
      "seed-dizzy-u1",
      "最近一周总是头晕，早上起床和蹲下站起来的时候最明显，有时候眼前会发黑。",
      38,
    ),
    assistantMessage(
      "seed-dizzy-a1",
      "从你的描述看，更像是体位性低血压引起的短暂脑供血不足：起身时血压来不及调节，出现头重脚轻和眼前发黑[1]。\n\n可以先做三件事：\n· 起床分三步：先侧卧 30 秒，再坐起 30 秒，扶稳后再站。\n· 每天分次饮水 1500–2000 mL，避免空腹和长时间热水澡。\n· 记录发作时间、持续时长和当时血压。\n\n如果出现晕厥、胸痛或一侧肢体无力，请立即就医或拨打 120[2]。",
      37,
      {
        citations: [CITATIONS.orthostatic, CITATIONS.redflags],
        intake: dizzyIntake,
        safety: dizzySafety,
        latency: 2380,
      },
    ),
    userMessage("seed-dizzy-u2", "那我需要去医院查什么？", 12),
    assistantMessage(
      "seed-dizzy-a2",
      "建议到全科或心内科做一次基础评估：卧立位血压、血常规（排除贫血）、心电图；如果发作频繁，医生可能加做动态心电图[1][2]。\n\n目前不需要自行服药。把发作记录和家庭血压带给医生，能明显提高就诊效率。",
      11,
      {
        citations: [CITATIONS.orthostatic, CITATIONS.redflags],
        intake: dizzyIntake,
        safety: dizzySafety,
        latency: 1960,
      },
    ),
  ],
);

seedSession(
  {
    id: "sess-lipid-002",
    title: "体检报告：低密度脂蛋白偏高",
    created_at: isoAgo(60 * 20),
    updated_at: isoAgo(121),
    last_message: null,
    message_count: 2,
    safety_level: "routine",
  },
  [
    userMessage(
      "seed-lipid-u1",
      "体检报告说低密度脂蛋白胆固醇 4.1，需要吃药吗？",
      128,
    ),
    assistantMessage(
      "seed-lipid-a1",
      "LDL-C 4.1 mmol/L 属于偏高[1]。要不要吃药取决于整体心血管风险，而不是单个数字。\n\n如果属于低危人群，通常先把目标定在 <3.4 mmol/L，进行 3–6 个月生活方式干预：少吃肥肉与反式脂肪、每周 150 分钟有氧运动、超重者减重 5%–10%[2]。复查仍不达标，再与医生讨论药物治疗。",
      127,
      {
        citations: [CITATIONS.lipid, CITATIONS.lipidLife],
        intake: buildIntake({
          chief_complaint: "低密度脂蛋白胆固醇偏高",
          onset: "本次体检发现",
          duration: "首次发现",
          severity: 2,
          associated: ["无明显不适"],
          allergies: ["青霉素"],
        }),
        safety: lipidSafety,
        latency: 2140,
      },
    ),
  ],
);

seedSession(
  {
    id: "sess-fever-003",
    title: "孩子发烧 38.5℃，需要去医院吗？",
    created_at: isoAgo(60 * 26),
    updated_at: isoAgo(60 * 25),
    last_message: null,
    message_count: 2,
    safety_level: "attention",
  },
  [
    userMessage("seed-fever-u1", "孩子发烧 38.5℃，需要去医院吗？", 60 * 26),
    assistantMessage(
      "seed-fever-a1",
      "38.5℃ 属于中度发热，先看孩子的精神状态比看数字更重要。2 岁孩子如果精神好、能喝水、尿量正常，可以先居家观察[1]。\n\n减少衣物、少量多次补水；体温 ≥38.5℃ 且明显不适时，按体重使用对乙酰氨基酚或布洛芬。出现持续嗜睡、呼吸急促、抽搐或 3 天不退热，请及时就医[2]。",
      60 * 26 - 1,
      {
        citations: [CITATIONS.childFever, CITATIONS.childRedFlag],
        intake: buildIntake({
          chief_complaint: "发热 38.5℃",
          onset: "今天上午",
          duration: "约 6 小时",
          severity: 6,
          location: "全身",
          associated: ["食欲下降", "精神尚可"],
          history: ["既往体健"],
          medications: ["对乙酰氨基酚（按体重）"],
          allergies: ["无已知过敏"],
        }),
        safety: feverSafety,
        latency: 2650,
      },
    ),
  ],
);

function summarise(session) {
  const messages = transcripts.get(session.id) ?? [];
  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const latestSafety = [...messages].reverse().find((message) => message.safety)?.safety;
  return {
    ...session,
    last_message: lastAssistant ? lastAssistant.content.slice(0, 80) : null,
    message_count: messages.length,
    safety_level: latestSafety?.level ?? session.safety_level ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Reports                                                              */
/* ------------------------------------------------------------------ */

const DEMO_REPORT = {
  id: "report-demo-lipid",
  filename: "2026-05-年度体检报告.pdf",
  created_at: isoAgo(60 * 26),
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
  citations: [CITATIONS.lipid, CITATIONS.lipidLife],
  disclaimer:
    "报告解读仅用于帮助理解检验结果，不构成诊断或治疗建议。请将完整报告交给医生结合病史判断。",
};

const reports = new Map([[DEMO_REPORT.id, DEMO_REPORT]]);

function reportStatus(report) {
  if (report.status === "parsing" && report.ready_at && Date.now() >= report.ready_at) {
    report.status = "ready";
    delete report.ready_at;
  }
  return report;
}

function reportPayload(report) {
  reportStatus(report);
  const { ready_at, ...rest } = report;
  return rest;
}

/* ------------------------------------------------------------------ */
/* Insights                                                             */
/* ------------------------------------------------------------------ */

function dailySeries() {
  const values = [42, 51, 47, 63, 58, 71, 66, 74, 69, 82, 76, 88, 79, 94];
  return values.map((runs, index) => {
    const date = new Date(Date.now() - (values.length - 1 - index) * 86_400_000);
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")}`,
      runs,
    };
  });
}

const INSIGHTS = {
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

/* ------------------------------------------------------------------ */
/* SSE scripts                                                          */
/* ------------------------------------------------------------------ */

const ANSWERS = {
  dizzy: `先别担心。你描述的「起身时头晕、眼前发黑、持续几秒」更符合体位性低血压的表现：体位改变时血压调节慢了一拍，脑供血短暂下降[1]。

可以先做这三件事：
· 起床分三步：先侧卧 30 秒，再坐起 30 秒，扶稳后再站。
· 每天分次喝水 1500–2000 mL，避免空腹、热水澡和长时间站立。
· 记录每次发作的时间、持续时长和当时的血压，就诊时带给医生。

需要尽快就医的情况：晕厥、胸痛、呼吸困难、说话不清或一侧肢体无力[2]。如果只是偶发且能自行缓解，建议先到全科做卧立位血压、血常规和心电图。

以上是健康信息参考，不能替代面诊。你也可以继续问我检查或生活方式的问题。`,
  chest: `你描述的胸痛伴胸闷、出汗需要按急症处理：请立即拨打 120，不要自行开车去医院[1]。

在等待救护车时：
· 停止活动，保持半坐位，松开衣领，保持环境通风。
· 不要自行服用硝酸甘油或阿司匹林，除非医生之前明确指导过。
· 如果出现意识丧失、呼吸停止，立即开始心肺复苏，并让旁人取最近的 AED。

胸痛伴大汗、呼吸困难可能提示急性冠脉综合征，需要争分夺秒，请不要等待症状自行缓解[1]。`,
  fever: `38.5℃ 属于中度发热。判断要不要去医院，先看孩子的精神状态，而不是只盯着温度[1]。

如果孩子精神尚可、能喝水、尿量正常，可以先居家观察：
· 减少衣物，室温保持 24–26℃，不要捂汗。
· 少量多次补水，母乳或配方奶照常。
· 体温 ≥38.5℃ 且明显不适时，按体重使用对乙酰氨基酚或布洛芬，严格按说明书剂量，不要交替叠加。

出现持续嗜睡、呼吸急促、抽搐、皮疹、尿量明显减少，或发热超过 3 天不退，请及时就医；3 个月以下婴儿发热需立即就诊[2]。`,
  lipid: `LDL-C 4.1 mmol/L 属于偏高[1]。要不要吃药，取决于你的整体心血管风险，而不是单个数字。

如果属于低危人群，通常先把 LDL-C 目标定在 <3.4 mmol/L，进行 3–6 个月生活方式干预：
· 少吃肥肉、油炸食品和反式脂肪，每周吃 2 次深海鱼。
· 每周至少 150 分钟中等强度有氧运动。
· 超重的话减重 5%–10%，同时戒烟限酒。

复查仍不达标，或合并高血压、糖尿病、早发心血管病家族史，就需要和医生讨论他汀类药物[1]。把完整报告和家族史带给医生，评估会更准确。`,
};

const SCRIPTS = {
  dizzy: {
    answer: ANSWERS.dizzy,
    citations: [CITATIONS.orthostatic, CITATIONS.redflags],
    intakeEarly: buildIntake({
      chief_complaint: "头晕",
      onset: "1 周前",
      duration: "每次数秒",
      associated: ["眼前发黑", "偶尔心慌"],
    }),
    intakeFinal: dizzyIntake,
    safety: dizzySafety,
    toolQuery: "体位性低血压",
    followups: ["需要做哪些检查？", "日常怎么调整？", "什么情况必须就医？"],
    latencyMs: 2860,
  },
  chest: {
    answer: ANSWERS.chest,
    citations: [CITATIONS.chestPain],
    intakeEarly: buildIntake({
      chief_complaint: "胸痛",
      onset: "约 30 分钟前",
      duration: "持续不缓解",
      severity: 8,
      location: "胸骨后",
      associated: ["胸闷", "出汗"],
    }),
    intakeFinal: buildIntake({
      chief_complaint: "胸痛",
      onset: "约 30 分钟前",
      duration: "持续不缓解",
      severity: 8,
      location: "胸骨后",
      associated: ["胸闷", "出汗", "呼吸困难"],
      history: ["高血压 1 级"],
      medications: ["氨氯地平 5mg qd"],
      allergies: ["青霉素"],
    }),
    safety: {
      level: "urgent",
      flags: [
        {
          code: "chest_pain_acs",
          label: "胸痛伴大汗，需排除急性冠脉综合征",
          rationale: "胸骨后压榨性疼痛伴出汗、呼吸困难，属于需要立即急诊评估的红旗组合。",
        },
      ],
      action: "立即拨打 120",
    },
    toolQuery: "急性胸痛 院前处理",
    latencyMs: 2240,
  },
  fever: {
    answer: ANSWERS.fever,
    citations: [CITATIONS.childFever, CITATIONS.childRedFlag],
    intakeEarly: buildIntake({
      chief_complaint: "发热 38.5℃",
      onset: "今天上午",
      duration: "约 6 小时",
      severity: 6,
      associated: ["食欲下降"],
    }),
    intakeFinal: buildIntake({
      chief_complaint: "发热 38.5℃",
      onset: "今天上午",
      duration: "约 6 小时",
      severity: 6,
      location: "全身",
      associated: ["食欲下降", "精神尚可"],
      history: ["既往体健"],
      medications: ["对乙酰氨基酚（按体重）"],
      allergies: ["无已知过敏"],
    }),
    safety: feverSafety,
    toolQuery: "儿童发热 家庭护理",
    followups: ["怎么物理降温？", "退烧药怎么按体重吃？", "什么情况立刻去急诊？"],
    latencyMs: 3120,
  },
  lipid: {
    answer: ANSWERS.lipid,
    citations: [CITATIONS.lipid, CITATIONS.lipidLife],
    intakeEarly: buildIntake({
      chief_complaint: "低密度脂蛋白胆固醇偏高",
      onset: "本次体检发现",
      duration: "首次发现",
      severity: 2,
    }),
    intakeFinal: buildIntake({
      chief_complaint: "低密度脂蛋白胆固醇偏高",
      onset: "本次体检发现",
      duration: "首次发现",
      severity: 2,
      associated: ["无明显不适"],
      history: ["否认高血压、糖尿病"],
      medications: ["无"],
      allergies: ["青霉素"],
    }),
    safety: lipidSafety,
    toolQuery: "血脂异常 生活方式干预",
    followups: ["怎么吃才能降血脂？", "多久复查一次？", "需要吃药吗？"],
    latencyMs: 2680,
  },
};

function pickScript(message) {
  if (/胸痛|胸口|心前区|压榨|呼吸困难|喘不上气|大汗|心梗/.test(message)) return "chest";
  if (/发烧|发热|高烧|体温|孩子|宝宝|儿童|退烧/.test(message)) return "fever";
  if (/低密度|血脂|胆固醇|体检|化验|报告|LDL/i.test(message)) return "lipid";
  return "dizzy";
}

function tokenize(text) {
  const tokens = [];
  for (const part of text.split(/(\[\d{1,2}\])/)) {
    if (!part) continue;
    if (/^\[\d+\]$/.test(part)) {
      tokens.push(part);
      continue;
    }
    let cursor = 0;
    while (cursor < part.length) {
      const size = 3 + Math.floor(Math.random() * 4);
      tokens.push(part.slice(cursor, cursor + size));
      cursor += size;
    }
  }
  return tokens;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runChatStream(req, res, session, message) {
  const script = SCRIPTS[pickScript(message)];
  const runId = `run-${randomUUID()}`;
  const traceId = `trace-${randomUUID()}`;
  const messageId = `msg-${randomUUID()}`;
  const startedAt = Date.now();
  let clientGone = false;

  res.on("close", () => {
    clientGone = true;
  });

  res.writeHead(200, {
    ...CORS_HEADERS,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event, data) => {
    if (clientGone || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const agent = (id, status, label) => send("agent", { agent: id, status, label });
  const wait = async (ms) => {
    await sleep(ms);
    return !clientGone;
  };

  send("run_started", { run_id: runId, trace_id: traceId, session_id: session.id });

  const injected = memoryStore.slice(0, 4);
  send("memory", { count: injected.length, items: injected.map((memory) => memory.content) });
  const usedAt = new Date().toISOString();
  for (const memory of injected) memory.last_used_at = usedAt;

  if (!(await wait(220))) return;
  agent("supervisor", "started", "分诊调度");
  if (!(await wait(500))) return;
  agent("supervisor", "finished", "分诊调度");

  if (!(await wait(150))) return;
  agent("triage", "started", "结构化问诊");
  if (!(await wait(200))) return;
  send("tool", {
    name: "search_guidelines",
    args: { query: script.toolQuery },
    status: "started",
    preview: null,
  });
  if (!(await wait(520))) return;
  send("tool", {
    name: "search_guidelines",
    args: { query: script.toolQuery },
    status: "finished",
    preview: "命中 3 条指南段落 · 最高相关度 0.93",
  });
  if (!(await wait(150))) return;
  send("intake", script.intakeEarly);
  if (!(await wait(240))) return;
  agent("triage", "finished", "结构化问诊");

  if (!(await wait(160))) return;
  agent("clinician", "started", "全科顾问");

  for (let index = 0; index < script.citations.length; index += 1) {
    if (!(await wait(index === 0 ? 220 : 150))) return;
    send("citation", script.citations[index]);
  }

  for (const token of tokenize(script.answer)) {
    if (clientGone) return;
    const delay =
      6 +
      Math.floor(Math.random() * 5) +
      (/[。！？]/.test(token) ? 52 : /[，、；：]/.test(token) ? 20 : 0) +
      (token.includes("\n") ? 55 : 0);
    await sleep(delay);
    send("token", { text: token });
  }

  if (!(await wait(220))) return;
  send("intake", script.intakeFinal);
  if (!(await wait(170))) return;
  agent("clinician", "finished", "全科顾问");

  if (!(await wait(140))) return;
  agent("safety", "started", "安全审查");
  if (!(await wait(160))) return;
  send("tool", {
    name: "screen_red_flags",
    args: { level: script.safety.level },
    status: "started",
    preview: null,
  });
  if (!(await wait(340))) return;
  send("tool", {
    name: "screen_red_flags",
    args: { level: script.safety.level },
    status: "finished",
    preview:
      script.safety.level === "urgent"
        ? "命中红旗规则：胸痛伴大汗"
        : script.safety.level === "attention"
          ? "命中 1 条关注规则"
          : "未命中红旗规则",
  });
  if (!(await wait(240))) return;
  send("safety", script.safety);
  if (!(await wait(180))) return;
  agent("safety", "finished", "安全审查");

  if (script.followups) {
    if (!(await wait(140))) return;
    send("interrupt", {
      question: "还需要我帮你梳理哪一部分？",
      options: script.followups,
      field: "next_step",
    });
  }

  const usage = {
    input_tokens: 780 + Math.round(message.length * 0.8),
    output_tokens: Math.round(script.answer.length * 0.92),
  };

  const assistant = {
    id: messageId,
    role: "assistant",
    content: script.answer,
    agent: "clinician",
    created_at: new Date().toISOString(),
    citations: script.citations,
    intake: script.intakeFinal,
    safety: script.safety,
    latency_ms: script.latencyMs,
    usage,
  };
  const messages = transcripts.get(session.id) ?? [];
  messages.push(assistant);
  transcripts.set(session.id, messages);
  session.updated_at = new Date().toISOString();
  session.message_count = messages.length;
  session.safety_level = script.safety.level;

  if (!(await wait(200))) return;
  send("done", {
    message_id: messageId,
    run_id: runId,
    latency_ms: script.latencyMs,
    usage,
    agents: ["supervisor", "triage", "clinician", "safety"],
    citations: script.citations,
  });

  console.log(
    `[mock] chat done · ${session.id} · ${message.length} chars · ${Date.now() - startedAt}ms`,
  );
  res.end();
  req.resume();
}

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,Accept",
  "Access-Control-Max-Age": "86400",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...CORS_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, status, code, message) {
  sendJson(res, status, { error: { code, message } });
}

function sendNoContent(res) {
  res.writeHead(204, CORS_HEADERS);
  res.end();
}

function readRaw(req, limit = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("file_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readRaw(req, 1 * 1024 * 1024);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

function requireAuth(req, res) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    sendError(res, 401, "unauthorized", "缺少登录凭证");
    return false;
  }
  return true;
}

function createSessionRecord(title) {
  const now = new Date().toISOString();
  const session = {
    id: `sess-${randomUUID()}`,
    title: (title ?? "").trim().slice(0, 40) || "新的问诊",
    created_at: now,
    updated_at: now,
    last_message: null,
    message_count: 0,
    safety_level: null,
  };
  sessions.set(session.id, session);
  transcripts.set(session.id, []);
  return session;
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  if (!req.url) return sendError(res, 400, "bad_request", "缺少请求地址");

  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method ?? "GET";
  console.log(`[mock] ${method} ${path}`);

  try {
    if (path === "/" && method === "GET") {
      return sendJson(res, 200, {
        name: "Super-Doctor mock API",
        version: VERSION,
        base: "/api",
        health: "/api/health",
      });
    }

    if (path === "/api/health" && method === "GET") {
      return sendJson(res, 200, { status: "ok", model_mode: "mock", version: VERSION });
    }

    if (path === "/api/auth/login" && method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
        return sendError(res, 400, "bad_request", "请填写邮箱和密码");
      }
      if (
        body.email.trim().toLowerCase() !== DEMO_EMAIL ||
        body.password !== DEMO_PASSWORD
      ) {
        return sendError(res, 401, "invalid_credentials", "邮箱或密码不正确");
      }
      return sendJson(res, 200, {
        access_token: `mock-token-${randomUUID()}`,
        token_type: "bearer",
        user: USER,
      });
    }

    if (path === "/api/auth/register" && method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
        return sendError(res, 400, "bad_request", "请填写完整信息");
      }
      return sendJson(res, 201, {
        access_token: `mock-token-${randomUUID()}`,
        token_type: "bearer",
        user: {
          id: `user-${randomUUID()}`,
          email: body.email,
          display_name: body.display_name || "新用户",
          profile: null,
        },
      });
    }

    // Every route below requires a bearer token.
    if (path.startsWith("/api/") && !requireAuth(req, res)) return;

    if (path === "/api/me" && method === "GET") {
      return sendJson(res, 200, USER);
    }

    if (path === "/api/me/profile" && method === "PUT") {
      const body = await readJson(req);
      if (!body) return sendError(res, 400, "bad_request", "请求体不是合法 JSON");
      const current = USER.profile ?? PROFILE;
      USER.profile = {
        ...current,
        ...body,
        allergies: Array.isArray(body.allergies) ? body.allergies : current.allergies,
        conditions: Array.isArray(body.conditions) ? body.conditions : current.conditions,
        medications: Array.isArray(body.medications) ? body.medications : current.medications,
      };
      return sendJson(res, 200, USER.profile);
    }

    if (path === "/api/memory" && method === "GET") {
      const list = [...memoryStore]
        .sort(
          (a, b) =>
            new Date(b.last_used_at ?? b.created_at) - new Date(a.last_used_at ?? a.created_at),
        )
        .map(({ id, kind, content, created_at, last_used_at }) => ({
          id,
          kind,
          content,
          created_at,
          last_used_at,
        }));
      return sendJson(res, 200, { memories: list });
    }

    const memoryMatch = /^\/api\/memory\/([^/]+)$/.exec(path);
    if (memoryMatch && method === "DELETE") {
      const id = decodeURIComponent(memoryMatch[1]);
      const index = memoryStore.findIndex((memory) => memory.id === id);
      if (index === -1) return sendError(res, 404, "not_found", "记忆不存在");
      memoryStore.splice(index, 1);
      return sendNoContent(res);
    }

    if (path === "/api/sessions" && method === "GET") {
      const list = [...sessions.values()]
        .map(summarise)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      return sendJson(res, 200, { sessions: list });
    }

    if (path === "/api/sessions" && method === "POST") {
      const body = await readJson(req);
      const session = createSessionRecord(body?.title);
      return sendJson(res, 201, summarise(session));
    }

    const messagesMatch = /^\/api\/sessions\/([^/]+)\/messages$/.exec(path);
    if (messagesMatch && method === "GET") {
      const id = decodeURIComponent(messagesMatch[1]);
      const session = sessions.get(id);
      if (!session) return sendError(res, 404, "not_found", "没有找到该会话");
      return sendJson(res, 200, {
        session: summarise(session),
        messages: transcripts.get(id) ?? [],
      });
    }

    const sessionMatch = /^\/api\/sessions\/([^/]+)$/.exec(path);
    if (sessionMatch && method === "DELETE") {
      const id = decodeURIComponent(sessionMatch[1]);
      if (!sessions.has(id)) return sendError(res, 404, "not_found", "没有找到该会话");
      sessions.delete(id);
      transcripts.delete(id);
      return sendNoContent(res);
    }

    if (path === "/api/chat/stream" && method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.session_id !== "string" || typeof body.message !== "string") {
        return sendError(res, 400, "bad_request", "缺少 session_id 或 message");
      }
      const session = sessions.get(body.session_id);
      if (!session) return sendError(res, 404, "not_found", "没有找到该会话");
      if (!body.message.trim()) return sendError(res, 400, "bad_request", "消息不能为空");

      const messages = transcripts.get(session.id) ?? [];
      messages.push({
        id: `msg-${randomUUID()}`,
        role: "user",
        content: body.message,
        agent: null,
        created_at: new Date().toISOString(),
        citations: [],
        intake: null,
        safety: null,
        latency_ms: null,
        usage: null,
      });
      transcripts.set(session.id, messages);
      session.updated_at = new Date().toISOString();
      session.message_count = messages.length;

      await runChatStream(req, res, session, body.message);
      return;
    }

    if (path === "/api/reports" && method === "POST") {
      const raw = await readRaw(req);
      if (raw.length > 10 * 1024 * 1024) {
        return sendError(res, 413, "file_too_large", "文件超过 10 MB 限制");
      }
      const filenameMatch = /filename="([^"]+)"/.exec(raw.toString("utf8"));
      const filename = filenameMatch?.[1] ?? "上传报告.pdf";
      if (!/\.(pdf|png|jpe?g)$/i.test(filename)) {
        return sendError(res, 415, "unsupported_file", "仅支持 PDF、PNG、JPG 格式");
      }
      const report = {
        ...DEMO_REPORT,
        id: `report-${randomUUID()}`,
        filename,
        created_at: new Date().toISOString(),
        status: "parsing",
        ready_at: Date.now() + 1800,
      };
      reports.set(report.id, report);
      return sendJson(res, 202, { report_id: report.id, status: "parsing" });
    }

    if (path === "/api/reports" && method === "GET") {
      const list = [...reports.values()].map((report) => {
        const payload = reportPayload(report);
        const { markers, ...rest } = payload;
        return { ...rest, marker_count: markers.length };
      });
      return sendJson(res, 200, { reports: list });
    }

    const reportMatch = /^\/api\/reports\/([^/]+)$/.exec(path);
    if (reportMatch && method === "GET") {
      const report = reports.get(decodeURIComponent(reportMatch[1]));
      if (!report) return sendError(res, 404, "not_found", "没有找到该报告");
      return sendJson(res, 200, reportPayload(report));
    }

    if (path === "/api/meta/agents" && method === "GET") {
      return sendJson(res, 200, {
        agents: AGENTS,
        disclaimer: DISCLAIMER,
        models: MODELS,
      });
    }

    if (path === "/api/insights/summary" && method === "GET") {
      return sendJson(res, 200, INSIGHTS);
    }

    return sendError(res, 404, "not_found", `未知接口 ${method} ${path}`);
  } catch (error) {
    console.error("[mock] handler error", error);
    if (error instanceof Error && error.message === "file_too_large") {
      return sendError(res, 413, "file_too_large", "文件超过 10 MB 限制");
    }
    if (!res.headersSent) {
      return sendError(res, 500, "upstream_unavailable", "Mock 服务内部错误");
    }
    res.end();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock] Super-Doctor mock API → http://127.0.0.1:${PORT}/api`);
  console.log(`[mock] demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
});

server.on("error", (error) => {
  console.error("[mock] server error", error);
  process.exitCode = 1;
});
