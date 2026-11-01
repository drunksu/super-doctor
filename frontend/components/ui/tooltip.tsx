"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  tone?: "light" | "dark";
  className?: string;
  contentClassName?: string;
};

export function Tooltip({
  content,
  children,
  side = "top",
  tone = "light",
  className,
  contentClassName,
}: TooltipProps) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      <span className="inline-flex">{children}</span>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute z-50 w-max max-w-[340px] rounded-[10px] border px-3 py-2 text-left opacity-0 shadow-[0_10px_30px_-12px_rgba(15,23,42,.3)] transition-opacity duration-150",
          "group-hover/tt:visible group-hover/tt:opacity-100 group-focus-within/tt:visible group-focus-within/tt:opacity-100",
          side === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
          side === "bottom" && "top-full left-1/2 mt-2 -translate-x-1/2",
          side === "right" && "left-full top-1/2 ml-3 -translate-y-1/2",
          side === "left" && "right-full top-1/2 mr-3 -translate-y-1/2",
          tone === "dark"
            ? "border-slate-800 bg-slate-900 text-[11px] font-medium text-white"
            : "border-line bg-surface text-ink",
          contentClassName,
        )}
      >
        {content}
      </span>
    </span>
  );
}
