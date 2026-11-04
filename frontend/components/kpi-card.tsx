import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "brand" | "violet" | "amber" | "emerald";

const TONES: Record<Tone, { icon: string; glow: string; value?: string }> = {
  brand: {
    icon: "border-cyan-100 bg-brand-soft text-brand",
    glow: "bg-cyan-200/35",
  },
  violet: {
    icon: "border-violet-100 bg-violet-50 text-violet-600",
    glow: "bg-violet-200/35",
  },
  amber: {
    icon: "border-amber-100 bg-amber-50 text-amber-600",
    glow: "bg-amber-200/35",
  },
  emerald: {
    icon: "border-emerald-100 bg-emerald-50 text-emerald-600",
    glow: "bg-emerald-200/35",
  },
};

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
  className,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const style = TONES[tone];
  return (
    <div className={cn("card relative overflow-hidden p-4", className)}>
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium uppercase tracking-[0.08em] text-faint">
          {label}
        </span>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-[8px] border",
            style.icon,
          )}
        >
          {icon}
        </span>
      </div>
      <p className="relative mt-2 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
        {value}
      </p>
      <p className="relative mt-1.5 text-[12.5px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}
