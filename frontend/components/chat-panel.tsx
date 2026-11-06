"use client";

import {
  ArrowDown,
  ArrowRight,
  FlaskConical,
  HeartPulse,
  Info,
  Menu,
  PanelLeft,
  PanelRight,
  Stethoscope,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentTimeline } from "@/components/agent-timeline";
import { Composer, type ComposerHandle } from "@/components/composer";
import { MessageBubble } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Citation, TimelineChip, UiMessage } from "@/lib/types";

const EXAMPLES = [
  {
    icon: HeartPulse,
    title: "早上起来头晕，站起来更明显",
    hint: "常见症状 · 体位性低血压",
  },
  {
    icon: FlaskConical,
    title: "体检报告说低密度脂蛋白偏高",
    hint: "报告解读 · 血脂管理",
  },
  {
    icon: Stethoscope,
    title: "孩子发烧 38.5℃，需要去医院吗？",
    hint: "儿科问题 · 就医指征",
  },
];

export type ChatPanelProps = {
  sessionKey: string;
  title: string;
  messages: UiMessage[];
  loading: boolean;
  streaming: boolean;
  timeline: TimelineChip[] | null;
  memories: string[] | null;
  runLatencyMs: number | null;
  disclaimer: string;
  highlight: { messageId: string; index: number } | null;
  listOpen: boolean;
  contextOpen: boolean;
  onToggleList: () => void;
  onToggleContext: () => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onCitationClick: (citation: Citation, index: number, messageId: string) => void;
  onOpenSessions: () => void;
  onOpenContext: () => void;
};

