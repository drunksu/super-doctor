"use client";

import {
  ArrowUpRight,
  ClipboardList,
  Circle,
  CircleCheck,
  PanelRight,
  Quote,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { CitationCard } from "@/components/citation-card";
import { SafetyBanner } from "@/components/safety-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  SLOT_LABELS,
  SLOT_ORDER,
  ageFromBirthYear,
  bmiFromProfile,
  bmiLabel,
  sexLabel,
} from "@/lib/format";
import type {
  Citation,
  IntakeSnapshot,
  PatientProfile,
  SafetyFlag,
  SlotKey,
} from "@/lib/types";

function slotValue(intake: IntakeSnapshot | null, key: SlotKey): string | null {
  if (!intake) return null;
  const value = intake[key];
  if (Array.isArray(value)) return value.length > 0 ? value.join("、") : null;
  if (key === "severity") {
    return value == null ? null : `${value}/10`;
  }
  return typeof value === "string" && value.trim() ? value : null;
}

function SectionTitle({
  icon,
  title,
  extra,
}: {
  icon: ReactNode;
  title: string;
  extra?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
        <span className="text-brand/80">{icon}</span>
        {title}
      </div>
      {extra}
    </div>
  );
}

export type ContextPanelProps = {
  profile: PatientProfile | null;
  patientName?: string;
  intake: IntakeSnapshot | null;
  safety: SafetyFlag | null;
  citations: Citation[];
  activeCitationId?: string | null;
  onCitationClick?: (citation: Citation, index: number) => void;
  className?: string;
  onClose?: () => void;
};

