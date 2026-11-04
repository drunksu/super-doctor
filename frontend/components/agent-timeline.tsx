import { CircleCheck } from "lucide-react";
import { Spinner } from "@/components/ui/skeleton";
import { AGENT_META, formatLatency } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TimelineChip } from "@/lib/types";

/**
 * A quiet run band: one line of agent names with a hairline between them,
 * instead of five coloured pills competing with the answer.
 */
export function AgentTimeline({
  chips,
  running,
  latencyMs,
  className,
}: {
  chips: TimelineChip[];
  running: boolean;
  latencyMs?: number | null;
  className?: string;
}) {
  const doneCount = chips.filter((chip) => chip.status === "done").length;

  return (
    <div
      data-testid="agent-timeline"
      className={cn(
        "flex shrink-0 items-center gap-3 border-b border-line px-4 py-2",
        className,
      )}
      aria-label="智能体运行时间线"
    >
      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
        <span
          className={cn(
            "size-1.5 rounded-full",
            running ? "animate-pulse bg-brand" : "bg-line-strong",
          )}
          aria-hidden
        />
        <span className="text-[13px] text-muted">
          {running ? "运行中" : "本次运行"}
        </span>
      </span>

      <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {chips.map((chip, index) => {
          const meta = AGENT_META[chip.agent];
          const label = chip.label ?? meta.label;
          return (
            <div key={chip.agent} className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1 text-[13px]",
                  chip.status === "running" && "text-brand",
                  chip.status === "done" && "text-muted",
                  chip.status === "pending" && "text-faint",
                )}
                aria-label={`${label}：${
                  chip.status === "running"
                    ? "运行中"
                    : chip.status === "done"
                      ? "已完成"
                      : "未启动"
                }${chip.elapsedMs ? `，${formatLatency(chip.elapsedMs)}` : ""}`}
              >
                {chip.status === "running" ? (
                  <Spinner className="size-3 text-brand" />
                ) : chip.status === "done" ? (
                  <CircleCheck className="size-3.5 text-brand" aria-hidden />
                ) : null}
                {label}
                {chip.status === "done" && chip.elapsedMs ? (
                  <span className="tabular-nums text-[12.5px] text-faint">
                    {formatLatency(chip.elapsedMs)}
                  </span>
                ) : null}
              </span>
              {index < chips.length - 1 ? (
                <span className="h-px w-3 shrink-0 bg-line-strong" aria-hidden />
              ) : null}
            </div>
          );
        })}
      </div>

      <span className="hidden shrink-0 text-[12.5px] tabular-nums text-faint sm:block">
        {running ? (
          <span>
            {doneCount}/{chips.length}
          </span>
        ) : latencyMs ? (
          <span>总耗时 {formatLatency(latencyMs)}</span>
        ) : (
          <span>
            {doneCount}/{chips.length}
          </span>
        )}
      </span>
    </div>
  );
}
