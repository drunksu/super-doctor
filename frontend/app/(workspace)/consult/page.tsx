"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppMode } from "@/components/app-mode-provider";
import { ChatPanel } from "@/components/chat-panel";
import { ContextPanel } from "@/components/context-panel";
import { SessionList } from "@/components/session-list";
import {
  ApiError,
  clearSession,
  createSession,
  getSessionMessages,
  isAbortError,
  listSessions,
} from "@/lib/api";
import { DEMO_DISCLAIMER } from "@/lib/demo-fixtures";
import { buildDemoStream, replayDemoStream } from "@/lib/demo-script";
import {
  createDemoSession,
  loadDemoMessages,
  loadDemoProfile,
  loadDemoSessions,
  saveDemoConversation,
} from "@/lib/demo-store";
import { AGENT_ORDER } from "@/lib/format";
import { streamChat } from "@/lib/sse";
import { cn } from "@/lib/cn";
import type {
  AgentId,
  Citation,
  SessionSummary,
  StreamEvent,
  TimelineChip,
  UiMessage,
} from "@/lib/types";

function initialTimeline(): TimelineChip[] {
  return AGENT_ORDER.map((agent) => ({ agent, status: "pending" }));
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

type MobilePanel = "sessions" | "context" | null;

export default function ConsultPage() {
  const { mode, user } = useAppMode();
  const isLive = mode === "live";

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [timeline, setTimeline] = useState<TimelineChip[] | null>(null);
  const [runLatency, setRunLatency] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const [listOpen, setListOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(true);
  const [highlight, setHighlight] = useState<{ messageId: string; index: number } | null>(
    null,
  );
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<Partial<Record<AgentId, number>>>({});
  const messagesRef = useRef<UiMessage[]>([]);
  const persistRef = useRef(false);
  const highlightTimer = useRef<number | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refreshLiveSessions = useCallback(async () => {
    if (!isLive) return;
    try {
      const list = await listSessions();
      setSessions(list);
    } catch {
      /* the list keeps its optimistic state */
    }
  }, [isLive]);

  useEffect(() => {
    if (mode === "checking") return;
    let cancelled = false;
    abortRef.current?.abort();
    setSessionsLoading(true);
    setActiveId(null);
    setMessages([]);
    setTimeline(null);
    setRunLatency(null);
    setActiveCitationId(null);
    setHighlight(null);
    setMobilePanel(null);

    const request = isLive ? listSessions() : Promise.resolve(loadDemoSessions());
    request
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch((error) => {
        if (!cancelled) {
          if (error instanceof ApiError && error.code === "unauthorized") {
            clearSession();
            setNotice("登录已过期，已切换到本地演示模式");
          } else {
            setNotice("无法连接后端，已切换到本地演示数据");
          }
          setSessions(loadDemoSessions());
        }
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, isLive]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!mobilePanel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobilePanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobilePanel]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
    };
  }, []);

  // Persist a finished demo conversation back into the in-memory demo store.
  useEffect(() => {
    if (streaming) return;
    if (!persistRef.current) return;
    persistRef.current = false;
    if (isLive || !activeId) return;
    const summary = saveDemoConversation(activeId, messagesRef.current);
    if (summary) {
      setSessions((previous) =>
        previous.map((session) => (session.id === summary.id ? summary : session)),
      );
    }
  }, [streaming, activeId, isLive]);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeId) ?? null,
    [activeId, sessions],
  );

  const latestCitations = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === "assistant" && message.citations.length > 0) {
        return { messageId: message.id, citations: message.citations };
      }
    }
    return { messageId: null, citations: [] as Citation[] };
  }, [messages]);

  const intake = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.intake) return message.intake;
    }
    return null;
  }, [messages]);

  const safety = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.safety) return message.safety;
    }
    return null;
  }, [messages]);

  const profile = isLive ? (user?.profile ?? null) : loadDemoProfile();
  const patientName = user?.display_name ?? (isLive ? "访客" : "体验用户");

  const title = activeSession?.title ?? "新问诊";

  const selectSession = useCallback(
    async (id: string) => {
      if (streaming) return;
      setMobilePanel(null);
      setHighlight(null);
      setActiveCitationId(null);
      if (activeId === id) return;

      setActiveId(id);
      setMessagesLoading(true);
      setTimeline(null);
      setRunLatency(null);

      try {
        if (isLive) {
          const data = await getSessionMessages(id);
          setMessages(data.messages);
          setSessions((previous) =>
            previous.map((session) => (session.id === id ? data.session : session)),
          );
        } else {
          const session = sessions.find((item) => item.id === id);
          if (!session) {
            throw new ApiError("not_found", "没有找到这条问诊记录");
          }
          setMessages(loadDemoMessages(id));
        }
      } catch (error) {
        setMessages([]);
        setNotice(error instanceof ApiError ? error.message : "加载问诊记录失败");
      } finally {
        setMessagesLoading(false);
      }
    },
    [activeId, isLive, sessions, streaming],
  );

  const startNewSession = useCallback(() => {
    if (streaming) abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setMessagesLoading(false);
    setTimeline(null);
    setRunLatency(null);
    setHighlight(null);
    setActiveCitationId(null);
    setMobilePanel(null);
  }, [streaming]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setNotice(null);
      setHighlight(null);
      setActiveCitationId(null);
      setMessages((previous) =>
        previous.map((message) =>
          message.interrupt ? { ...message, interrupt: null } : message,
        ),
      );

      let sessionId = activeId;
      if (!sessionId) {
        if (isLive) {
          try {
            const created = await createSession(trimmed.slice(0, 30));
            setSessions((previous) => [created, ...previous]);
            sessionId = created.id;
          } catch (error) {
            if (error instanceof ApiError && error.code === "unauthorized") {
              clearSession();
            }
            setNotice(
              error instanceof ApiError ? error.message : "新建问诊失败，请稍后重试",
            );
            return;
          }
        } else {
          const created = createDemoSession(trimmed);
          setSessions((previous) => [created, ...previous]);
          sessionId = created.id;
        }
        setActiveId(sessionId);
      }

      const now = new Date().toISOString();
      const assistantId = makeId("stream");
      const userMessage: UiMessage = {
        id: makeId("user"),
        role: "user",
        content: trimmed,
        agent: null,
        created_at: now,
        citations: [],
        intake: null,
        safety: null,
        latency_ms: null,
        usage: null,
      };
      const assistantMessage: UiMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        agent: "clinician",
        created_at: now,
        citations: [],
        intake: null,
        safety: null,
        latency_ms: null,
        usage: null,
        streaming: true,
        tools: [],
      };

      setMessages((previous) => [...previous, userMessage, assistantMessage]);
      setSessions((previous) =>
        previous.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                message_count: session.message_count + 1,
                last_message: trimmed.slice(0, 80),
                updated_at: now,
              }
            : session,
        ),
      );
      setStreaming(true);
      setTimeline(initialTimeline());
      setRunLatency(null);
      startedAtRef.current = {};
      persistRef.current = !isLive;

      const controller = new AbortController();
      abortRef.current = controller;
      const targetSessionId = sessionId;

      const updateAssistant = (updater: (message: UiMessage) => UiMessage) => {
        setMessages((previous) =>
          previous.map((message) => (message.id === assistantId ? updater(message) : message)),
        );
      };

      const handleEvent = (event: StreamEvent) => {
        switch (event.type) {
          case "run_started":
            break;
          case "agent": {
            const { agent, status, label } = event.data;
            if (status === "started") {
              startedAtRef.current[agent] = performance.now();
              setTimeline((previous) =>
                previous
                  ? previous.map((chip) =>
                      chip.agent === agent
                        ? { ...chip, status: "running", label: label || chip.label }
                        : chip,
                    )
                  : previous,
              );
            } else {
              const startedAt = startedAtRef.current[agent];
              const elapsed =
                startedAt != null
                  ? Math.max(1, Math.round(performance.now() - startedAt))
                  : undefined;
              setTimeline((previous) =>
                previous
                  ? previous.map((chip) =>
                      chip.agent === agent
                        ? {
                            ...chip,
                            status: "done",
                            label: label || chip.label,
                            elapsedMs: elapsed ?? chip.elapsedMs,
                          }
                        : chip,
                    )
                  : previous,
              );
            }
            break;
          }
          case "token":
            updateAssistant((message) => ({
              ...message,
              content: message.content + event.data.text,
            }));
            break;
          case "tool":
            updateAssistant((message) => {
              const key = `${event.data.name}:${JSON.stringify(event.data.args ?? {})}`;
              const tools = message.tools ?? [];
              const existing = tools.findIndex((tool) => tool.key === key);
              if (existing === -1) {
                return { ...message, tools: [...tools, { ...event.data, key }] };
              }
              const next = [...tools];
              next[existing] = { ...next[existing], ...event.data, key };
              return { ...message, tools: next };
            });
            break;
          case "citation":
            updateAssistant((message) =>
              message.citations.some((citation) => citation.id === event.data.id)
                ? message
                : { ...message, citations: [...message.citations, event.data] },
            );
            break;
          case "intake":
            updateAssistant((message) => ({ ...message, intake: event.data }));
            break;
          case "safety":
            updateAssistant((message) => ({ ...message, safety: event.data }));
            break;
          case "interrupt":
            updateAssistant((message) => ({ ...message, interrupt: event.data }));
            break;
          case "done": {
            setRunLatency(event.data.latency_ms);
            updateAssistant((message) => ({
              ...message,
              streaming: false,
              latency_ms: event.data.latency_ms,
              usage: event.data.usage,
              citations:
                event.data.citations.length > 0
                  ? event.data.citations
                  : message.citations,
            }));
            setTimeline((previous) =>
              previous
                ? previous.map((chip) =>
                    chip.status === "running" ? { ...chip, status: "done" } : chip,
                  )
                : previous,
            );
            setStreaming(false);
            break;
          }
          case "error":
            updateAssistant((message) => ({
              ...message,
              streaming: false,
              error: event.data.message,
            }));
            setNotice(event.data.message);
            setStreaming(false);
            break;
          default:
            break;
        }
      };

      try {
        if (isLive) {
          await streamChat(
            { session_id: targetSessionId, message: trimmed },
            { signal: controller.signal, onEvent: handleEvent },
          );
        } else {
          const steps = buildDemoStream({
            message: trimmed,
            sessionId: targetSessionId,
          });
          await replayDemoStream(steps, {
            signal: controller.signal,
            onEvent: handleEvent,
          });
        }
      } catch (error) {
        if (isAbortError(error)) {
          updateAssistant((message) => ({
            ...message,
            streaming: false,
            stopped: true,
          }));
        } else {
          const message =
            error instanceof ApiError ? error.message : "连接中断，请稍后重试";
          if (error instanceof ApiError && error.code === "unauthorized") {
            clearSession();
          }
          updateAssistant((assistant) => ({
            ...assistant,
            streaming: false,
            error: message,
          }));
          setNotice(message);
        }
      } finally {
        setStreaming(false);
        setTimeline((previous) =>
          previous
            ? previous.map((chip) =>
                chip.status === "running" ? { ...chip, status: "pending" } : chip,
              )
            : previous,
        );
        updateAssistant((message) =>
          message.streaming ? { ...message, streaming: false } : message,
        );
        abortRef.current = null;
        if (isLive) void refreshLiveSessions();
      }
    },
    [activeId, isLive, refreshLiveSessions, streaming],
  );

  const focusCitationCard = useCallback((citation: Citation) => {
    setActiveCitationId(citation.id);
    if (window.innerWidth < 1280) setMobilePanel("context");
  }, []);

  const focusCitationChunk = useCallback(
    (citation: Citation, index: number) => {
      setActiveCitationId(citation.id);
      if (!latestCitations.messageId) return;
      setHighlight({ messageId: latestCitations.messageId, index });
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlight(null), 2600);
      if (window.innerWidth < 1280) setMobilePanel(null);
      window.setTimeout(() => {
        const element = document.getElementById(
          `citation-chip-${latestCitations.messageId}-${index}`,
        );
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 140);
    },
    [latestCitations.messageId],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden">
      <div
        className={cn(
          "hidden h-full shrink-0 overflow-hidden lg:block",
          listOpen ? "w-[272px]" : "w-0",
        )}
      >
        <SessionList
          sessions={sessions}
          activeId={activeId}
          loading={sessionsLoading}
          onSelect={(id) => void selectSession(id)}
          onNew={startNewSession}
        />
      </div>

      <ChatPanel
        sessionKey={activeId ?? "draft"}
        title={title}
        messages={messages}
        loading={messagesLoading}
        streaming={streaming}
        timeline={timeline}
        runLatencyMs={runLatency}
        disclaimer={DEMO_DISCLAIMER}
        highlight={highlight}
        listOpen={listOpen}
        contextOpen={contextOpen}
        onToggleList={() => setListOpen((open) => !open)}
        onToggleContext={() => setContextOpen((open) => !open)}
        onSend={(text) => void handleSend(text)}
        onStop={handleStop}
        onCitationClick={(citation) => focusCitationCard(citation)}
        onOpenSessions={() => setMobilePanel("sessions")}
        onOpenContext={() => setMobilePanel("context")}
      />

      <div
        className={cn(
          "hidden h-full shrink-0 overflow-hidden xl:block",
          contextOpen ? "w-[336px]" : "w-0",
        )}
      >
        <ContextPanel
          profile={profile}
          patientName={patientName}
          intake={intake}
          safety={safety}
          citations={latestCitations.citations}
          activeCitationId={activeCitationId}
          onCitationClick={focusCitationChunk}
        />
      </div>

      {mobilePanel === "sessions" ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="问诊记录">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMobilePanel(null)}
            aria-label="关闭问诊记录"
          />
          <div className="animate-slide-in-left absolute inset-y-0 left-0 w-[88%] max-w-[330px] overflow-hidden border-r border-line bg-surface-2">
            <SessionList
              sessions={sessions}
              activeId={activeId}
              loading={sessionsLoading}
              onSelect={(id) => void selectSession(id)}
              onNew={startNewSession}
              onClose={() => setMobilePanel(null)}
            />
          </div>
        </div>
      ) : null}

      {mobilePanel === "context" ? (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="患者上下文">
          <button
            type="button"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMobilePanel(null)}
            aria-label="关闭患者上下文"
          />
          <div className="animate-slide-in-right absolute inset-y-0 right-0 w-[90%] max-w-[380px] overflow-hidden border-l border-line bg-surface-2">
            <ContextPanel
              profile={profile}
              patientName={patientName}
              intake={intake}
              safety={safety}
              citations={latestCitations.citations}
              activeCitationId={activeCitationId}
              onCitationClick={focusCitationChunk}
              onClose={() => setMobilePanel(null)}
            />
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-4">
          <div
            role="status"
            className="pointer-events-auto flex max-w-[92%] items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[13px] text-ink shadow-[var(--shadow-pop)]"
          >
            <span className="truncate">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="关闭提示"
              className="grid size-4 shrink-0 place-items-center rounded-full text-faint hover:text-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
