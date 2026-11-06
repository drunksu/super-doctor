import { DEMO_CITATIONS, DEMO_PROFILE, buildIntake } from "./demo-fixtures";
import type {
  AgentId,
  Citation,
  IntakeSnapshot,
  SafetyFlag,
  StreamEvent,
} from "./types";

export type DemoStep = {
  /** Milliseconds to wait before emitting this event. */
  delay: number;
  event: StreamEvent;
};

type DemoScript = {
  answer: string;
  citations: Citation[];
  intakeEarly: IntakeSnapshot;
  intakeFinal: IntakeSnapshot;
  safety: SafetyFlag;
  toolQuery: string;
  followups?: { question: string; options: string[] };
  latencyMs: number;
};

type ScriptKind = "dizzy" | "chest" | "fever" | "lipid";

export function detectDemoKind(message: string): ScriptKind {
  if (/胸痛|胸口|心前区|压榨|呼吸困难|喘不上气|大汗|心梗/.test(message)) return "chest";
  if (/发烧|发热|高烧|体温|孩子|宝宝|儿童|退烧/.test(message)) return "fever";
  if (/低密度|血脂|胆固醇|体检|化验|报告|LDL/i.test(message)) return "lipid";
  return "dizzy";
}

const DIZZY_ANSWER = `先别担心。你描述的「起身时头晕、眼前发黑、持续几秒」更符合体位性低血压的表现：体位改变时血压调节慢了一拍，脑供血短暂下降[1]。

可以先做这三件事：
· 起床分三步：先侧卧 30 秒，再坐起 30 秒，扶稳后再站。
· 每天分次喝水 1500–2000 mL，避免空腹、热水澡和长时间站立。
· 记录每次发作的时间、持续时长和当时的血压，就诊时带给医生。

需要尽快就医的情况：晕厥、胸痛、呼吸困难、说话不清或一侧肢体无力[2]。如果只是偶发且能自行缓解，建议先到全科做卧立位血压、血常规和心电图。

以上是健康信息参考，不能替代面诊。你也可以继续问我检查或生活方式的问题。`;

const CHEST_ANSWER = `你描述的胸痛伴胸闷、出汗需要按急症处理：请立即拨打 120，不要自行开车去医院[1]。

在等待救护车时：
· 停止活动，保持半坐位，松开衣领，保持环境通风。
· 不要自行服用硝酸甘油或阿司匹林，除非医生之前明确指导过。
· 如果出现意识丧失、呼吸停止，立即开始心肺复苏，并让旁人取最近的 AED。

胸痛伴大汗、呼吸困难可能提示急性冠脉综合征，需要争分夺秒，请不要等待症状自行缓解[1]。`;

const FEVER_ANSWER = `38.5℃ 属于中度发热。判断要不要去医院，先看孩子的精神状态，而不是只盯着温度[1]。

如果孩子精神尚可、能喝水、尿量正常，可以先居家观察：
· 减少衣物，室温保持 24–26℃，不要捂汗。
· 少量多次补水，母乳或配方奶照常。
· 体温 ≥38.5℃ 且明显不适时，按体重使用对乙酰氨基酚或布洛芬，严格按说明书剂量，不要交替叠加。

出现持续嗜睡、呼吸急促、抽搐、皮疹、尿量明显减少，或发热超过 3 天不退，请及时就医；3 个月以下婴儿发热需立即就诊[2]。`;

const LIPID_ANSWER = `LDL-C 4.1 mmol/L 属于偏高[1]。要不要吃药，取决于你的整体心血管风险，而不是单个数字。

如果属于低危人群，通常先把 LDL-C 目标定在 <3.4 mmol/L，进行 3–6 个月生活方式干预：
· 少吃肥肉、油炸食品和反式脂肪，每周吃 2 次深海鱼。
· 每周至少 150 分钟中等强度有氧运动。
· 超重的话减重 5%–10%，同时戒烟限酒。

复查仍不达标，或合并高血压、糖尿病、早发心血管病家族史，就需要和医生讨论他汀类药物[1]。把完整报告和家族史带给医生，评估会更准确。`;

