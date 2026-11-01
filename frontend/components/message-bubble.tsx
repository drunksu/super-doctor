"use client";

import { CircleCheck, Clock, Quote, Timer, ArrowUpRight } from "lucide-react";
import { AGENT_META, formatClock, formatLatency, formatNumber, toolDetail, toolLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AgentAvatar } from "@/components/agent-avatar";
import { SafetyBanner } from "@/components/safety-banner";
import { Spinner } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import type { Citation, ToolChip, UiMessage } from "@/lib/types";

type CitationHandler = (citation: Citation, index: number, messageId: string) => void;

/**
 * The stream emits a `started` and a `finished` tool event per retrieval. Showing both
 * produced two identical chips; keep one, upgraded to its finished state.
 */
function dedupeTools(tools: ToolChip[]): ToolChip[] {
  const byName = new Map<string, ToolChip>();
  for (const tool of tools) {
    const current = byName.get(tool.name);
    if (!current || tool.status === "finished") byName.set(tool.name, tool);
  }
  return [...byName.values()];
}

function CitationChip({
  index,
  citation,
  messageId,
  onCitationClick,
  highlighted,
}: {
  index: number;
  citation: Citation | undefined;
  messageId: string;
  onCitationClick?: CitationHandler;
  highlighted: boolean;
}) {
  const label = index + 1;
  const tooltip = citation ? (
    <span className="block w-[286px]">
      <span className="flex items-center gap-1.5">
        <span className="grid size-4 place-items-center rounded-[5px] bg-brand-soft text-[9px] font-bold text-brand">
          {label}
        </span>
        <span className="text-[10.5px] font-semibold text-ink">{citation.title}</span>
      </span>
      <span className="mt-1 block text-[10px] leading-relaxed text-muted">
        {citation.source}
        {citation.section ? ` · ${citation.section}` : ""}
      </span>
      <span className="mt-1.5 block border-t border-line pt-1.5 text-[10.5px] leading-relaxed text-slate-600">
        {citation.snippet}
      </span>
      <span className="mt-1 block text-[9.5px] text-slate-400">
        相关度 {Math.round(citation.score * 100)}%
      </span>
    </span>
  ) : (
    <span className="block w-[180px] text-[10.5px] text-muted">引用正在加载…</span>
  );

  return (
    <Tooltip content={tooltip} side="top" className="mx-0.5 align-baseline">
      <button
        type="button"
        id={`citation-chip-${messageId}-${index}`}
        onClick={() => citation && onCitationClick?.(citation, index, messageId)}
        aria-label={
          citation
            ? `引用 ${label}：${citation.title}，${citation.source}`
            : `引用 ${label}`
        }
        className={cn(
          "relative -top-[3px] inline-flex h-[16px] min-w-[17px] items-center justify-center rounded-[5px] border px-1 text-[9.5px] font-semibold leading-none transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1",
          citation
            ? "border-cyan-200 bg-cyan-50 text-brand hover:border-brand hover:bg-brand hover:text-white"
            : "border-slate-200 bg-slate-50 text-slate-400",
          highlighted && "ring-highlight ring-2 ring-amber-300",
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
}

function InlineText({
  text,
  message,
  citations,
  onCitationClick,
  highlightIndex,
}: {
  text: string;
  message: UiMessage;
  citations: Citation[];
  onCitationClick?: CitationHandler;
  highlightIndex: number | null;
}) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d{1,2}\])/g);
  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        if (bold) {
          return (
            <strong key={`b-${index}`} className="font-semibold text-ink">
              {bold[1]}
            </strong>
          );
        }
        const marker = /^\[(\d{1,2})\]$/.exec(part);
        if (marker) {
          const citationIndex = Number(marker[1]) - 1;
          return (
            <CitationChip
              key={`c-${index}`}
              index={citationIndex}
              citation={citations[citationIndex]}
              messageId={message.id}
              onCitationClick={onCitationClick}
              highlighted={highlightIndex === citationIndex}
            />
          );
        }
        return <span key={`t-${index}`}>{part}</span>;
      })}
    </>
  );
}

