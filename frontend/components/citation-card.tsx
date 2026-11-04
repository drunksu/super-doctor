"use client";

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
    const panel = variant === "panel";

    const body = (
      <>
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "shrink-0 tabular-nums",
              panel ? "text-[12.5px] text-faint" : "text-[13px] text-muted",
            )}
          >
            [{index + 1}]
          </span>
          <p
            className={cn(
              "min-w-0 flex-1 font-semibold leading-[1.5] text-ink",
              panel ? "line-clamp-2 text-[13px]" : "text-[14px]",
              onClick && "group-hover:text-brand",
            )}
          >
            {citation.title}
          </p>
          <span className="shrink-0 text-[12.5px] tabular-nums text-faint">
            {scorePercent(citation.score)}%
          </span>
        </div>
        <p
          className={cn(
            "mt-1 leading-[1.6] text-faint",
            panel ? "truncate text-[12.5px]" : "text-[13px]",
          )}
        >
          {citation.source}
          {citation.section ? ` · ${citation.section}` : ""}
        </p>
        {panel ? null : (
          <p className="mt-1.5 text-[13px] leading-[1.65] text-muted">
            {citation.snippet}
          </p>
        )}
      </>
    );

    const base = cn(
      "w-full rounded-[8px] border text-left transition-colors duration-150",
      panel ? "px-2.5 py-2" : "px-4 py-3.5",
      active
        ? "border-brand/40 bg-brand-soft"
        : "border-line bg-surface",
      onClick &&
        "group hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1",
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