export function ChatPanel({
  sessionKey,
  title,
  messages,
  loading,
  streaming,
  timeline,
  memories,
  runLatencyMs,
  disclaimer,
  highlight,
  listOpen,
  contextOpen,
  onToggleList,
  onToggleContext,
  onSend,
  onStop,
  onCitationClick,
  onOpenSessions,
  onOpenContext,
}: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [pinned, setPinned] = useState(true);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<ComposerHandle>(null);

  const lastContentLength = messages.length
    ? messages[messages.length - 1].content.length
    : 0;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    setPinned(true);
  }, []);

  useEffect(() => {
    setPinned(true);
    const element = scrollRef.current;
    if (!element) return;
    const frame = requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [sessionKey]);

  useEffect(() => {
    if (!pinned) return;
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages.length, lastContentLength, streaming, pinned]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setPinned(distance < 72);
  }, []);

  const send = useCallback(
    (text?: string) => {
      const value = (text ?? draft).trim();
      if (!value || streaming) return;
      onSend(value);
      setDraft("");
      setPinned(true);
      requestAnimationFrame(() => {
        const element = scrollRef.current;
        if (element) element.scrollTop = element.scrollHeight;
      });
    },
    [draft, onSend, streaming],
  );

  const fillExample = (text: string) => {
    setDraft(text);
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  return (
    <section
      data-testid="chat-panel"
      className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-canvas"
      aria-label="问诊对话"
    >
      <div className="sr-only" role="status" aria-live="polite">
        {streaming
          ? "Super-Doctor 正在生成回答"
          : loading
            ? "正在加载会话"
            : messages.length > 0
              ? "回答已完成"
              : ""}
      </div>

      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenSessions}
          aria-label="打开问诊记录"
          className="lg:hidden"
        >
          <Menu className="size-[18px]" aria-hidden />
        </Button>

        {/* Both sidebar switches live here, as one pair. */}
        <div className="hidden items-center gap-0.5 lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleList}
            aria-pressed={listOpen}
            aria-label={listOpen ? "收起问诊记录" : "展开问诊记录"}
            className="text-muted hover:text-ink"
          >
            <PanelLeft className="size-[17px]" strokeWidth={1.8} aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleContext}
            aria-pressed={contextOpen}
            aria-label={contextOpen ? "收起患者上下文" : "展开患者上下文"}
            className="hidden text-muted hover:text-ink xl:inline-flex"
          >
            <PanelRight className="size-[17px]" strokeWidth={1.8} aria-hidden />
          </Button>
        </div>

        <h1 className="t-title ml-1.5 min-w-0 flex-1 truncate">{title}</h1>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onOpenContext}
          aria-label="查看患者上下文"
          className="xl:hidden"
        >
          <PanelRight className="size-[17px]" strokeWidth={1.8} aria-hidden />
        </Button>
      </header>

      <div className="shrink-0 border-b border-line">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-5">
          <p className="t-meta truncate">
            健康信息与就医建议，
            <span className="text-ink">不做诊断、不开处方</span>
          </p>
          <button
            type="button"
            onClick={() => setDisclaimerOpen((open) => !open)}
            aria-expanded={disclaimerOpen}
            aria-controls="disclaimer-detail"
            aria-label="查看完整免责声明"
            className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Info className="size-4" aria-hidden />
          </button>
        </div>
        {disclaimerOpen ? (
          <p
            id="disclaimer-detail"
            className="animate-fade-in border-t border-line px-3 py-2.5 text-[13px] leading-[1.7] text-muted sm:px-5"
          >
            {disclaimer}
          </p>
        ) : null}
      </div>

      {timeline ? (
        <AgentTimeline
          chips={timeline}
          running={streaming}
          latencyMs={runLatencyMs}
          memories={memories}
        />
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]"
        aria-live="off"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[800px] flex-col px-4 py-6 sm:px-6">
          {loading ? (
            <div className="space-y-7" aria-label="正在加载会话">
              {[0, 1, 2].map((item) => (
                <div key={item} className={cn("flex gap-3", item === 1 && "justify-end")}>
                  {item !== 1 ? <div className="skeleton size-8 rounded-[8px]" /> : null}
                  <div className={cn("space-y-2", item === 1 ? "w-[55%]" : "flex-1")}>
                    <div className="skeleton h-3 w-24" />
                    <div className="skeleton h-20 w-full rounded-[10px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center pb-6">
              <h2 className="t-display max-w-[620px]">
                把不舒服说清楚，
                <br className="sm:hidden" />
                剩下的交给 Super-Doctor
              </h2>

              <div className="mt-8 grid gap-2.5 sm:grid-cols-3">
                {EXAMPLES.map((example) => {
                  const Icon = example.icon;
                  return (
                    <button
                      key={example.title}
                      type="button"
                      onClick={() => fillExample(example.title)}
                      className={cn(
                        "group flex flex-col items-start gap-2 rounded-[12px] border border-line bg-surface px-4 py-3.5 text-left",
                        "transition-colors duration-150 hover:border-line-strong",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
                      )}
                    >
                      <Icon className="size-4 text-brand" strokeWidth={1.8} aria-hidden />
                      <span className="text-[15px] leading-[1.5] text-ink">
                        {example.title}
                      </span>
                      <span className="mt-auto flex w-full items-center justify-between gap-2 pt-1">
                        <span className="t-label">{example.hint}</span>
                        <ArrowRight
                          className="size-3.5 shrink-0 text-faint transition-transform duration-150 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  onCitationClick={onCitationClick}
                  onQuickReply={(text) => send(text)}
                  highlightIndex={
                    highlight?.messageId === message.id ? highlight.index : null
                  }
                />
              ))}
            </div>
          )}
        </div>

        {!pinned && messages.length > 0 ? (
          <div className="pointer-events-none sticky bottom-3 z-30 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              <ArrowDown className="size-3.5" aria-hidden />
              回到最新
            </button>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line px-3 pb-3 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-[800px]">
          <Composer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSend={(text) => send(text)}
            onStop={onStop}
            streaming={streaming}
          />
          <p className="mt-2 text-center text-[13px] leading-[1.5] text-faint">
            出现胸痛、呼吸困难、意识丧失等急症，请立即拨打 120 或前往急诊。
          </p>
        </div>
      </div>
    </section>
  );
}
