"use client";

import {
  ClipboardList,
  FlaskConical,
  ShieldCheck,
  Stethoscope,
  Workflow,
  type LucideIcon,
} from "lucide-react";
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
  xs: "size-5 rounded-[5px]",
  sm: "size-6 rounded-[6px]",
  md: "size-8 rounded-[8px]",
  lg: "size-9 rounded-[9px]",
} as const;

const ICON_SIZES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-[18px]",
} as const;

/**
 * One accent, one neutral: the agent is named in the text next to it, so the
 * mark stays monochrome instead of running five competing gradients.
 */
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
  const Icon = ICONS[agent];
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center border border-line bg-surface text-muted",
        SIZES[size],
        muted && "opacity-55",
        className,
      )}
      aria-hidden
    >
      <Icon className={ICON_SIZES[size]} strokeWidth={1.8} />
    </span>
  );
}

export function agentIcon(agent: AgentId): LucideIcon {
  return ICONS[agent];
}