const SCRIPTS: Record<ScriptKind, DemoScript> = {
  dizzy: {
    answer: DIZZY_ANSWER,
    citations: [DEMO_CITATIONS.orthostatic, DEMO_CITATIONS.redflags],
    intakeEarly: buildIntake({
      chief_complaint: "头晕",
      onset: "1 周前",
      duration: "每次数秒",
      associated: ["眼前发黑", "偶尔心慌"],
    }),
    intakeFinal: buildIntake({
      chief_complaint: "头晕",
      onset: "1 周前",
      duration: "每次数秒",
      severity: 4,
      location: "头部",
      associated: ["眼前发黑", "偶尔心慌"],
      history: ["高血压 1 级", "否认糖尿病"],
      medications: [DEMO_PROFILE.medications[0]],
      allergies: DEMO_PROFILE.allergies,
    }),
    safety: {
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
    },
    toolQuery: "体位性低血压",
    followups: {
      question: "还需要我帮你梳理哪一部分？",
      options: ["需要做哪些检查？", "日常怎么调整？", "什么情况必须就医？"],
    },
    latencyMs: 2860,
  },
  chest: {
    answer: CHEST_ANSWER,
    citations: [DEMO_CITATIONS.chestPain],
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
      medications: [DEMO_PROFILE.medications[0]],
      allergies: DEMO_PROFILE.allergies,
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
    answer: FEVER_ANSWER,
    citations: [DEMO_CITATIONS.childFever, DEMO_CITATIONS.childRedFlag],
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
    safety: {
      level: "attention",
      flags: [
        {
          code: "pediatric_fever",
          label: "幼儿发热需观察精神状态",
          rationale: "2 岁儿童体温 38.5℃，需要关注精神反应、补水量与尿量。",
        },
      ],
      action: "若持续嗜睡、呼吸急促或发热超过 3 天，请及时就医",
    },
    toolQuery: "儿童发热 家庭护理",
    followups: {
      question: "需要我继续说明哪一步？",
      options: ["怎么物理降温？", "退烧药怎么按体重吃？", "什么情况立刻去急诊？"],
    },
    latencyMs: 3120,
  },
  lipid: {
    answer: LIPID_ANSWER,
    citations: [DEMO_CITATIONS.lipid, DEMO_CITATIONS.lipidLife],
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
      history: ["否认高血压、糖尿病", "无早发心血管病家族史"],
      medications: ["无"],
      allergies: DEMO_PROFILE.allergies,
    }),
    safety: { level: "routine", flags: [], action: null },
    toolQuery: "血脂异常 生活方式干预",
    followups: {
      question: "还要继续了解吗？",
      options: ["怎么吃才能降血脂？", "多久复查一次？", "需要吃药吗？"],
    },
    latencyMs: 2680,
  },
};

let runCounter = 0;

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const marker = /(\[\d{1,2}\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushPlain = (plain: string) => {
    let cursor = 0;
    while (cursor < plain.length) {
      const size = 3 + (tokens.length % 4);
      tokens.push(plain.slice(cursor, cursor + size));
      cursor += size;
    }
  };

  while ((match = marker.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index));
    tokens.push(match[0]);
    lastIndex = match.index + match[0].length;
  }
  pushPlain(text.slice(lastIndex));
  return tokens.filter((token) => token.length > 0);
}

function tokenDelay(token: string): number {
  let delay = 6 + Math.floor(Math.random() * 5);
  if (/[。！？]/.test(token)) delay += 55;
  else if (/[，、；：]/.test(token)) delay += 22;
  if (token.includes("\n")) delay += 60;
  return delay;
}

