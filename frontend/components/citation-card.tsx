"use client";

import { Quote } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { scorePercent } from "@/lib/format";
import type { Citation } from "@/lib/types";

export type CitationCardProps = {
  citation: Citation;
  index: number;
  active?: boolean;
  variant?: "panel" | "report";
  onClick?: () => void;
  className?: string;
};

export const CitationCard = forwardRef<HTMLButtonElement, CitationCardProps>(
  function CitationCard(
    { citation, index, active = false, variant = "panel", onClick, className },
    ref,
  ) {
    const body = (
      <>
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-px grid shrink-0 place-items-center rounded-[5px] border border-cyan-200 bg-cyan-50 font-bold text-brand",
              variant === "panel" ? "size-4 text-[9px]" : "size-5 text-[10px]",
            )}
          >
            {index + 1}
          </span>
          <p
            className={cn(
              "min-w-0 flex-1 font-semibold leading-snug text-slate-700",
              variant === "panel" ? "line-clamp-2 text-[11px]" : "text-[12px]",
              onClick && "group-hover:text-brand",
            )}
          >
            {citation.title}
          </p>
          <span className="shrink-0 text-[9px] tabular-nums text-slate-400">
            {scorePercent(citation.score)}%
          </span>
        </div>
        <p className="mt-1 truncate text-[9.5px] text-slate-400">
          {citation.source}
          {citation.section ? ` · ${citation.section}` : ""}
        </p>
        <p
          className={cn(
            "mt-1.5 leading-relaxed text-slate-500",
            variant === "panel" ? "line-clamp-2 text-[10px]" : "text-[11px]",
          )}
        >
          {citation.snippet}
        </p>
        {variant === "report" ? (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0e7490,#14b8a6)]"
                style={{ width: `${scorePercent(citation.score)}%` }}
              />
            </div>
            <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
              <Quote className="size-2.5" aria-hidden />
              指南段落
            </span>
          </div>
        ) : null}
      </>
    );

    const base = cn(
      "w-full rounded-[11px] border bg-surface text-left transition-[border-color,box-shadow,background-color] duration-150",
      variant === "panel" ? "px-3 py-2.5" : "px-4 py-3.5",
      active
        ? "border-amber-300 bg-amber-50/50 shadow-[0_0_0_3px_rgba(217,119,6,.12)]"
        : "border-line",
      onClick &&
        "group hover:border-brand/25 hover:shadow-[0_2px_8px_-4px_rgba(15,23,42,.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-1",
      className,
    );

    if (!onClick) {
      return (
        <div data-testid="citation-card" className={base}>
          {body}
        </div>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        data-testid="citation-card"
        onClick={onClick}
        aria-label={`引用 ${index + 1}：${citation.title}`}
        className={base}
      >
        {body}
      </button>
    );
  },
);
