"use client";

import {
  CalendarDays,
  CircleAlert,
  Cpu,
  Database,
  Gauge,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AgentAvatar } from "@/components/agent-avatar";
import { useAppMode } from "@/components/app-mode-provider";
import { BarChart } from "@/components/bar-chart";
import { KpiCard } from "@/components/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getInsights, getMeta } from "@/lib/api";
import { DEMO_INSIGHTS, DEMO_META } from "@/lib/demo-fixtures";
import {
  AGENT_META,
  formatCompactNumber,
  formatLatency,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import type { AgentId, Insights, Meta } from "@/lib/types";

function SafetyDonut({ insights }: { insights: Insights }) {
  const segments = [
    { label: "常规", value: insights.safety.routine, color: "#059669", soft: "text-emerald-700" },
    { label: "需关注", value: insights.safety.attention, color: "#d97706", soft: "text-amber-700" },
    { label: "紧急", value: insights.safety.urgent, color: "#dc2626", soft: "text-red-700" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const safeTotal = total || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative size-[156px] shrink-0">
        <svg
          viewBox="0 0 160 160"
          className="size-full -rotate-90"
          role="img"
          aria-label={`安全分级分布：常规 ${insights.safety.routine}，需关注 ${insights.safety.attention}，紧急 ${insights.safety.urgent}`}
        >
          <circle cx="80" cy="80" r={radius} fill="none" stroke="#efede4" strokeWidth="15" />
          {segments.map((segment) => {
            const fraction = segment.value / safeTotal;
            const dash = Math.max(0, fraction * circumference - 3);
            const offset = cumulative * circumference;
            cumulative += fraction;
            return (
              <circle
                key={segment.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth="15"
                strokeLinecap="butt"
                strokeDasharray={`${dash} ${circumference}`}
                strokeDashoffset={-offset}
                className="transition-[stroke-dasharray] duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-semibold tabular-nums leading-none tracking-[-0.03em] text-ink">
            {formatNumber(total)}
          </span>
          <span className="mt-1 text-[12.5px] text-muted">次安全审查</span>
        </div>
      </div>

      <div className="min-w-[150px] flex-1 space-y-2.5">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: segment.color }}
              aria-hidden
            />
            <span className="flex-1 text-[13px] text-muted">{segment.label}</span>
            <span className="text-[12.5px] font-semibold tabular-nums text-ink">
              {formatNumber(segment.value)}
            </span>
            <span className="w-9 text-right text-[12.5px] tabular-nums text-faint">
              {formatPercent(segment.value / safeTotal, 0)}
            </span>
          </div>
        ))}
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="flex h-full">
            {segments.map((segment) => (
              <div
                key={segment.label}
                style={{
                  width: `${(segment.value / safeTotal) * 100}%`,
                  backgroundColor: segment.color,
                }}
                className="h-full first:rounded-l-full last:rounded-r-full"
              />
            ))}
          </div>
        </div>
        <p className="text-[12.5px] leading-relaxed text-faint">
          红旗命中 {formatNumber(insights.safety.urgent)} 次，均触发紧急处理提示。
        </p>
      </div>
    </div>
  );
}

function RouteBars({ insights }: { insights: Insights }) {
  const routes = [...insights.routes].sort((a, b) => b.count - a.count);
  const max = Math.max(...routes.map((route) => route.count), 1);
  const totalRuns = Math.max(insights.runs, 1);

  return (
    <ul className="space-y-2.5">
      {routes.map((route) => {
        const meta = AGENT_META[route.agent as AgentId] ?? AGENT_META.supervisor;
        const width = Math.max(4, (route.count / max) * 100);
        return (
          <li key={route.agent} className="group">
            <div className="flex items-center gap-2">
              <AgentAvatar agent={route.agent as AgentId} size="sm" />
              <span className="flex-1 text-[12.5px] font-medium text-muted">
                {meta.label}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-ink">
                {formatNumber(route.count)}
              </span>
              <span className="w-9 text-right text-[12.5px] tabular-nums text-faint">
                {formatPercent(route.count / totalRuns, 0)}
              </span>
            </div>
            <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function InsightsPage() {
  const { mode, health } = useAppMode();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (mode === "checking") return;
      if (!silent) setLoading(true);
      setNotice(null);
      if (mode === "live") {
        try {
          const [liveInsights, liveMeta] = await Promise.all([getInsights(), getMeta()]);
          setInsights(liveInsights);
          setMeta(liveMeta);
        } catch {
          setInsights(DEMO_INSIGHTS);
          setMeta(DEMO_META);
          setNotice("实时数据暂不可用，已切换为演示指标");
        }
      } else {
        setInsights(DEMO_INSIGHTS);
        setMeta(DEMO_META);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [mode],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load(true);
  };

  const demo = mode !== "live";
  const daily = insights?.daily ?? [];
  const totalDaily = daily.reduce((sum, item) => sum + item.runs, 0);
  const avgDaily = daily.length ? totalDaily / daily.length : 0;
  const peakDaily = daily.reduce((max, item) => Math.max(max, item.runs), 0);
  const totalTokens = insights ? insights.tokens.input + insights.tokens.output : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-5 sm:px-6 sm:pt-7 xl:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.035em] text-ink sm:text-[24px]">
              运行洞察
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px] text-muted">
              <CalendarDays className="size-3 text-faint" aria-hidden />
              近 14 天
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={refresh}
              className="h-8 px-2.5 text-[12.5px]"
              aria-label="刷新洞察数据"
              disabled={loading}
            >
              <RefreshCw
                className={refreshing ? "size-3 animate-spin" : "size-3"}
                aria-hidden
              />
              刷新
            </Button>
          </div>
        </header>

        {notice ? (
          <div className="mt-4 flex items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-muted">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden />
            {notice}
          </div>
        ) : null}

        {loading || !insights ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="card p-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-4 h-7 w-28" />
                  <Skeleton className="mt-2 h-2.5 w-36" />
                </div>
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <div className="card p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-5 h-[230px] w-full" />
              </div>
              <div className="card p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-5 h-[180px] w-full" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="总问诊数"
                value={formatNumber(insights.runs)}
                sub={`覆盖 ${formatNumber(insights.sessions)} 个会话 · ${formatNumber(
                  insights.messages,
                )} 条消息`}
                icon={<MessagesSquare className="size-3.5" aria-hidden />}
              />
              <KpiCard
                label="平均响应"
                value={formatLatency(insights.avg_latency_ms)}
                sub="含多智能体编排"
                icon={<Timer className="size-3.5" aria-hidden />}
              />
              <KpiCard
                label="P95 延迟"
                value={formatLatency(insights.p95_latency_ms)}
                sub="长尾请求耗时"
                icon={<Gauge className="size-3.5" aria-hidden />}
              />
              <KpiCard
                label="累计 tokens"
                value={formatCompactNumber(totalTokens)}
                sub={`输入 ${formatCompactNumber(insights.tokens.input)} · 输出 ${formatCompactNumber(
                  insights.tokens.output,
                )}`}
                icon={<Cpu className="size-3.5" aria-hidden />}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <section className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
                      每日问诊量
                    </h2>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-[12.5px] text-faint">日均</p>
                      <p className="text-[12.5px] font-semibold tabular-nums text-ink">
                        {formatNumber(avgDaily)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[12.5px] text-faint">峰值</p>
                      <p className="text-[12.5px] font-semibold tabular-nums text-ink">
                        {formatNumber(peakDaily)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <BarChart data={daily} height={250} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                  <span className="text-[12.5px] text-faint">
                    合计 {formatNumber(totalDaily)} 次运行 · 数据来自运行日志
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[12.5px] text-faint">
                    <span className="size-1.5 rounded-full bg-brand" aria-hidden />
                    每日运行量
                  </span>
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
                      <ShieldCheck className="size-4 text-brand" aria-hidden />
                      安全分级
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      每次运行都会经过安全审查智能体
                    </p>
                  </div>
                  <Badge variant="ok" dot>
                    100% 覆盖
                  </Badge>
                </div>
                <div className="mt-4">
                  <SafetyDonut insights={insights} />
                </div>
              </section>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <section className="card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
                      Agent 路由分布
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      一次运行会按需调用多个智能体
                    </p>
                  </div>
                  <span className="text-[12.5px] text-faint">
                    {formatNumber(insights.routes.reduce((sum, route) => sum + route.count, 0))}{" "}
                    次调用
                  </span>
                </div>
                <div className="mt-4">
                  <RouteBars insights={insights} />
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-[9px] border border-line bg-surface-2/70 px-3 py-2">
                  <Sparkles className="size-3 shrink-0 text-brand/60" aria-hidden />
                  <p className="text-[12.5px] leading-relaxed text-muted">
                    调度与安全审查在每次运行中都会执行；报告解读仅在涉及化验单时触发。
                  </p>
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
                    <Cpu className="size-4 text-brand" aria-hidden />
                    模型配置
                  </h2>
                  <Badge variant="outline">只读</Badge>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="rounded-[10px] border border-line bg-surface-2/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] text-faint">调度 · supervisor</span>
                      <Badge variant="brand">快速</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[13px] font-semibold text-ink">
                      {meta?.models.supervisor ?? "deepseek-flash"}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-line bg-surface-2/60 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] text-faint">执行 · worker</span>
                      <Badge variant="info">深度</Badge>
                    </div>
                    <p className="mt-1 font-mono text-[13px] font-semibold text-ink">
                      {meta?.models.worker ?? "deepseek-v4-pro"}
                    </p>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 border-t border-line/70 pt-3">
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <dt className="flex items-center gap-1.5 text-faint">
                      <Database className="size-3" aria-hidden />
                      指南语料
                    </dt>
                    <dd className="text-muted">中文临床指南 · 本地检索</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <dt className="text-faint">运行模式</dt>
                    <dd className="inline-flex items-center gap-1.5 text-muted">
                      <span
                        className={cnDot(demo)}
                        aria-hidden
                      />
                      {demo
                        ? "演示回放"
                        : health?.model_mode === "mock"
                          ? "Mock 后端"
                          : "实时模型"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <dt className="text-faint">服务版本</dt>
                    <dd className="font-mono text-[12.5px] text-muted">
                      {health?.version ?? "demo-script"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 border-t border-line/70 pt-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="text-faint">结构化问诊完成度</span>
                    <span className="font-semibold tabular-nums text-brand">
                      {formatPercent(insights.intake_completion, 0)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${insights.intake_completion * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">
                    9 个结构化槽位的平均填充率。
                  </p>
                </div>
              </section>
            </div>

            <p className="pt-1 text-center text-[12.5px] text-faint">
              统计口径：一次 run 计为一次问诊；P95 取运行日志的 95 分位值；tokens 为输入与输出之和。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function cnDot(demo: boolean): string {
  return `size-1.5 rounded-full ${demo ? "bg-line-strong" : "bg-brand"}`;
}
