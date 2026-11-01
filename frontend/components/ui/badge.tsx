import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "neutral" | "brand" | "ok" | "warn" | "danger" | "info" | "outline";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  brand: "border-cyan-100 bg-brand-soft text-brand",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  outline: "border-line bg-surface text-muted",
};

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  size?: Size;
  dot?: boolean;
};

export function Badge({
  className,
  variant = "neutral",
  size = "sm",
  dot = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function StatusDot({
  level,
  className,
  label,
}: {
  level: "routine" | "attention" | "urgent" | null;
  className?: string;
  label?: ReactNode;
}) {
  const tone =
    level === "urgent"
      ? "bg-red-500 shadow-[0_0_0_3px_rgba(220,38,38,.12)]"
      : level === "attention"
        ? "bg-amber-500 shadow-[0_0_0_3px_rgba(217,119,6,.12)]"
        : level === "routine"
          ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(5,150,105,.12)]"
          : "bg-slate-300";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("size-2 rounded-full", tone)} aria-hidden />
      {label ? <span className="text-[11px] text-muted">{label}</span> : null}
    </span>
  );
}
