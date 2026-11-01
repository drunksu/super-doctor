"use client";

import {
  ArrowDown,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  CircleX,
  FlaskConical,
  HeartPulse,
  Info,
  Menu,
  PanelRight,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AgentAvatar } from "@/components/agent-avatar";
import { AgentTimeline } from "@/components/agent-timeline";
import { Composer, type ComposerHandle } from "@/components/composer";
import { DemoBadge } from "@/components/demo-badge";
import { MessageBubble } from "@/components/message-bubble";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { AGENT_META, AGENT_ORDER } from "@/lib/format";
import type { Citation, TimelineChip, UiMessage } from "@/lib/types";

const EXAMPLES = [
  {
    icon: HeartPulse,
    title: "早上起来头晕，站起来更明显",
    hint: "常见症状 · 体位性低血压",
    tone: "bg-cyan-50 text-brand border-cyan-100",
  },
  {
    icon: FlaskConical,
    title: "体检报告说低密度脂蛋白偏高",
    hint: "报告解读 · 血脂管理",
    tone: "bg-violet-50 text-violet-700 border-violet-100",
  },
  {
    icon: Stethoscope,
    title: "孩子发烧 38.5℃，需要去医院吗？",
    hint: "儿科问题 · 就医指征",
    tone: "bg-amber-50 text-amber-700 border-amber-100",
  },
];

export type ChatPanelProps = {
  sessionKey: string;
  title: string;
  subtitle: string;
  messages: UiMessage[];
  loading: boolean;
  streaming: boolean;
  timeline: TimelineChip[] | null;
  runLatencyMs: number | null;
  demo: boolean;
  disclaimer: string;
  highlight: { messageId: string; index: number } | null;
  onSend: (text: string) => void;
  onStop: () => void;
  onCitationClick: (citation: Citation, index: number, messageId: string) => void;
  onOpenSessions: () => void;
  onOpenContext: () => void;
};

