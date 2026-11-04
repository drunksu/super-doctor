import { ArrowDown, ArrowUp, Minus, TriangleAlert } from "lucide-react";
import { MARKER_STATUS_META } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MarkerStatus, ReportMarker } from "@/lib/types";

const STATUS_ICONS: Record<MarkerStatus, typeof ArrowUp> = {
  low: ArrowDown,
  normal: Minus,
  high: ArrowUp,
  critical: TriangleAlert,
};

export function MarkerTable({
  markers,
  className,
}: {
  markers: ReportMarker[];
  className?: string;
}) {
  return (
    <div
      data-testid="marker-table"
      className={cn(
        "overflow-hidden rounded-[12px] border border-line bg-surface",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">检验指标明细与解读</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2 text-[12.5px] uppercase tracking-[0.1em] text-faint">
              <th scope="col" className="px-4 py-2.5 font-medium">
                检测指标
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                结果
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                参考范围
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                状态
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                要不要紧
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/80">
            {markers.map((marker, index) => {
              const meta = MARKER_STATUS_META[marker.status];
              const Icon = STATUS_ICONS[marker.status];
              const abnormal = marker.status !== "normal";
              return (
                <tr
                  key={`${marker.name}-${index}`}
                  className={cn(
                    "group transition-colors",
                    marker.status === "critical"
                      ? "bg-red-50/40 hover:bg-red-50/60"
                      : abnormal
                        ? "bg-amber-50/20 hover:bg-amber-50/40"
                        : "hover:bg-surface-2",
                  )}
                >
                  <td className="max-w-[240px] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          marker.status === "critical"
                            ? "bg-red-500"
                            : marker.status === "high"
                              ? "bg-amber-500"
                              : marker.status === "low"
                                ? "bg-sky-500"
                                : "bg-emerald-500",
                        )}
                        aria-hidden
                      />
                      <span className="text-[13px] font-medium leading-[1.5] text-ink">
                        {marker.name}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <span className="text-[12.5px] font-semibold tabular-nums text-ink">
                      {marker.value}
                    </span>
                    {marker.unit ? (
                      <span className="ml-1 text-[12.5px] text-faint">{marker.unit}</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] tabular-nums text-muted">
                    {marker.reference ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12.5px] font-medium",
                        meta.className,
                      )}
                    >
                      <Icon className="size-2.5" aria-hidden />
                      {meta.label}
                    </span>
                  </td>
                  <td className="max-w-[340px] px-4 py-3">
                    <p className="text-[13px] leading-[1.5] text-muted">
                      {marker.note || "暂无补充说明"}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2/60 px-4 py-2">
        <p className="text-[12.5px] text-faint">
          共 {markers.length} 项指标 ·{" "}
          {markers.filter((marker) => marker.status !== "normal").length} 项异常
        </p>
        <div className="flex items-center gap-3">
          {(["low", "normal", "high", "critical"] as MarkerStatus[]).map((status) => (
            <span
              key={status}
              className="inline-flex items-center gap-1 text-[12.5px] text-faint"
            >
              <span
                className="size-1.5 rounded-full"
                style={{ backgroundColor: MARKER_STATUS_META[status].dot }}
                aria-hidden
              />
              {MARKER_STATUS_META[status].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
