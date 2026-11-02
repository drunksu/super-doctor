"use client";

import {
  Check,
  Circle,
  CircleCheck,
  ClipboardCopy,
  FileText,
  FileWarning,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppMode } from "@/components/app-mode-provider";
import { CitationCard } from "@/components/citation-card";
import { DemoBadgeLarge } from "@/components/demo-badge";
import { MarkerTable } from "@/components/marker-table";
import { UploadZone } from "@/components/upload-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getReport, listReports, uploadReport } from "@/lib/api";
import { cn } from "@/lib/cn";
import { loadDemoReport } from "@/lib/demo-store";
import { formatDate, sexLabel } from "@/lib/format";
import type { ReportInsight } from "@/lib/types";

type Phase = "idle" | "uploading" | "parsing" | "ready" | "failed";

const PARSE_STEPS = [
  { label: "上传文件", detail: "安全接收 PDF / 图片", icon: FileText },
  { label: "识别指标", detail: "抽取名称、数值与单位", icon: ScanLine },
  { label: "生成解读", detail: "对照参考范围并引用指南", icon: Sparkles },
];

export default function ReportsPage() {
  const { mode } = useAppMode();
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState<ReportInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [pendingName, setPendingName] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const timers = useRef<number[]>([]);
  const alive = useRef(true);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
    timers.current = [];
  }, []);

  const track = useCallback((timer: number) => {
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // Show the most recent report from history, if the backend has one. Without this the
  // page always looked empty even though /api/reports had data.
  useEffect(() => {
    if (mode !== "live") return;
    let cancelled = false;
    (async () => {
      try {
        const history = await listReports();
        if (cancelled || history.length === 0) return;
        const latest = await getReport(history[0].id);
        if (cancelled) return;
        setReport(latest);
        setPhase("ready");
        setProgress(100);
      } catch {
        /* keep the upload zone */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const startProgress = useCallback(
    (from: number) => {
      setProgress(from);
      const interval = window.setInterval(() => {
        setProgress((value) =>
          value >= 92 ? value : Math.min(92, value + Math.max(1, Math.round((94 - value) / 9))),
        );
      }, 260);
      track(interval);
    },
    [track],
  );

  const loadDemo = useCallback(
    (filename?: string) => {
      clearTimers();
      setError(null);
      setReport(null);
      setChecked(new Set());
      setPendingName(filename ?? "2026-05-年度体检报告.pdf");
      setPhase("parsing");
      startProgress(14);
      const timer = window.setTimeout(() => {
        if (!alive.current) return;
        clearTimers();
        setReport(loadDemoReport(filename));
        setProgress(100);
        setPhase("ready");
      }, 1400);
      track(timer);
    },
    [clearTimers, startProgress, track],
  );

  const poll = useCallback(
    async (id: string, attempt: number): Promise<void> => {
      try {
        const data = await getReport(id);
        if (!alive.current) return;
        if (data.status === "ready") {
          clearTimers();
          setReport(data);
          setProgress(100);
          setPhase("ready");
          return;
        }
        if (data.status === "failed") {
          clearTimers();
          setPhase("failed");
          setError("报告解析失败，请更换文件后重试");
          return;
        }
        setProgress((value) => Math.min(92, value + 3));
        track(window.setTimeout(() => void poll(id, attempt + 1), 1300));
      } catch (pollError) {
        if (!alive.current) return;
        if (attempt >= 4) {
          clearTimers();
          setPhase("failed");
          setError(
            pollError instanceof ApiError
              ? pollError.message
              : "报告解析超时，请稍后重试",
          );
          return;
        }
        track(window.setTimeout(() => void poll(id, attempt + 1), 1600));
      }
    },
    [clearTimers, track],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setReport(null);
      setChecked(new Set());
      setPendingName(file.name);

      if (mode !== "live") {
        loadDemo(file.name);
        return;
      }

      setPhase("uploading");
      setProgress(4);
      try {
        const uploaded = await uploadReport(file);
        if (!alive.current) return;
        setPhase("parsing");
        startProgress(12);
        void poll(uploaded.report_id, 0);
      } catch (uploadError) {
        if (!alive.current) return;
        setPhase("failed");
        setError(
          uploadError instanceof ApiError
            ? uploadError.message
            : "上传失败，请检查网络后重试",
        );
      }
    },
    [loadDemo, mode, poll, startProgress],
  );

  const reset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setReport(null);
    setError(null);
    setProgress(0);
    setChecked(new Set());
    setPendingName("");
    setCopied(false);
  }, [clearTimers]);

  const toggleQuestion = (index: number) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const copyQuestions = async () => {
    if (!report) return;
    const text = report.questions_for_doctor
      .map((question, index) => `${index + 1}. ${question}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      track(window.setTimeout(() => setCopied(false), 1800));
    } catch {
      setError("复制失败，请手动选择问题文本");
    }
  };

  const counts = report
    ? {
        high: report.markers.filter((marker) => marker.status === "high").length,
        low: report.markers.filter((marker) => marker.status === "low").length,
        normal: report.markers.filter((marker) => marker.status === "normal").length,
        critical: report.markers.filter((marker) => marker.status === "critical").length,
      }
    : { high: 0, low: 0, normal: 0, critical: 0 };

  const activeStep = progress >= 82 ? 2 : progress >= 28 ? 1 : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-5 sm:px-6 sm:pt-7 xl:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-brand/70">
              <FileText className="size-3" aria-hidden />
              Lab interpretation
            </div>
            <h1 className="mt-1.5 text-[22px] font-semibold tracking-[-0.035em] text-ink sm:text-[24px]">
              报告解读
            </h1>
            <p className="mt-1 max-w-[560px] text-[12px] leading-relaxed text-muted">
              上传体检或化验单，把指标翻译成可理解的语言，并为下一次就诊准备一份问题清单。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === "demo" ? <DemoBadgeLarge /> : null}
            {phase === "ready" ? (
              <UploadZone
                onFile={handleFile}
                busy={false}
                compact
                className="mt-0"
              />
            ) : null}
            {phase === "ready" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reset}
                className="h-8"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                返回
              </Button>
            ) : null}
          </div>
        </header>

        {phase === "idle" ? (
          <div className="flex min-h-[calc(100dvh-200px)] flex-col justify-center py-4">
            <div className="grid gap-4 lg:grid-cols-[1.55fr_0.45fr]">
              <UploadZone
                onFile={handleFile}
                onDemo={() => loadDemo()}
                className="min-h-[380px]"
              />

              <div className="space-y-3">
                <div className="card p-4">
                  <h2 className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                    <Sparkles className="size-3.5 text-brand" aria-hidden />
                    你会得到
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {PARSE_STEPS.map((step) => {
                      const Icon = step.icon;
                      return (
                        <li key={step.label} className="flex gap-2.5">
                          <span className="grid size-7 shrink-0 place-items-center rounded-[8px] border border-line bg-surface-2 text-brand/80">
                            <Icon className="size-3.5" aria-hidden />
                          </span>
                          <div>
                            <p className="text-[11px] font-medium text-slate-700">
                              {step.label}
                            </p>
                            <p className="mt-0.5 text-[9.5px] leading-relaxed text-slate-400">
                              {step.detail}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="rounded-[12px] border border-line bg-surface-2/70 p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                    <ShieldCheck className="size-3.5 text-brand/60" aria-hidden />
                    关于隐私与边界
                  </div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted">
                    文件仅用于本次解读。Super-Doctor 不提供诊断，异常指标需要由医生结合病史判断。
                  </p>
                </div>

                <div className="card border-cyan-100 bg-[linear-gradient(140deg,#ecfeff,#ffffff)] p-3.5">
                  <p className="text-[10px] font-semibold text-brand">没有现成报告？</p>
                  <p className="mt-1 text-[9.5px] leading-relaxed text-slate-500">
                    载入一份内置示例，直接查看完整解读界面。
                  </p>
                  <button
                    type="button"
                    onClick={() => loadDemo()}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-brand hover:underline"
                  >
                    载入示例报告
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[9.5px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3 text-brand/50" aria-hidden />
                文件仅用于本次解读
              </span>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span>指标结构化 + 参考范围对照</span>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <span>结果需由医生结合病史确认</span>
            </div>
          </div>
        ) : null}

        {phase === "uploading" || phase === "parsing" ? (
          <div className="mt-6">
            <div className="card relative overflow-hidden p-6 sm:p-8">
              <div className="mx-auto max-w-[560px] text-center">
                <span className="relative mx-auto grid size-12 place-items-center rounded-[14px] border border-cyan-100 bg-brand-soft text-brand">
                  <LoaderCircle className="size-5 animate-spin" aria-hidden />
                  <span className="absolute inset-0 animate-ping rounded-[14px] border border-cyan-200/70" aria-hidden />
                </span>
                <h2 className="mt-3 text-[16px] font-semibold tracking-[-0.01em] text-ink">
                  {phase === "uploading" ? "正在上传报告" : "正在解读报告"}
                </h2>
                <p className="mt-1 truncate text-[11px] text-muted">{pendingName || "报告文件"}</p>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                    <span>解析进度</span>
                    <span className="tabular-nums font-medium text-brand">{progress}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    aria-label="报告解析进度"
                  >
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0e7490,#06b6d4,#14b8a6)] transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.max(progress, 4)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-3 gap-2">
                  {PARSE_STEPS.map((step, index) => {
                    const done = index < activeStep;
                    const active = index === activeStep;
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.label}
                        className={cn(
                          "rounded-[10px] border px-2 py-2.5 text-center transition-colors",
                          done
                            ? "border-emerald-100 bg-emerald-50/60"
                            : active
                              ? "border-cyan-200 bg-brand-soft/60"
                              : "border-line bg-surface-2/50",
                        )}
                      >
                        <span
                          className={cn(
                            "mx-auto grid size-6 place-items-center rounded-full",
                            done
                              ? "bg-emerald-100 text-emerald-600"
                              : active
                                ? "bg-cyan-100 text-brand"
                                : "bg-slate-100 text-slate-400",
                          )}
                        >
                          {done ? (
                            <CircleCheck className="size-3.5" aria-hidden />
                          ) : active ? (
                            <Icon className="size-3" aria-hidden />
                          ) : (
                            <Icon className="size-3" aria-hidden />
                          )}
                        </span>
                        <p
                          className={cn(
                            "mt-1 text-[9.5px] font-medium",
                            done ? "text-emerald-700" : active ? "text-brand" : "text-slate-400",
                          )}
                        >
                          {step.label}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 space-y-2 text-left">
                  <Skeleton className="h-3 w-[38%]" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-[88%]" />
                  <Skeleton className="h-3 w-[62%]" />
                </div>

                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 text-[10px] text-slate-400 hover:text-slate-600"
                >
                  取消并返回
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === "failed" ? (
          <div className="mt-6">
            <div className="card px-6 py-12 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-red-50 text-red-500">
                <FileWarning className="size-5" aria-hidden />
              </span>
              <h2 className="mt-3 text-[15px] font-semibold text-ink">报告解析失败</h2>
              <p className="mx-auto mt-1 max-w-[400px] text-[11px] leading-relaxed text-muted">
                {error ?? "请确认文件清晰完整，或更换一份报告后重试。"}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button type="button" variant="primary" size="sm" onClick={reset}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  重新上传
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => loadDemo()}>
                  使用示例报告
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {phase === "ready" && report ? (
          <div className="mt-5 space-y-4">
            <section className="card relative overflow-hidden p-5">
              <span
                className="absolute inset-y-0 left-0 w-[3px] bg-[linear-gradient(180deg,#0e7490,#14b8a6)]"
                aria-hidden
              />
              <div className="flex flex-wrap items-start justify-between gap-3 pl-1">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-[11px] border border-violet-100 bg-violet-50 text-violet-600">
                    <FileText className="size-[18px]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-[14.5px] font-semibold tracking-[-0.01em] text-ink">
                      {report.filename}
                    </h2>
                    <p className="mt-0.5 text-[10px] text-muted">
                      {formatDate(report.created_at)} 上传 · {report.markers.length} 项指标
                      {report.patient_hint
                        ? ` · ${sexLabel(report.patient_hint.sex)} ${
                            report.patient_hint.age ? `${report.patient_hint.age} 岁` : ""
                          }`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="ok" dot>
                    解析完成
                  </Badge>
                  {mode === "demo" ? <Badge variant="warn">示例数据</Badge> : null}
                </div>
              </div>

              <div className="mt-4 rounded-[11px] border border-cyan-100/80 bg-[linear-gradient(115deg,#ecfeff_0%,#f8fafc_65%)] px-4 py-3.5">
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-brand">
                  <Sparkles className="size-3" aria-hidden />
                  通俗解读
                </div>
                <p className="mt-1.5 text-[12.5px] leading-[1.9] text-slate-700">
                  {report.summary}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[9.5px] text-slate-500">
                  {report.markers.length} 项指标
                </span>
                {counts.high > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9.5px] font-medium text-amber-700">
                    {counts.high} 项偏高
                  </span>
                ) : null}
                {counts.low > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9.5px] font-medium text-sky-700">
                    {counts.low} 项偏低
                  </span>
                ) : null}
                {counts.critical > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9.5px] font-medium text-red-700">
                    <TriangleAlert className="size-2.5" aria-hidden />
                    {counts.critical} 项危急
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9.5px] font-medium text-emerald-700">
                  {counts.normal} 项正常
                </span>
              </div>
            </section>

            <section>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
                    指标明细
                  </h2>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    每行都标注参考范围，以及「要不要紧」的通俗说明
                  </p>
                </div>
                <span className="text-[9.5px] text-slate-400">
                  异常指标按颜色高亮 · 危急项需尽快就医
                </span>
              </div>
              <MarkerTable markers={report.markers} />
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <section className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                      <MessageSquareText className="size-4 text-brand" aria-hidden />
                      可以问医生的问题
                    </h2>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      勾选已经问过的问题，就诊时逐条核对
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void copyQuestions()}
                    className="h-8 shrink-0 px-2.5 text-[10px]"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-emerald-600" aria-hidden />
                        已复制
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="size-3" aria-hidden />
                        复制
                      </>
                    )}
                  </Button>
                </div>

                <ul className="mt-3 space-y-1">
                  {report.questions_for_doctor.map((question, index) => {
                    const done = checked.has(index);
                    return (
                      <li key={question}>
                        <button
                          type="button"
                          onClick={() => toggleQuestion(index)}
                          aria-pressed={done}
                          className={cn(
                            "flex w-full items-start gap-2.5 rounded-[9px] border px-2 py-2 text-left transition-colors",
                            done
                              ? "border-emerald-100 bg-emerald-50/40"
                              : "border-transparent hover:border-line hover:bg-surface-2",
                          )}
                        >
                          {done ? (
                            <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden />
                          ) : (
                            <Circle className="mt-0.5 size-3.5 shrink-0 text-slate-300" aria-hidden />
                          )}
                          <span
                            className={cn(
                              "text-[11.5px] leading-relaxed",
                              done ? "text-slate-400 line-through" : "text-slate-600",
                            )}
                          >
                            {question}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="space-y-3">
                <section className="card p-5">
                  <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                    <FileText className="size-4 text-brand" aria-hidden />
                    引用来源
                  </h2>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    本页解读依据的指南段落
                  </p>
                  <div className="mt-3 space-y-2">
                    {report.citations.length > 0 ? (
                      report.citations.map((citation, index) => (
                        <CitationCard
                          key={citation.id}
                          citation={citation}
                          index={index}
                          variant="report"
                        />
                      ))
                    ) : (
                      <p className="rounded-[9px] border border-dashed border-line px-3 py-4 text-center text-[10px] text-slate-400">
                        暂无引用来源
                      </p>
                    )}
                  </div>
                </section>

                <div className="flex gap-2.5 rounded-[12px] border border-amber-100 bg-amber-50/60 px-3.5 py-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <p className="text-[10px] leading-relaxed text-amber-800/90">
                    {report.disclaimer}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
