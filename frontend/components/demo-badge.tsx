import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/cn";

export function DemoBadge({
  className,
  label = "演示模式",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700",
        className,
      )}
      title="未连接后端：当前使用本地脚本化数据，不影响界面体验"
    >
      <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
      {label}
    </span>
  );
}

export function DemoBadgeLarge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700",
        className,
      )}
      title="未连接后端：当前使用本地脚本化数据，不影响界面体验"
    >
      <FlaskConical className="size-3" aria-hidden />
      演示模式 · 本地脚本
    </span>
  );
}
