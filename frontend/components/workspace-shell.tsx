"use client";

import type { ReactNode } from "react";
import { AppModeProvider } from "@/components/app-mode-provider";
import { IconRail } from "@/components/icon-rail";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <AppModeProvider>
      <div className="flex h-dvh w-full overflow-hidden">
        <IconRail />
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pb-[58px] lg:pb-0">
          {children}
        </main>
      </div>
    </AppModeProvider>
  );
}
