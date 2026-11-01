"use client";

import {
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusDot } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import type { SessionSummary } from "@/lib/types";

export type SessionListProps = {
  sessions: SessionSummary[];
  activeId: string | null;
  loading?: boolean;
  className?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
};

export function SessionList({
  sessions,
  activeId,
  loading = false,
  className,
  onSelect,
  onNew,
  onClose,
}: SessionListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;
    return sessions.filter((session) =>
      `${session.title} ${session.last_message ?? ""}`.toLowerCase().includes(needle),
    );
  }, [query, sessions]);

  return (
    <aside
      data-testid="session-list"
      className={cn(
        "flex h-full w-full flex-col border-r border-line bg-surface/75",
        className,
      )}
      aria-label="问诊记录列表"
    >
      <div className="shrink-0 border-b border-line px-3.5 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
              问诊记录
            </h2>
            <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9.5px] font-medium text-slate-500">
              {sessions.length}
            </span>
          </div>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="关闭问诊记录"
              className="lg:hidden"
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={onNew}
          className="mt-3 h-9 w-full justify-start rounded-[10px] px-3"
        >
          <Plus className="size-4" strokeWidth={2.4} aria-hidden />
          新建问诊
        </Button>

        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索问诊记录"
            aria-label="搜索问诊记录"
            className="h-9 pl-8 pr-8 text-[12px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清除搜索"
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="space-y-2 px-1 py-1">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="rounded-[12px] border border-transparent px-2 py-2.5">
                <Skeleton className="h-3.5 w-[82%]" />
                <Skeleton className="mt-2 h-2.5 w-full" />
                <Skeleton className="mt-2 h-2.5 w-24" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-400">
              <Search className="size-4" aria-hidden />
            </span>
            <p className="text-[11.5px] text-muted">
              {query ? "没有匹配的问诊记录" : "还没有问诊记录"}
            </p>
            {!query ? (
              <button
                type="button"
                onClick={onNew}
                className="text-[11px] font-medium text-brand hover:underline"
              >
                开始第一次问诊
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((session) => {
              const active = session.id === activeId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelect(session.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group relative w-full rounded-[11px] border px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1",
                    active
                      ? "border-cyan-200/90 bg-brand-soft/80 shadow-[inset_3px_0_0_var(--primary),0_1px_2px_rgba(15,23,42,.03)]"
                      : "border-transparent hover:border-line hover:bg-surface",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <h3
                      className={cn(
                        "line-clamp-2 min-w-0 flex-1 text-[12.5px] font-medium leading-[1.45]",
                        active ? "text-brand-strong" : "text-ink",
                      )}
                    >
                      {session.title}
                    </h3>
                    <StatusDot level={session.safety_level} className="mt-1 shrink-0" />
                  </div>
                  <p
                    className={cn(
                      "mt-1 line-clamp-1 text-[10.5px] leading-relaxed",
                      active ? "text-cyan-800/60" : "text-muted",
                    )}
                  >
                    {session.last_message ?? "新的问诊，等待你的描述"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2.5 text-[9.5px] text-slate-400">
                    <span suppressHydrationWarning>
                      {formatRelativeTime(session.updated_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="size-2.5" aria-hidden />
                      <span className="tabular-nums">{session.message_count}</span>
                    </span>
                    {session.safety_level === "urgent" ? (
                      <span className="font-medium text-red-500">含紧急提示</span>
                    ) : session.safety_level === "attention" ? (
                      <span className="font-medium text-amber-600">含关注提示</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex gap-2 rounded-[10px] border border-line bg-surface-2 px-2.5 py-2.5">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-brand/60" aria-hidden />
          <p className="text-[10px] leading-relaxed text-muted">
            回答均标注指南来源，点击正文中的引用角标即可回看原文段落。
          </p>
        </div>
      </div>
    </aside>
  );
}
