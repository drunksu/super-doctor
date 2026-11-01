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
        "relative overflow-hidden rounded-[12px] border",
        urgent
          ? "border-red-200 bg-[linear-gradient(115deg,#fef2f2_0%,#fffafa_72%)]"
          : "border-amber-200 bg-[linear-gradient(115deg,#fffbeb_0%,#fffdf7_72%)]",
        compact ? "p-3" : "px-3.5 py-3",
        className,
      )}
    >
      <div className="flex gap-2.5">
        <span
          className={cn(
            "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full",
            urgent ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600",
          )}
          aria-hidden
        >
          {urgent ? <ShieldAlert className="size-4" /> : <TriangleAlert className="size-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className={cn(
                "text-[12.5px] font-semibold tracking-[-0.01em]",
                urgent ? "text-red-800" : "text-amber-800",
              )}
            >
              {urgent ? "该症状组合可能需要紧急处理" : "需要留意的症状线索"}
            </p>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[9.5px] font-semibold",
                urgent ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
              )}
            >
              {urgent ? "紧急" : "需关注"}
            </span>
          </div>

          {safety.flags.length > 0 ? (
            <ul className={cn("mt-1.5 space-y-0.5", compact && "space-y-1")}>
              {safety.flags.map((flag) => (
                <li
                  key={flag.code}
                  className={cn(
                    "flex gap-1.5 text-[11.5px] leading-relaxed",
                    urgent ? "text-red-700/90" : "text-amber-800/90",
                  )}
                >
                  <span className="mt-[7px] size-1 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
                  <span>
                    <span className="font-medium">{flag.label}</span>
                {!compact ? (
                <span className="text-current/80">：{flag.rationale}</span>
              ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {safety.action ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {urgent && hasEmergencyNumber ? (
                <a
                  href="tel:120"
                  className="inline-flex h-7 items-center gap-1.5 rounded-[7px] bg-red-600 px-2.5 text-[11.5px] font-semibold text-white shadow-[0_2px_6px_-2px_rgba(220,38,38,.6)] transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
                  aria-label="拨打 120 急救电话"
                >
                  <Phone className="size-3" aria-hidden />
                  拨打 120
                </a>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-medium",
                    urgent ? "text-red-700" : "text-amber-800",
                  )}
                >
                  <CircleAlert className="size-3" aria-hidden />
                  {safety.action}
                </span>
              )}
              {urgent && hasEmergencyNumber && safety.action !== "立即拨打 120" ? (
                <span className="text-[11px] text-red-600/80">{safety.action}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
