import { CircleCheck } from "lucide-react";
import { AgentAvatar, agentIcon } from "@/components/agent-avatar";
import { Spinner } from "@/components/ui/skeleton";
import { AGENT_META, formatLatency } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { TimelineChip } from "@/lib/types";

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
        "flex shrink-0 items-center gap-3 border-b border-line bg-surface/70 px-4 py-2.5 xl:px-4",
        className,
      )}
      aria-label="智能体运行时间线"
    >
      <div className="hidden shrink-0 items-center gap-1.5 2xl:flex">
        <span
          className={cn(
            "size-1.5 rounded-full",
            running ? "animate-pulse bg-brand" : "bg-emerald-500",
          )}
          aria-hidden
        />
        <span className="text-[10.5px] font-medium tracking-wide text-muted">
          {running ? "运行中" : "本次运行"}
        </span>
      </div>

      <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-0.5">
        {chips.map((chip, index) => {
          const meta = AGENT_META[chip.agent];
          const Icon = agentIcon(chip.agent);
          const label = chip.label ?? meta.label;
          return (
            <div key={chip.agent} className="flex shrink-0 items-center">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full border py-1 pl-1 pr-1.5 transition-colors duration-200",
                  chip.status === "running" && "border-brand/30 bg-brand-soft text-brand",
                  chip.status === "done" && "border-emerald-200/80 bg-emerald-50/60 text-emerald-800",
                  chip.status === "pending" && "border-line bg-surface text-slate-400",
                )}
                aria-label={`${label}：${
                  chip.status === "running"
                    ? "运行中"
                    : chip.status === "done"
                      ? "已完成"
                      : "未启动"
                }${chip.elapsedMs ? `，${formatLatency(chip.elapsedMs)}` : ""}`}
              >
                <span className="hidden min-[1440px]:inline-flex">
                  <AgentAvatar agent={chip.agent} size="xs" muted={chip.status === "pending"} />
                </span>
                <span className="text-[10.5px] font-medium">{label}</span>
                {chip.status === "running" ? (
                  <Spinner className="size-2.5 text-brand" />
                ) : chip.status === "done" ? (
                  <CircleCheck className="size-3 text-emerald-600" aria-hidden />
                ) : (
                  <Icon className="size-3 text-slate-300" aria-hidden />
                )}
                {chip.status === "done" && chip.elapsedMs ? (
                  <span className="tabular-nums text-[9.5px] text-emerald-600/80">
                    {formatLatency(chip.elapsedMs)}
                  </span>
                ) : null}
              </div>
              {index < chips.length - 1 ? (
                <span
                  className={cn(
                    "mx-0.5 h-px w-1.5",
                    chip.status === "done" && chips[index + 1]?.status !== "pending"
                      ? "bg-emerald-300/80"
                      : "bg-line",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden shrink-0 text-[10.5px] text-muted 2xl:block">
        {running ? (
          <span className="tabular-nums">
            {doneCount}/{chips.length} 完成
          </span>
        ) : latencyMs ? (
          <span>
            总耗时{" "}
            <span className="font-semibold tabular-nums text-ink">{formatLatency(latencyMs)}</span>
          </span>
        ) : (
          <span>{doneCount}/{chips.length} 完成</span>
        )}
      </div>
    </div>
  );
}
