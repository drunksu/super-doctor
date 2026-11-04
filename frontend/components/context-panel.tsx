"use client";

import { ArrowUpRight, Circle, CircleCheck, X } from "lucide-react";
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

function SectionTitle({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="font-ui text-[13px] font-medium text-muted">{title}</h3>
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
        "flex h-full w-full flex-col border-l border-line bg-surface-2",
        className,
      )}
      aria-label="患者上下文"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
        <h2 className="t-title min-w-0 flex-1 truncate">患者上下文</h2>
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Patient snapshot */}
        <section className="border-b border-line px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="t-title truncate">{patientName}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {sexLabel(profile?.sex ?? null)} · {age ? `${age} 岁` : "年龄未填"}
              </p>
            </div>
            <Link
              href="/settings"
              className="inline-flex shrink-0 items-center gap-0.5 rounded-[6px] px-1.5 py-0.5 text-[12.5px] text-muted transition-colors hover:text-brand"
              aria-label="编辑患者档案"
            >
              编辑
              <ArrowUpRight className="size-3" aria-hidden />
            </Link>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-2">
            <div>
              <dt className="font-ui text-[12.5px] text-faint">年龄</dt>
              <dd className="mt-0.5 text-[17px] leading-tight tabular-nums text-ink">
                {age ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="font-ui text-[12.5px] text-faint">性别</dt>
              <dd className="mt-0.5 text-[17px] leading-tight text-ink">
                {sexLabel(profile?.sex ?? null)}
              </dd>
            </div>
            <div>
              <dt className="font-ui text-[12.5px] text-faint">BMI</dt>
              <dd className="mt-0.5 text-[17px] leading-tight tabular-nums text-ink">
                {bmi ?? "—"}
                {bmi ? (
                  <span className="ml-1 font-ui text-[12.5px] text-muted">
                    {bmiLabel(bmi)}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="font-ui text-[12.5px] text-faint">过敏史</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile?.allergies.length ? (
                  profile.allergies.map((item) => (
                    <span
                      key={item}
                      className="rounded-[5px] bg-danger-soft px-1.5 py-0.5 font-ui text-[12.5px] text-danger"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-muted">无记录</span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="font-ui text-[12.5px] text-faint">基础病</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {profile?.conditions.length ? (
                  profile.conditions.map((item) => (
                    <span
                      key={item}
                      className="rounded-[5px] bg-warn-soft px-1.5 py-0.5 font-ui text-[12.5px] text-warn"
                    >
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-[13px] text-muted">无记录</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Structured intake */}
        <section className="border-b border-line px-4 py-4">
          <SectionTitle
            title="结构化问诊"
            extra={
              <Badge variant={percent >= 80 ? "ok" : percent > 0 ? "brand" : "neutral"}>
                {percent}%
              </Badge>
            }
          />
          <div
            className="h-[3px] overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="问诊信息完整度"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-[13px] leading-[1.6] text-muted">
            {intake
              ? missing > 0
                ? `已完成 ${SLOT_ORDER.length - missing} 项，还差 ${missing} 项`
                : "信息较完整，可以给出更有针对性的建议"
              : "开始问诊后，关键信息会在这里自动补全"}
          </p>

          <ul className="mt-2 grid grid-cols-2 gap-x-3">
            {SLOT_ORDER.map((slot) => {
              const value = slotValue(intake, slot);
              const filled = Boolean(value);
              return (
                <li key={slot} className="flex items-baseline gap-1.5 py-[3px]">
                  {filled ? (
                    <CircleCheck className="size-3 shrink-0 self-center text-brand" aria-hidden />
                  ) : (
                    <Circle className="size-3 shrink-0 self-center text-line-strong" aria-hidden />
                  )}
                  <span className="w-[54px] shrink-0 whitespace-nowrap font-ui text-[12.5px] text-faint">
                    {SLOT_LABELS[slot]}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[13px]",
                      filled ? "text-ink" : "text-faint",
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
          <section className="border-b border-line px-4 py-4">
            <SectionTitle
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
        <section className="px-4 py-4">
          <SectionTitle
            title="引用来源"
            extra={
              citations.length > 0 ? (
                <span className="text-[12.5px] tabular-nums text-faint">
                  {citations.length} 条
                </span>
              ) : undefined
            }
          />
          {citations.length === 0 ? (
            <p className="text-[13px] leading-[1.6] text-faint">
              本次回答暂未引用指南，给出回答后会列出出处。
            </p>
          ) : (
            <div className="space-y-1.5">
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
