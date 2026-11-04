import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-faint">{label}</span>
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] border border-line bg-surface-2 text-muted">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}