function RichContent({
  message,
  onCitationClick,
  highlightIndex,
}: {
  message: UiMessage;
  onCitationClick?: CitationHandler;
  highlightIndex: number | null;
}) {
  const content = message.content;
  const citations = message.citations;
  const hasMarkers = /\[\d{1,2}\]/.test(content);

  if (!content) {
    return (
      <div className="flex items-center gap-1.5 py-1.5" aria-label="正在生成回答">
        <span className="size-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.2s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.1s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
      </div>
    );
  }

  const lines = content.split("\n");
  const streaming = Boolean(message.streaming);

  return (
    <div className="text-[14px] leading-[1.85] text-slate-700 sm:text-[14.5px]">
      {lines.map((line, index) => {
        const isLast = index === lines.length - 1;
        const caret = isLast && streaming ? <span className="caret" aria-hidden /> : null;

        if (!line.trim()) {
          if (isLast && streaming) {
            return (
              <p key={index} className="min-h-[1.4em]">
                {caret}
              </p>
            );
          }
          return <div key={index} className="h-2.5" aria-hidden />;
        }

        const bullet = /^[·•]\s+(.*)$/.exec(line);
        if (bullet) {
          return (
            <div key={index} className="mt-1 flex gap-2 pl-0.5">
              <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-brand/45" aria-hidden />
              <p className="min-w-0 flex-1">
                <InlineText
                  text={bullet[1]}
                  message={message}
                  citations={citations}
                  onCitationClick={onCitationClick}
                  highlightIndex={highlightIndex}
                />
                {caret}
              </p>
            </div>
          );
        }

        const numbered = /^(\d+)[.、]\s+(.*)$/.exec(line);
        if (numbered) {
          return (
            <div key={index} className="mt-1 flex gap-2 pl-0.5">
              <span className="mt-[2px] grid size-[17px] shrink-0 place-items-center rounded-[5px] bg-slate-100 text-[10px] font-semibold text-slate-500">
                {numbered[1]}
              </span>
              <p className="min-w-0 flex-1">
                <InlineText
                  text={numbered[2]}
                  message={message}
                  citations={citations}
                  onCitationClick={onCitationClick}
                  highlightIndex={highlightIndex}
                />
                {caret}
              </p>
            </div>
          );
        }

        return (
          <p key={index} className="min-h-[1.4em]">
            <InlineText
              text={line}
              message={message}
              citations={citations}
              onCitationClick={onCitationClick}
              highlightIndex={highlightIndex}
            />
            {caret}
          </p>
        );
      })}

      {!hasMarkers && citations.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[10.5px] text-slate-400">
          <Quote className="size-3" aria-hidden />
          <span>引用</span>
          {citations.map((citation, index) => (
            <CitationChip
              key={`fallback-${citation.id}`}
              index={index}
              citation={citation}
              messageId={message.id}
              onCitationClick={onCitationClick}
              highlighted={highlightIndex === index}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MessageBubble({
  message,
  onCitationClick,
  onQuickReply,
  highlightIndex = null,
}: {
  message: UiMessage;
  onCitationClick?: CitationHandler;
  onQuickReply?: (text: string) => void;
  highlightIndex?: number | null;
}) {
  if (message.role === "user") {
    return (
      <div className="animate-fade-up flex justify-end" data-message-role="user">
        <div className="max-w-[86%] sm:max-w-[78%]">
          <div className="rounded-[16px] rounded-br-[6px] border border-cyan-100 bg-brand-soft px-4 py-2.5 text-[14px] leading-relaxed text-slate-800 shadow-[0_1px_2px_rgba(8,51,68,.05)]">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-400">
            <Clock className="size-2.5" aria-hidden />
            <span suppressHydrationWarning>{formatClock(message.created_at)}</span>
          </div>
        </div>
      </div>
    );
  }

  const meta = message.agent ? AGENT_META[message.agent] : AGENT_META.clinician;
  const showSafety = message.safety && message.safety.level !== "routine";
  const citations = message.citations;
  const hasMeta = Boolean(message.latency_ms != null || message.usage || citations.length > 0);

  return (
    <div className="animate-fade-up" data-message-role="assistant">
      <div className="flex gap-3">
        <AgentAvatar agent={message.agent ?? "clinician"} size="md" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[12px] font-semibold tracking-[-0.01em] text-ink">
              {meta.label}
            </span>
            <span className="rounded-full border border-line bg-surface px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-slate-400">
              {meta.name}
            </span>
            <span className="text-[10px] text-slate-300" aria-hidden>
              ·
            </span>
            <span className="text-[10.5px] text-muted" suppressHydrationWarning>
              {formatClock(message.created_at)}
            </span>
            {message.streaming ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-brand">
                <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
                生成中
              </span>
            ) : null}
          </div>

          {showSafety && message.safety ? (
            <SafetyBanner
              safety={message.safety}
              className="sticky top-0 z-20 mb-2.5 shadow-[0_8px_22px_-16px_rgba(15,23,42,.45)]"
            />
          ) : null}

          <div
            aria-busy={message.streaming || undefined}
            className="card px-4 py-3.5 sm:px-[18px]"
          >
            {message.tools && message.tools.length > 0 ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {dedupeTools(message.tools).map((tool) => {
                  const detail = toolDetail(tool.args);
                  return (
                    <span
                      key={tool.key}
                      title={tool.preview ?? undefined}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-1 text-[10.5px] text-muted"
                    >
                      {tool.status === "started" ? (
                        <Spinner className="size-2.5 text-brand" />
                      ) : (
                        <CircleCheck className="size-3 text-emerald-600" aria-hidden />
                      )}
                      <span className="font-medium text-slate-600">{toolLabel(tool.name)}</span>
                      {detail ? (
                        <>
                          <span className="text-slate-300" aria-hidden>
                            ·
                          </span>
                          <span>{detail}</span>
                        </>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            ) : null}

            <RichContent
              message={message}
              onCitationClick={onCitationClick}
              highlightIndex={highlightIndex}
            />

            {message.stopped ? (
              <p className="mt-2.5 border-t border-dashed border-line pt-2 text-[10.5px] text-slate-400">
                已停止生成 · 可以继续追问，或重新发送
              </p>
            ) : null}

            {message.error ? (
              <p
                role="alert"
                className="mt-2.5 rounded-[8px] border border-red-200 bg-red-50 px-2.5 py-2 text-[11.5px] text-red-700"
              >
                {message.error}
              </p>
            ) : null}

            {message.interrupt && !message.streaming ? (
              <div className="mt-3">
                <p className="text-[11px] text-muted">{message.interrupt.question}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.interrupt.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onQuickReply?.(option)}
                      className="group inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-brand-soft px-3 py-1.5 text-[11.5px] font-medium text-brand transition-colors hover:border-brand/50 hover:bg-cyan-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1"
                    >
                      {option}
                      <ArrowUpRight
                        className="size-3 text-brand/50 transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {hasMeta && !message.streaming ? (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line/80 pt-2.5 text-[10.5px] text-muted">
                {message.latency_ms != null ? (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="size-3 text-slate-400" aria-hidden />
                    用时{" "}
                    <span className="font-semibold tabular-nums text-slate-600">
                      {formatLatency(message.latency_ms)}
                    </span>
                  </span>
                ) : null}
                {message.usage ? (
                  <>
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span>
                      <span className="font-semibold tabular-nums text-slate-600">
                        {formatNumber(message.usage.input_tokens + message.usage.output_tokens)}
                      </span>{" "}
                      tokens
                    </span>
                  </>
                ) : null}
                {citations.length > 0 ? (
                  <>
                    <span className="text-slate-300" aria-hidden>
                      ·
                    </span>
                    <span>
                      <span className="font-semibold tabular-nums text-slate-600">
                        {citations.length}
                      </span>{" "}
                      条引用
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
