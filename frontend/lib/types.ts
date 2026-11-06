/**
 * Type definitions mirroring docs/api-contract.md (v1).
 * Keep this file in sync with the contract — it is the single source of truth
 * for the shapes the UI renders.
 */

export type AgentId = "supervisor" | "triage" | "clinician" | "report" | "safety";

export type SafetyLevel = "routine" | "attention" | "urgent";

export type Citation = {
  id: string;
  title: string;
  source: string;
  section: string;
  snippet: string;
  score: number;
};

export type IntakeSnapshot = {
  chief_complaint: string | null;
  onset: string | null;
  duration: string | null;
  severity: number | null;
  location: string | null;
  associated: string[];
  history: string[];
  medications: string[];
  allergies: string[];
  completeness: number;
  missing: string[];
};

export type SafetyFlag = {
  level: SafetyLevel;
  flags: { code: string; label: string; rationale: string }[];
  action: string | null;
};

export type PatientProfile = {
  birth_year: number | null;
  sex: "female" | "male" | "other" | null;
  height_cm: number | null;
  weight_kg: number | null;
  allergies: string[];
  conditions: string[];
  medications: string[];
  smoker: "never" | "former" | "current" | null;
  summary: string | null;
};

export type Memory = {
  id: string;
  kind: string;
  content: string;
  created_at: string;
  last_used_at: string | null;
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  profile?: PatientProfile | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type SessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
  safety_level: SafetyLevel | null;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent: AgentId | null;
  created_at: string;
  citations: Citation[];
  intake: IntakeSnapshot | null;
  safety: SafetyFlag | null;
  latency_ms: number | null;
  usage: { input_tokens: number; output_tokens: number } | null;
};

export type MarkerStatus = "low" | "normal" | "high" | "critical";

export type ReportMarker = {
  name: string;
  value: string;
  unit: string | null;
  reference: string | null;
  status: MarkerStatus;
  note: string;
};

export type ReportInsight = {
  id: string;
  filename: string;
  created_at: string;
  status: "parsing" | "ready" | "failed";
  patient_hint: { sex: string | null; age: number | null } | null;
  summary: string;
  markers: ReportMarker[];
  questions_for_doctor: string[];
  citations: Citation[];
  disclaimer: string;
};

export type ReportListItem = Omit<ReportInsight, "markers"> & { marker_count: number };

export type AgentCard = {
  id: AgentId;
  name: string;
  role: string;
  color: string;
  description: string;
};

export type Meta = {
  agents: AgentCard[];
  disclaimer: string;
  models: { supervisor: string; worker: string };
};

export type Insights = {
  runs: number;
  sessions: number;
  messages: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  tokens: { input: number; output: number };
  routes: { agent: AgentId; count: number }[];
  safety: { routine: number; attention: number; urgent: number };
  daily: { date: string; runs: number }[];
  intake_completion: number;
};

export type Health = {
  status: string;
  model_mode: "live" | "mock";
  version: string;
};

export type ErrorEnvelope = {
  error: { code: string; message: string };
};

/* ------------------------------------------------------------------ */
/* SSE payloads                                                        */
/* ------------------------------------------------------------------ */

export type RunStartedData = {
  run_id: string;
  trace_id: string;
  session_id: string;
};

export type AgentEventData = {
  agent: AgentId;
  status: "started" | "finished";
  label: string;
};

export type TokenData = { text: string };

export type MemoryEventData = {
  count: number;
  items: string[];
};

export type ToolEventData = {
  name: string;
  args: Record<string, unknown>;
  status: "started" | "finished";
  preview: string | null;
};

export type InterruptData = {
  question: string;
  options: string[];
  field: string;
};

export type DoneData = {
  message_id: string;
  run_id: string;
  latency_ms: number;
  usage: { input_tokens: number; output_tokens: number };
  agents: AgentId[];
  citations: Citation[];
};

export type StreamErrorData = {
  code: string;
  message: string;
};

export type StreamEvent =
  | { type: "run_started"; data: RunStartedData }
  | { type: "agent"; data: AgentEventData }
  | { type: "token"; data: TokenData }
  | { type: "tool"; data: ToolEventData }
  | { type: "citation"; data: Citation }
  | { type: "intake"; data: IntakeSnapshot }
  | { type: "safety"; data: SafetyFlag }
  | { type: "memory"; data: MemoryEventData }
  | { type: "interrupt"; data: InterruptData }
  | { type: "done"; data: DoneData }
  | { type: "error"; data: StreamErrorData };

export type StreamEventName = StreamEvent["type"];

/* ------------------------------------------------------------------ */
/* UI-only helper types                                                */
/* ------------------------------------------------------------------ */

export type TimelineChip = {
  agent: AgentId;
  status: "pending" | "running" | "done";
  elapsedMs?: number;
  label?: string;
};

export type ToolChip = ToolEventData & {
  key: string;
};

export type UiMessage = Message & {
  streaming?: boolean;
  stopped?: boolean;
  tools?: ToolChip[];
  interrupt?: InterruptData | null;
  error?: string | null;
};

export type SlotKey =
  | "chief_complaint"
  | "onset"
  | "duration"
  | "severity"
  | "location"
  | "associated"
  | "history"
  | "medications"
  | "allergies";

export type ApiMode = "checking" | "live" | "demo";
