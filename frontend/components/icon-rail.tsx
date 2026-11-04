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
        "grid size-9 place-items-center rounded-[9px] bg-brand text-white",
        className,
      )}
    >
      <Activity className="size-[18px]" strokeWidth={2.2} aria-hidden />
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
        className="hidden h-full w-[64px] shrink-0 flex-col items-center border-r border-line bg-surface-2 py-4 lg:flex"
        aria-label="主导航"
      >
        <Tooltip
          content={<>Super-Doctor · 智能问诊</>}
          side="right"
          tone="dark"
          contentClassName="whitespace-nowrap"
        >
          <Link
            href="/consult"
            aria-label="Super-Doctor 首页"
            className="rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2"
          >
            <LogoMark />
          </Link>
        </Tooltip>

        <nav className="mt-6 flex flex-1 flex-col items-center gap-1">
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
                    "relative grid size-10 place-items-center rounded-[9px] transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2",
                    active
                      ? "bg-brand-soft text-brand"
                      : "text-muted hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {active ? (
                    <span
                      className="absolute -left-[13px] h-5 w-[2px] rounded-r-full bg-brand"
                      aria-hidden
                    />
                  ) : null}
                  <Icon className="size-[19px]" strokeWidth={active ? 2.1 : 1.8} aria-hidden />
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        <div className="mb-3 flex flex-col items-center gap-2">
          <Tooltip
            content="健康信息，仅供参考"
            side="right"
            tone="dark"
            contentClassName="whitespace-nowrap"
          >
            <Link
              href="/settings"
              aria-label="查看免责声明与设置"
              className="grid size-8 place-items-center rounded-[8px] border border-line text-faint transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
            >
              <span className="font-ui text-[13px]">ⓘ</span>
            </Link>
          </Tooltip>
        </div>

        <Tooltip
          content={user ? `${user.display_name} · 账户` : "账户与设置"}
          side="right"
          tone="dark"
          contentClassName="whitespace-nowrap"
        >
          <Link
            href="/settings"
            aria-label="账户与设置"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2"
          >
            <span className="grid size-8 place-items-center rounded-full bg-ink font-ui text-[13px] font-medium text-canvas">
              {initial}
            </span>
          </Link>
        </Tooltip>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-[58px] items-stretch justify-around border-t border-line bg-surface px-2 lg:hidden"
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
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[8px] font-ui text-[13px]",
                active ? "text-brand" : "text-muted",
              )}
            >
              <Icon className="size-[19px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