export function ContextPanel({
  profile,
  patientName = "体验用户",
  intake,
  safety,
  citations,
  activeCitationId,
  onCitationClick,
  className,
  onClose,
}: ContextPanelProps) {
  const citationRefs = useRef(new Map<string, HTMLButtonElement>());
  const age = ageFromBirthYear(profile?.birth_year ?? null);
  const bmi = bmiFromProfile(profile);
  const percent = Math.round((intake?.completeness ?? 0) * 100);
  const missing = intake?.missing.length ?? SLOT_ORDER.length;
  const nonRoutine = safety && safety.level !== "routine";

  useEffect(() => {
    if (!activeCitationId) return;
    const element = citationRefs.current.get(activeCitationId);
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeCitationId]);

  return (
    <aside
      data-testid="context-panel"
      className={cn(
        "flex h-full w-full flex-col border-l border-line bg-[#fbfcfd]",
        className,
      )}
      aria-label="患者上下文"
    >
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface/70 px-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <PanelRight className="size-3.5 text-brand/70" aria-hidden />
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
              患者上下文
            </h2>
          </div>
          <p className="mt-0.5 text-[10px] text-muted">问诊信息实时同步</p>
        </div>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="关闭患者上下文"
            className="xl:hidden"
          >
            <X className="size-4" aria-hidden />
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-3.5 py-3.5">
        {/* Patient snapshot */}
        <section className="rounded-[12px] border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          <div className="flex items-center gap-2">
            <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,#0f172a,#334155)] text-white">
              <UserRound className="size-3.5" strokeWidth={1.9} aria-hidden />
              <span
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-emerald-500"
                aria-hidden
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-ink">{patientName}</p>
              <p className="text-[9.5px] text-muted">
                {sexLabel(profile?.sex ?? null)} · {age ? `${age} 岁` : "年龄未填"} ·{" "}
                {profile?.smoker === "never" ? "不吸烟" : "档案"}
              </p>
            </div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-0.5 rounded-full border border-line px-1.5 py-0.5 text-[9px] text-muted transition-colors hover:border-brand/25 hover:text-brand"
              aria-label="编辑患者档案"
            >
              编辑
              <ArrowUpRight className="size-2.5" aria-hidden />
            </Link>
          </div>

          <div className="mt-2.5 grid grid-cols-3 divide-x divide-line rounded-[9px] border border-line bg-surface-2 py-1.5">
            <div className="px-2 text-center">
              <p className="text-[8.5px] text-slate-400">年龄</p>
              <p className="mt-0.5 text-[14px] font-semibold tabular-nums leading-tight text-ink">
                {age ?? "—"}
              </p>
            </div>
            <div className="px-2 text-center">
              <p className="text-[8.5px] text-slate-400">性别</p>
              <p className="mt-0.5 text-[14px] font-semibold leading-tight text-ink">
                {sexLabel(profile?.sex ?? null)}
              </p>
            </div>
            <div className="px-2 text-center">
              <p className="text-[8.5px] text-slate-400">BMI</p>
              <p className="mt-0.5 text-[14px] font-semibold tabular-nums leading-tight text-ink">
                {bmi ?? "—"}
              </p>
              <p className="text-[8px] text-slate-400">{bmi ? bmiLabel(bmi) : "未记录"}</p>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className="text-[8.5px] font-medium uppercase tracking-wide text-slate-400">
                过敏史
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {profile?.allergies.length ? (
                  profile.allergies.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-red-100 bg-red-50 px-1.5 py-px text-[9.5px] font-medium text-red-600"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-[9.5px] text-slate-400">无记录</span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8.5px] font-medium uppercase tracking-wide text-slate-400">
                基础病
              </p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {profile?.conditions.length ? (
                  profile.conditions.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-amber-100 bg-amber-50 px-1.5 py-px text-[9.5px] font-medium text-amber-700"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-[9.5px] text-slate-400">无记录</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Structured intake */}
        <section className="rounded-[12px] border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(15,23,42,.03)]">
          <SectionTitle
            icon={<ClipboardList className="size-3.5" />}
            title="结构化问诊"
            extra={
              <Badge variant={percent >= 80 ? "ok" : percent > 0 ? "brand" : "neutral"}>
                {percent}%
              </Badge>
            }
          />
          <div
            className="h-1 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="问诊信息完整度"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#0e7490,#0891b2,#14b8a6)] transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-[9.5px] text-muted">
            {intake
              ? missing > 0
                ? `已完成 ${SLOT_ORDER.length - missing} 项，还差 ${missing} 项信息`
                : "信息较完整，可以给出更有针对性的建议"
              : "开始问诊后，关键信息会在这里自动补全"}
          </p>

          <ul className="mt-1.5 grid grid-cols-2 gap-x-1 gap-y-0">
            {SLOT_ORDER.map((slot) => {
              const value = slotValue(intake, slot);
              const filled = Boolean(value);
              return (
                <li
                  key={slot}
                  className="flex items-start gap-1 rounded-[6px] px-0.5 py-[3px] transition-colors hover:bg-surface-2"
                >
                  {filled ? (
                    <CircleCheck className="mt-0.5 size-3 shrink-0 text-emerald-500" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 size-3 shrink-0 text-slate-200" aria-hidden />
                  )}
                  <span className="w-[38px] shrink-0 text-[9px] text-slate-400">
                    {SLOT_LABELS[slot]}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[9.5px]",
                      filled ? "font-medium text-slate-700" : "text-slate-300",
                    )}
                    title={value ?? undefined}
                  >
                    {value ?? "待补充"}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Safety */}
        {nonRoutine && safety ? (
          <section>
            <SectionTitle
              icon={<ShieldAlert className="size-3.5" />}
              title="安全提示"
              extra={
                <Badge variant={safety.level === "urgent" ? "danger" : "warn"} dot>
                  {safety.level === "urgent" ? "紧急" : "需关注"}
                </Badge>
              }
            />
            <SafetyBanner safety={safety} compact />
          </section>
        ) : null}

        {/* Citations */}
        <section>
          <SectionTitle
            icon={<Quote className="size-3.5" />}
            title="引用来源"
            extra={
              <span className="text-[9.5px] text-slate-400">
                {citations.length} 条 · 点击回看
              </span>
            }
          />
          {citations.length === 0 ? (
            <div className="rounded-[11px] border border-dashed border-line bg-surface/60 px-3 py-4 text-center">
              <Quote className="mx-auto size-4 text-slate-300" aria-hidden />
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                本次回答暂未引用指南
                <br />
                给出回答后会自动列出出处
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {citations.map((citation, index) => {
                const active = activeCitationId === citation.id;
                return (
                  <CitationCard
                    key={`${citation.id}-${index}`}
                    ref={(element) => {
                      if (element) citationRefs.current.set(citation.id, element);
                      else citationRefs.current.delete(citation.id);
                    }}
                    citation={citation}
                    index={index}
                    active={active}
                    onClick={() => onCitationClick?.(citation, index)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
