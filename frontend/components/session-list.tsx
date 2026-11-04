"use client";

import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        "flex h-full w-full flex-col border-r border-line bg-surface-2",
        className,
      )}
      aria-label="问诊记录列表"
    >
      <div className="shrink-0 px-3 pb-2 pt-3">
        <div className="flex h-8 items-center justify-between gap-2">
          <h2 className="t-title">问诊记录</h2>
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
          variant="secondary"
          onClick={onNew}
          className="mt-2 h-9 w-full justify-start rounded-[9px] border-line-control px-2.5 text-[13px]"
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden />
          新建问诊
        </Button>

        <div className="relative mt-2">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索问诊记录"
            aria-label="搜索问诊记录"
            className="h-9 pl-8 pr-8 text-[13px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="清除搜索"
              className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-ink"
            >
              <X className="size-3" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {loading ? (
          <div className="space-y-1 px-1 py-1">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="px-1.5 py-2">
                <Skeleton className="h-3.5 w-[78%]" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
            <p className="text-[13px] text-muted">
              {query ? "没有匹配的记录" : "还没有问诊记录"}
            </p>
            {!query ? (
              <button
                type="button"
                onClick={onNew}
                className="text-[13px] font-medium text-brand hover:underline"
              >
                开始第一次问诊
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((session) => {
              const active = session.id === activeId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSelect(session.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35",
                    active ? "bg-canvas" : "hover:bg-canvas/60",
                  )}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[14.5px] leading-[1.5]",
                      active
                        ? "font-semibold text-ink"
                        : "text-muted group-hover:text-ink",
                    )}
                  >
                    {session.title}
                  </span>
                  <span
                    className="hidden shrink-0 text-[12.5px] tabular-nums text-faint group-hover:block"
                    suppressHydrationWarning
                  >
                    {formatRelativeTime(session.updated_at)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