export function ChatPanel({
  sessionKey,
  title,
  subtitle,
  messages,
  loading,
  streaming,
  timeline,
  runLatencyMs,
  demo,
  disclaimer,
  highlight,
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
      className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-canvas/40"
      aria-label="问诊对话"
    >
      <div className="sr-only" role="status" aria-live="polite">
        {streaming
          ? "MediFlow 正在生成回答"
          : loading
            ? "正在加载会话"
            : messages.length > 0
              ? "回答已完成"
              : ""}
      </div>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-sm sm:px-4 xl:px-6">
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

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
              {title}
            </h1>
            <button
              type="button"
              onClick={() => setDisclaimerOpen((open) => !open)}
              aria-expanded={disclaimerOpen}
              className="hidden shrink-0 items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[9.5px] font-medium text-muted transition-colors hover:border-brand/25 hover:text-brand sm:inline-flex"
            >
              <ShieldCheck className="size-3 text-brand/70" aria-hidden />
              免责声明
            </button>
            {demo ? <DemoBadge className="shrink-0" /> : null}
          </div>
          <p className="mt-0.5 truncate text-[10.5px] text-muted">{subtitle}</p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenContext}
          className="h-8 shrink-0 gap-1.5 rounded-[9px] px-2.5 xl:hidden"
          aria-label="查看患者上下文"
        >
          <PanelRight className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">上下文</span>
        </Button>
      </header>

      <div className="shrink-0 border-b border-line bg-[#fbfcfd]">
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted sm:px-4 xl:px-6">
          <ShieldCheck className="size-3.5 shrink-0 text-brand/60" aria-hidden />
          <p className="truncate">
            MediFlow 提供健康信息与就医建议，
            <span className="font-medium text-slate-600">不做诊断、不开处方</span>。
          </p>
          <button
            type="button"
            onClick={() => setDisclaimerOpen((open) => !open)}
            aria-expanded={disclaimerOpen}
            aria-controls="disclaimer-detail"
            aria-label="查看完整免责声明"
            className="ml-auto grid size-6 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
          >
            <Info className="size-3.5" aria-hidden />
          </button>
        </div>
        {disclaimerOpen ? (
          <div
            id="disclaimer-detail"
            className="animate-fade-in border-t border-line/70 bg-surface px-4 pb-3 pt-2.5 text-[11px] leading-relaxed text-slate-600 sm:px-5 xl:px-7"
          >
            <p>{disclaimer}</p>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-3">
              <li className="flex items-start gap-1.5">
                <CircleCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" aria-hidden />
                回答标注指南出处，可逐条回看
              </li>
              <li className="flex items-start gap-1.5">
                <CircleX className="mt-0.5 size-3 shrink-0 text-slate-400" aria-hidden />
                不做疾病诊断，不开具处方
              </li>
              <li className="flex items-start gap-1.5">
                <Info className="mt-0.5 size-3 shrink-0 text-amber-500" aria-hidden />
                紧急情况请立即拨打 120
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      {timeline ? (
        <AgentTimeline chips={timeline} running={streaming} latencyMs={runLatencyMs} />
      ) : null}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        aria-live="off"
      >
        <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col px-3 py-5 sm:px-4 sm:py-6 xl:px-6">
          {loading ? (
            <div className="space-y-6" aria-label="正在加载会话">
              {[0, 1, 2].map((item) => (
                <div key={item} className={cn("flex gap-3", item === 1 && "justify-end")}>
                  {item !== 1 ? <div className="skeleton size-9 rounded-[10px]" /> : null}
                  <div className={cn("space-y-2", item === 1 ? "w-[55%]" : "flex-1")}>
                    <div className="skeleton h-3 w-24" />
                    <div className="skeleton h-20 w-full rounded-[14px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center py-4">
              <div className="animate-fade-up text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-brand-soft px-2.5 py-1 text-[10.5px] font-medium text-brand">
                  <Sparkles className="size-3" aria-hidden />
                  多智能体协同 · 指南可溯源
                </span>
                <h2 className="mx-auto mt-4 max-w-[560px] text-[25px] font-semibold leading-[1.28] tracking-[-0.035em] text-ink sm:text-[29px]">
                  把不舒服说清楚，
                  <br className="sm:hidden" />
                  剩下的交给 <span className="gradient-text">MediFlow</span>
                </h2>
                <p className="mx-auto mt-3 max-w-[500px] text-[12px] leading-relaxed text-muted sm:text-[12.5px]">
                  分诊、结构化问诊、全科建议、报告解读与安全审查五个智能体分工协作，
                  每一步都引用可查证的中文临床指南。
                </p>
              </div>

              <div className="mt-7 grid gap-2.5 sm:grid-cols-3">
                {EXAMPLES.map((example, index) => {
                  const Icon = example.icon;
                  return (
                    <button
                      key={example.title}
                      type="button"
                      onClick={() => fillExample(example.title)}
                      className={cn(
                        "card group flex flex-col items-start gap-2 p-3.5 text-left transition-[transform,border-color,box-shadow] duration-200",
                        "hover:-translate-y-0.5 hover:border-brand/25 hover:shadow-[0_2px_4px_rgba(15,23,42,.05),0_18px_36px_-20px_rgba(14,116,144,.35)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2",
                        "animate-fade-up",
                      )}
                      style={{ animationDelay: `${120 + index * 60}ms` }}
                    >
                      <span
                        className={cn(
                          "grid size-8 place-items-center rounded-[9px] border",
                          example.tone,
                        )}
                      >
                        <Icon className="size-4" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="text-[12.5px] font-medium leading-snug text-ink">
                        {example.title}
                      </span>
                      <span className="mt-auto flex w-full items-center justify-between gap-2 pt-1">
                        <span className="text-[9.5px] text-slate-400">{example.hint}</span>
                        <ArrowRight
                          className="size-3 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
                          aria-hidden
                        />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
                <span className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  能做什么
                </span>
                {["三甲指南检索", "红旗症状分诊", "结构化问诊"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50/70 px-2 py-0.5 text-[10px] text-emerald-700"
                  >
                    <CircleCheck className="size-2.5" aria-hidden />
                    {label}
                  </span>
                ))}
                <span className="ml-1 text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  不能做什么
                </span>
                {["不做诊断", "不开处方"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500"
                  >
                    <CircleX className="size-2.5" aria-hidden />
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-6 hidden items-center justify-center gap-1.5 rounded-[12px] border border-line bg-surface/70 px-4 py-2.5 sm:flex">
                <span className="mr-1 text-[9.5px] font-medium uppercase tracking-[0.12em] text-slate-400">
                  协同流程
                </span>
                {AGENT_ORDER.map((agent, index) => (
                  <div key={agent} className="flex items-center gap-1.5">
                    <AgentAvatar agent={agent} size="xs" />
                    <span className="text-[10px] font-medium text-slate-500">
                      {AGENT_META[agent].label}
                    </span>
                    {index < AGENT_ORDER.length - 1 ? (
                      <ChevronRight className="size-3 text-slate-300" aria-hidden />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
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
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 text-[10.5px] font-medium text-slate-600 shadow-[0_6px_20px_-8px_rgba(15,23,42,.3)] backdrop-blur transition-colors hover:border-brand/30 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              <ArrowDown className="size-3" aria-hidden />
              回到最新
            </button>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-line bg-[linear-gradient(180deg,rgba(246,248,250,.4),#f6f8fa_38%)] px-3 pb-3 pt-2.5 sm:px-4 sm:pb-4 xl:px-6">
        <div className="mx-auto w-full max-w-[780px]">
          <Composer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSend={(text) => send(text)}
            onStop={onStop}
            streaming={streaming}
          />
          <p className="mt-1.5 text-center text-[9.5px] leading-relaxed text-slate-400">
            出现胸痛、呼吸困难、意识丧失等急症，请立即拨打 120 或前往急诊。
          </p>
        </div>
      </div>
    </section>
  );
}
