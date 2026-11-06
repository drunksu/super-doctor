import {
  DEMO_MEMORIES,
  DEMO_PROFILE,
  DEMO_REPORT,
  DEMO_SESSIONS,
  DEMO_TRANSCRIPTS,
} from "./demo-fixtures";
import type {
  Memory,
  Message,
  PatientProfile,
  ReportInsight,
  SafetyFlag,
  SafetyLevel,
  SessionSummary,
} from "./types";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let sessions: SessionSummary[] = clone(DEMO_SESSIONS);
let demoProfile: PatientProfile = clone(DEMO_PROFILE);
let demoMemories: Memory[] = clone(DEMO_MEMORIES);
const transcripts = new Map<string, Message[]>(
  Object.entries(DEMO_TRANSCRIPTS).map(([id, messages]) => [id, clone(messages)]),
);

export function loadDemoProfile(): PatientProfile {
  return clone(demoProfile);
}

export function saveDemoProfile(profile: PatientProfile): PatientProfile {
  demoProfile = clone(profile);
  return clone(demoProfile);
}

export function loadDemoMemories(): Memory[] {
  return clone(demoMemories);
}

export function deleteDemoMemory(memoryId: string): void {
  demoMemories = demoMemories.filter((memory) => memory.id !== memoryId);
}

export function loadDemoSessions(): SessionSummary[] {
  return clone(sessions).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export function loadDemoMessages(sessionId: string): Message[] {
  return clone(transcripts.get(sessionId) ?? []);
}

export function createDemoSession(title: string): SessionSummary {
  const now = new Date().toISOString();
  const session: SessionSummary = {
    id: `demo-session-${Date.now().toString(36)}`,
    title: title.trim().slice(0, 24) || "新的问诊",
    created_at: now,
    updated_at: now,
    last_message: null,
    message_count: 0,
    safety_level: null,
  };
  sessions = [session, ...sessions];
  transcripts.set(session.id, []);
  return clone(session);
}

export function saveDemoConversation(
  sessionId: string,
  messages: Message[],
): SessionSummary | null {
  const clean = messages.map((message) => {
    const { ...rest } = message;
    return clone(rest);
  });
  transcripts.set(sessionId, clean);

  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) return null;

  const lastAssistant = [...clean]
    .reverse()
    .find((message) => message.role === "assistant");
  const lastAny = clean.length > 0 ? clean[clean.length - 1] : null;
  const safety =
    [...clean].reverse().find((message) => message.safety)?.safety ?? null;
  const safetyLevel: SafetyLevel | null = safety
    ? ((safety as SafetyFlag).level as SafetyLevel)
    : sessions[index].safety_level;

  const updated: SessionSummary = {
    ...sessions[index],
    updated_at: new Date().toISOString(),
    last_message: (lastAssistant?.content || lastAny?.content || "").slice(0, 80) || null,
    message_count: clean.length,
    safety_level: safetyLevel,
  };
  sessions[index] = updated;
  return clone(updated);
}

export function deleteDemoSession(sessionId: string): void {
  sessions = sessions.filter((session) => session.id !== sessionId);
  transcripts.delete(sessionId);
}

export function loadDemoReport(filename?: string): ReportInsight {
  const report = clone(DEMO_REPORT);
  if (filename) report.filename = filename;
  return report;
}
