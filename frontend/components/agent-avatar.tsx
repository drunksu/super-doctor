"use client";

import {
  ClipboardList,
  FlaskConical,
  ShieldCheck,
  Stethoscope,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { AGENT_META } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AgentId } from "@/lib/types";

const ICONS: Record<AgentId, LucideIcon> = {
  supervisor: Workflow,
  triage: ClipboardList,
  clinician: Stethoscope,
  report: FlaskConical,
  safety: ShieldCheck,
};

const SIZES = {
  xs: "size-5 rounded-[6px]",
  sm: "size-7 rounded-[8px]",
  md: "size-9 rounded-[10px]",
  lg: "size-10 rounded-[12px]",
} as const;

const ICON_SIZES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-[18px]",
} as const;

export function AgentAvatar({
  agent,
  size = "md",
  className,
  muted = false,
}: {
  agent: AgentId;
  size?: keyof typeof SIZES;
  className?: string;
  muted?: boolean;
}) {
  const meta = AGENT_META[agent];
  const Icon = ICONS[agent];
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center text-white ring-1 ring-white/60",
        "shadow-[0_2px_6px_-2px_rgba(15,23,42,.3)]",
        SIZES[size],
        muted && "opacity-45 saturate-50",
        className,
      )}
      style={{ backgroundImage: meta.gradient }}
      aria-hidden
    >
      <Icon className={ICON_SIZES[size]} strokeWidth={2} />
    </span>
  );
}

export function agentIcon(agent: AgentId): LucideIcon {
  return ICONS[agent];
}