/**
 * Build a realistic, locally replayable SSE script with the exact event shapes
 * from the contract. The UI replays it with `replayDemoStream`.
 */
export function buildDemoStream(input: {
  message: string;
  sessionId: string;
  memories?: string[];
}): DemoStep[] {
  const kind = detectDemoKind(input.message);
  const script = SCRIPTS[kind];
  const steps: DemoStep[] = [];
  runCounter += 1;
  const stamp = `${Date.now().toString(36)}-${runCounter}`;
  const runId = `demo-run-${stamp}`;
  const traceId = `trace-${stamp}`;
  const messageId = `demo-msg-${stamp}`;
  const memories = (input.memories ?? []).slice(0, 4);

  const add = (delay: number, event: StreamEvent) => steps.push({ delay, event });
  const agent = (
    id: AgentId,
    status: "started" | "finished",
    label: string,
  ): StreamEvent => ({
    type: "agent",
    data: { agent: id, status, label },
  });

  add(200, {
    type: "run_started",
    data: { run_id: runId, trace_id: traceId, session_id: input.sessionId },
  });
  add(120, {
    type: "memory",
    data: { count: memories.length, items: memories },
  });
  add(240, agent("supervisor", "started", "分诊调度"));
  add(520, agent("supervisor", "finished", "分诊调度"));
  add(140, agent("triage", "started", "结构化问诊"));
  add(200, {
    type: "tool",
    data: {
      name: "search_guidelines",
      args: { query: script.toolQuery },
      status: "started",
      preview: null,
    },
  });
  add(560, {
    type: "tool",
    data: {
      name: "search_guidelines",
      args: { query: script.toolQuery },
      status: "finished",
      preview: "命中 3 条指南段落 · 最高相关度 0.93",
    },
  });
  add(160, { type: "intake", data: script.intakeEarly });
  add(240, agent("triage", "finished", "结构化问诊"));
  add(160, agent("clinician", "started", "全科顾问"));

  script.citations.forEach((citation, index) => {
    add(index === 0 ? 220 : 160, { type: "citation", data: citation });
  });

  for (const token of tokenize(script.answer)) {
    add(tokenDelay(token), { type: "token", data: { text: token } });
  }

  add(240, { type: "intake", data: script.intakeFinal });
  add(180, agent("clinician", "finished", "全科顾问"));
  add(140, agent("safety", "started", "安全审查"));
  add(180, {
    type: "tool",
    data: {
      name: "screen_red_flags",
      args: { level: script.safety.level },
      status: "started",
      preview: null,
    },
  });
  add(380, {
    type: "tool",
    data: {
      name: "screen_red_flags",
      args: { level: script.safety.level },
      status: "finished",
      preview:
        script.safety.level === "urgent"
          ? "命中红旗规则：胸痛伴大汗"
          : script.safety.level === "attention"
            ? "命中 1 条关注规则"
            : "未命中红旗规则",
    },
  });
  add(280, { type: "safety", data: script.safety });
  add(200, agent("safety", "finished", "安全审查"));

  if (script.followups) {
    add(160, {
      type: "interrupt",
      data: {
        question: script.followups.question,
        options: script.followups.options,
        field: "next_step",
      },
    });
  }

  const outputTokens = Math.round(script.answer.length * 0.92);
  const inputTokens = 780 + Math.round(input.message.length * 0.8);

  add(220, {
    type: "done",
    data: {
      message_id: messageId,
      run_id: runId,
      latency_ms: script.latencyMs,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      agents: ["supervisor", "triage", "clinician", "safety"],
      citations: script.citations,
    },
  });

  return steps;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Replays the scripted stream with realistic pacing, respecting abort. */
export async function replayDemoStream(
  steps: DemoStep[],
  options: { signal?: AbortSignal; onEvent: (event: StreamEvent) => void },
): Promise<void> {
  for (const step of steps) {
    await sleep(step.delay, options.signal);
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    options.onEvent(step.event);
  }
}
