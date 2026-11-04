import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "neutral" | "brand" | "ok" | "warn" | "danger" | "info" | "outline";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  neutral: "border-line bg-surface text-muted",
  brand: "border-transparent bg-brand-soft text-brand",
  ok: "border-transparent bg-brand-soft text-brand",
  warn: "border-transparent bg-warn-soft text-warn",
  danger: "border-transparent bg-danger-soft text-danger",
  info: "border-line bg-surface text-muted",
  outline: "border-line bg-transparent text-muted",
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
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border font-ui font-medium tabular-nums",
        size === "sm" ? "px-1.5 py-0.5 text-[12.5px]" : "px-2 py-0.5 text-[13px]",
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
      ? "bg-danger"
      : level === "attention"
        ? "bg-warn"
        : level === "routine"
          ? "bg-brand"
          : "bg-line-strong";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("size-2 rounded-full", tone)} aria-hidden />
      {label ? <span className="text-[13px] text-muted">{label}</span> : null}
    </span>
  );
}
