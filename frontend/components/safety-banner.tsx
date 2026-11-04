import { CircleAlert, Phone, ShieldAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SafetyFlag } from "@/lib/types";

export function SafetyBanner({
  safety,
  compact = false,
  className,
}: {
  safety: SafetyFlag;
  compact?: boolean;
  className?: string;
}) {
  if (safety.level === "routine") return null;

  const urgent = safety.level === "urgent";
  const hasEmergencyNumber = Boolean(safety.action && /120|急救|急诊/.test(safety.action));

  return (
    <div
      data-testid={compact ? undefined : "safety-banner"}
      role={compact ? undefined : "alert"}
      className={cn(
        "rounded-[10px] border",
        urgent ? "border-danger/25 bg-danger-soft" : "border-warn/25 bg-warn-soft",
        compact ? "p-3" : "px-3.5 py-3",
        className,
      )}
    >
      <div className="flex gap-2.5">
        <span
          className={cn("mt-0.5 shrink-0", urgent ? "text-danger" : "text-warn")}
          aria-hidden
        >
          {urgent ? (
            <ShieldAlert className="size-[18px]" strokeWidth={2} />
          ) : (
            <TriangleAlert className="size-[18px]" strokeWidth={2} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className={cn(
                "text-[15px] font-semibold leading-[1.45]",
                urgent ? "text-danger" : "text-warn",
              )}
            >
              {urgent ? "该症状组合可能需要紧急处理" : "需要留意的症状线索"}
            </p>
            <span
              className={cn(
                "rounded-[4px] px-1.5 py-px font-ui text-[12.5px] font-medium",
                urgent ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn",
              )}
            >
              {urgent ? "紧急" : "需关注"}
            </span>
          </div>

          {safety.flags.length > 0 ? (
            <ul className={cn("mt-1.5 space-y-1")}>
              {safety.flags.map((flag) => (
                <li
                  key={flag.code}
                  className={cn(
                    "flex gap-1.5 text-[13px] leading-[1.6]",
                    urgent ? "text-danger" : "text-warn",
                  )}
                >
                  <span
                    className="mt-[9px] size-1 shrink-0 rounded-full bg-current opacity-70"
                    aria-hidden
                  />
                  <span>
                    <span className="font-medium">{flag.label}</span>
                    {!compact ? <span className="opacity-80">：{flag.rationale}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {safety.action ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {urgent && hasEmergencyNumber ? (
                <a
                  href="tel:120"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[7px] bg-danger px-2.5 font-ui text-[13px] font-medium text-white transition-colors hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40 focus-visible:ring-offset-2"
                  aria-label="拨打 120 急救电话"
                >
                  <Phone className="size-3.5" aria-hidden />
                  拨打 120
                </a>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-ui text-[13px] font-medium",
                    urgent ? "text-danger" : "text-warn",
                  )}
                >
                  <CircleAlert className="size-3.5" aria-hidden />
                  {safety.action}
                </span>
              )}
              {urgent && hasEmergencyNumber && safety.action !== "立即拨打 120" ? (
                <span className="font-ui text-[13px] text-danger/90">{safety.action}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
