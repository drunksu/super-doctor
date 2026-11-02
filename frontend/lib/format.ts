import type {
  AgentId,
  Citation,
  MarkerStatus,
  PatientProfile,
  SafetyLevel,
  SlotKey,
} from "./types";

export const APP_NAME = "Super-Doctor";
export const APP_TAGLINE = "智能问诊多智能体系统";

export const AGENT_ORDER: AgentId[] = [
  "supervisor",
  "triage",
  "clinician",
  "report",
  "safety",
];

export const AGENT_META: Record<
  AgentId,
  {
    label: string;
    name: string;
    role: string;
    color: string;
    soft: string;
    border: string;
    gradient: string;
    description: string;
  }
> = {
  supervisor: {
    label: "分诊调度",
    name: "Supervisor",
    role: "调度中枢",
    color: "#0e7490",
    soft: "#ecfeff",
    border: "#a5f3fc",
    gradient: "linear-gradient(135deg,#0e7490 0%,#0891b2 100%)",
    description: "理解问题、规划路径，把任务交给合适的专科智能体。",
  },
  triage: {
    label: "结构化问诊",
    name: "Triage",
    role: "问诊助手",
    color: "#4f46e5",
    soft: "#eef2ff",
    border: "#c7d2fe",
    gradient: "linear-gradient(135deg,#4f46e5 0%,#6366f1 100%)",
    description: "把主诉拆成起病、部位、程度、伴随症状等结构化槽位。",
  },
  clinician: {
    label: "全科顾问",
    name: "Clinician",
    role: "全科医生",
    color: "#0d9488",
    soft: "#f0fdfa",
    border: "#99f6e4",
    gradient: "linear-gradient(135deg,#0d9488 0%,#14b8a6 100%)",
    description: "结合指南给出健康信息、就医建议与可问医生的问题。",
  },
  report: {
    label: "报告解读",
    name: "Report",
    role: "检验解读",
    color: "#7c3aed",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    gradient: "linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)",
    description: "把化验单指标翻译成可理解的语言，标出异常与复查建议。",
  },
  safety: {
    label: "安全审查",
    name: "Safety",
    role: "安全守门",
    color: "#b45309",
    soft: "#fffbeb",
    border: "#fde68a",
    gradient: "linear-gradient(135deg,#b45309 0%,#f59e0b 100%)",
    description: "红旗症状筛查、用药风险提醒，必要时建议立即就医。",
  },
};

export const SLOT_ORDER: SlotKey[] = [
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

export const SLOT_LABELS: Record<SlotKey, string> = {
  chief_complaint: "主诉",
  onset: "起病时间",
  duration: "持续时间",
  severity: "严重程度",
  location: "部位",
  associated: "伴随症状",
  history: "既往史",
  medications: "用药",
  allergies: "过敏史",
};

export const MARKER_STATUS_META: Record<
  MarkerStatus,
  { label: string; className: string; dot: string }
> = {
  low: {
    label: "偏低",
    className: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "#0284c7",
  },
  normal: {
    label: "正常",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "#059669",
  },
  high: {
    label: "偏高",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "#d97706",
  },
  critical: {
    label: "危急",
    className: "bg-red-50 text-red-700 border-red-200",
    dot: "#dc2626",
  },
};

export const SAFETY_META: Record<
  SafetyLevel,
  { label: string; tone: string; dot: string }
> = {
  routine: { label: "常规", tone: "text-emerald-700", dot: "bg-emerald-500" },
  attention: { label: "需关注", tone: "text-amber-700", dot: "bg-amber-500" },
  urgent: { label: "紧急", tone: "text-red-700", dot: "bg-red-500" },
};

const TOOL_LABELS: Record<string, string> = {
  search_guidelines: "检索指南",
  retrieve_guidelines: "检索指南",
  guideline_search: "检索指南",
  lookup_patient: "读取档案",
  get_patient_profile: "读取档案",
  screen_red_flags: "红旗筛查",
  safety_check: "安全审查",
  parse_report: "解析报告",
  structure_intake: "整理问诊信息",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

export function toolDetail(args: Record<string, unknown>): string | null {
  const candidate =
    args.query ?? args.topic ?? args.keyword ?? args.symptom ?? args.name ?? args.field;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.length > 16 ? `${candidate.slice(0, 16)}…` : candidate;
  }
  return null;
}

/** Deterministic zh-CN relative time (safe for SSR/CSR parity). */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, now - then);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return "昨天";
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(then);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function formatClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return numberFormatter.format(Math.round(n));
}

export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return formatNumber(n);
}

export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function ageFromBirthYear(birthYear: number | null | undefined): number | null {
  if (!birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  return age > 0 && age < 130 ? age : null;
}

export function bmiFromProfile(profile: PatientProfile | null | undefined): number | null {
  const h = profile?.height_cm;
  const w = profile?.weight_kg;
  if (!h || !w || h <= 0) return null;
  const bmi = w / (h / 100) ** 2;
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
}

export function bmiLabel(bmi: number | null): string {
  if (bmi == null) return "—";
  if (bmi < 18.5) return "偏瘦";
  if (bmi < 24) return "正常";
  if (bmi < 28) return "超重";
  return "肥胖";
}

export function sexLabel(sex: PatientProfile["sex"] | string | null | undefined): string {
  switch (sex) {
    case "female":
    case "女":
    case "女性":
      return "女";
    case "male":
    case "男":
    case "男性":
      return "男";
    case "other":
    case "其他":
      return "其他";
    default:
      return "未填写";
  }
}

export function smokerLabel(smoker: PatientProfile["smoker"] | undefined): string {
  switch (smoker) {
    case "never":
      return "不吸烟";
    case "former":
      return "已戒烟";
    case "current":
      return "吸烟";
    default:
      return "未填写";
  }
}

export function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function citationLabel(index: number): string {
  return `[${index + 1}]`;
}

export function citationSource(citation: Citation): string {
  return citation.section ? `${citation.source} · ${citation.section}` : citation.source;
}

export function scorePercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score * 100)));
}

/** The five fixed agents used by the run-level timeline. */
export function labelForAgent(agent: AgentId): string {
  return AGENT_META[agent].label;
}
