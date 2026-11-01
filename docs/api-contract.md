# MediFlow API Contract (v1)

The frontend and backend are developed against this document. Any change here is a breaking change for both.

- Base URL: `http://127.0.0.1:8000/api`
- All JSON is UTF-8. Times are ISO-8601 with offset.
- Auth: `Authorization: Bearer <jwt>` on every route except `/health`, `/auth/login`, `/auth/register`.

## Error envelope

```json
{ "error": { "code": "invalid_credentials", "message": "邮箱或密码不正确" } }
```

Codes: `invalid_credentials`, `email_taken`, `unauthorized`, `not_found`, `rate_limited`,
`file_too_large`, `unsupported_file`, `bad_request`, `upstream_unavailable`.

## Auth

### POST /auth/register
```json
{ "email": "demo@mediflow.ai", "password": "demo1234", "display_name": "体验用户" }
```
→ `201 { "access_token": "...", "token_type": "bearer", "user": { "id": "...", "email": "...", "display_name": "..." } }`

### POST /auth/login
```json
{ "email": "demo@mediflow.ai", "password": "demo1234" }
```
→ `200` same shape as register. A seeded demo account always exists: `demo@mediflow.ai` / `demo1234`.

### GET /me
→ `{ "id", "email", "display_name", "profile": PatientProfile | null }`

## Patient profile

### PUT /me/profile
```json
{
  "birth_year": 1990, "sex": "female", "height_cm": 165, "weight_kg": 55,
  "allergies": ["青霉素"], "conditions": ["高血压"], "medications": ["氨氯地平"],
  "smoker": "never", "summary": "……"
}
```
→ the stored `PatientProfile`.

```ts
type PatientProfile = {
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
```

## Sessions

### GET /sessions
→ `{ "sessions": SessionSummary[] }`

### POST /sessions
`{ "title"?: string }` → `201 SessionSummary`

### GET /sessions/{id}/messages
→ `{ "session": SessionSummary, "messages": Message[] }`

### DELETE /sessions/{id} → `204`

```ts
type SessionSummary = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
  safety_level: "routine" | "attention" | "urgent" | null;
};

type Message = {
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
```

## Chat (SSE)

### POST /chat/stream
```json
{ "session_id": "…", "message": "最近总是头晕，早上起来尤其明显" }
```
Response: `text/event-stream`. Each event is `event: <name>` + `data: <json>` + blank line.
The stream always ends with exactly one `done` or `error` event.

| event | data |
|---|---|
| `run_started` | `{ run_id, trace_id, session_id }` |
| `agent` | `{ agent, status: "started" \| "finished", label }` |
| `token` | `{ text }` |
| `tool` | `{ name, args, status: "started" \| "finished", preview }` |
| `citation` | `Citation` |
| `intake` | `IntakeSnapshot` |
| `safety` | `SafetyFlag` |
| `interrupt` | `{ question, options: string[], field }` — UI renders quick replies |
| `done` | `{ message_id, run_id, latency_ms, usage, agents: AgentId[], citations: Citation[] }` |
| `error` | `{ code, message }` |

```ts
type AgentId = "supervisor" | "triage" | "clinician" | "report" | "safety";

// `content` cites sources as 1-based indexes into the message's `citations` array,
// e.g. "…需要排除耳石症 [2]。" → citations[1]. Markers pointing at chunks that were not
// retrieved in this turn are stripped server-side, so an in-range marker is verifiable.
type Citation = {
  id: string;            // chunk id, e.g. "hypertension#2"
  title: string;
  source: string;        // e.g. "《中国高血压防治指南（2024年修订版）》"
  section: string;
  snippet: string;       // <= 220 chars
  score: number;         // 0..1
};

type IntakeSnapshot = {
  chief_complaint: string | null;
  onset: string | null;
  duration: string | null;
  severity: number | null;      // 0..10
  location: string | null;
  associated: string[];
  history: string[];
  medications: string[];
  allergies: string[];
  completeness: number;         // 0..1
  missing: string[];            // slot keys still needed
};

type SafetyFlag = {
  level: "routine" | "attention" | "urgent";
  flags: { code: string; label: string; rationale: string }[];
  action: string | null;        // e.g. "立即拨打 120"
};
```

## Reports

### POST /reports
`multipart/form-data` with `file` (PDF/TXT/CSV, ≤ 10 MB) → `202 { "report_id": "...", "status": "parsing" }`

Images are accepted by the UI but rejected by the parser with an actionable message: there
is no OCR pipeline, and the product says so instead of guessing at pixels.

### POST /reports/text
Paste values instead of uploading a file (the path the UI uses when OCR is unavailable):

```json
{ "text": "总胆固醇 6.1 mmol/L <5.2\n低密度脂蛋白 4.2 mmol/L <3.4", "filename": "粘贴的结果.txt" }
```
→ `202 { "report_id": "...", "status": "parsing" }`

### GET /reports/{id}
```ts
type ReportInsight = {
  id: string;
  filename: string;
  created_at: string;
  status: "parsing" | "ready" | "failed";
  patient_hint: { sex: string | null; age: number | null } | null;
  summary: string;
  markers: {
    name: string; value: string; unit: string | null;
    reference: string | null;
    status: "low" | "normal" | "high" | "critical";
    note: string;
  }[];
  questions_for_doctor: string[];
  citations: Citation[];
  disclaimer: string;
};
```

### GET /reports → `{ "reports": ReportInsight[] }` (markers omitted, `marker_count` instead)

## Meta & insights

### GET /meta/agents
```ts
type AgentCard = { id: AgentId; name: string; role: string; color: string; description: string };
```
→ `{ "agents": AgentCard[], "disclaimer": string, "models": { "supervisor": string, "worker": string } }`

### GET /insights/summary
```ts
type Insights = {
  runs: number;
  sessions: number;
  messages: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  tokens: { input: number; output: number };
  routes: { agent: AgentId; count: number }[];
  safety: { routine: number; attention: number; urgent: number };
  daily: { date: string; runs: number }[];
  intake_completion: number;   // 0..1
};
```

### GET /health → `{ "status": "ok", "model_mode": "live" | "mock", "version": "..." }`

## Safety rules the backend guarantees

1. No diagnosis, no prescription, no dosage. Output is triage + education + "questions for your doctor".
2. A red-flag hit short-circuits the flow: `safety.level = "urgent"`, and the message starts with the emergency action.
3. Every clinical claim carries at least one `citation` from the local guideline corpus.
