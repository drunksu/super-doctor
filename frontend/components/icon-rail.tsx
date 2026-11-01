"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ChartColumn,
  FileText,
  Settings,
  Stethoscope,
} from "lucide-react";
import { useAppMode } from "@/components/app-mode-provider";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/consult", label: "问诊", icon: Stethoscope },
  { href: "/reports", label: "报告", icon: FileText },
  { href: "/insights", label: "洞察", icon: ChartColumn },
  { href: "/settings", label: "设置", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-10 place-items-center overflow-hidden rounded-[12px] text-white shadow-[0_6px_16px_-6px_rgba(14,116,144,.55)]",
        "bg-[linear-gradient(140deg,#0e7490_0%,#0891b2_58%,#0d9488_100%)]",
        className,
      )}
    >
      <span
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 78% 18%, rgba(255,255,255,.55), transparent 42%)",
        }}
        aria-hidden
      />
      <Activity className="relative size-[19px]" strokeWidth={2.4} aria-hidden />
    </span>
  );
}

export function IconRail() {
  const pathname = usePathname() ?? "/consult";
  const { user } = useAppMode();
  const initial = user?.display_name?.trim().slice(0, 1) || "访";

  return (
    <>
      <aside
        className="hidden h-full w-[72px] shrink-0 flex-col items-center border-r border-line bg-surface/90 py-4 backdrop-blur-sm lg:flex"
        aria-label="主导航"
      >
        <Tooltip
          content={<>MediFlow · 智能问诊</>}
          side="right"
          tone="dark"
          contentClassName="whitespace-nowrap"
        >
          <Link
            href="/consult"
            aria-label="MediFlow 首页"
            className="rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2"
          >
            <LogoMark />
          </Link>
        </Tooltip>

        <div className="mt-7 h-px w-7 bg-line" />

        <nav className="mt-5 flex flex-1 flex-col items-center gap-2">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Tooltip
                key={item.href}
                content={item.label}
                side="right"
                tone="dark"
                contentClassName="whitespace-nowrap"
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative grid size-11 place-items-center rounded-[12px] transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2",
                    active
                      ? "bg-brand-soft text-brand"
                      : "text-slate-400 hover:bg-slate-100/80 hover:text-slate-700",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute -left-[18px] h-6 w-[3px] rounded-r-full bg-brand"
                      aria-hidden
                    />
                  ) : null}
                  <Icon className="size-[19px]" strokeWidth={active ? 2.2 : 1.9} aria-hidden />
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        <div className="mb-3 flex flex-col items-center gap-2">
          <Tooltip content="健康信息，仅供参考" side="right" tone="dark" contentClassName="whitespace-nowrap">
            <Link
              href="/settings"
              aria-label="查看免责声明与设置"
              className="grid size-9 place-items-center rounded-[10px] border border-line bg-surface-2 text-slate-400 transition-colors hover:border-brand/25 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              <span className="text-[11px] font-semibold">ⓘ</span>
            </Link>
          </Tooltip>
        </div>

        <Tooltip content={user ? `${user.display_name} · 账户` : "未登录 · 演示模式"} side="right" tone="dark" contentClassName="whitespace-nowrap">
          <Link
            href="/settings"
            aria-label="账户与设置"
            className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[linear-gradient(140deg,#334155,#0f172a)] text-[12px] font-semibold text-white ring-2 ring-white">
              {initial}
            </span>
            <span
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-emerald-500"
              aria-hidden
            />
          </Link>
        </Tooltip>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-[58px] items-stretch justify-around border-t border-line bg-surface/95 px-2 backdrop-blur-md lg:hidden"
        aria-label="移动端主导航"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] text-[10px] font-medium",
                active ? "text-brand" : "text-slate-400",
              )}
            >
              <Icon className="size-[19px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
