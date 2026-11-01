"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_EVENT,
  checkHealth,
  getMe,
  getStoredUser,
  getToken,
} from "@/lib/api";
import type { ApiMode, Health, User } from "@/lib/types";

type AppModeContextValue = {
  mode: ApiMode;
  health: Health | null;
  user: User | null;
  refresh: () => void;
};

const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ApiMode>("checking");
  const [health, setHealth] = useState<Health | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const requestId = useRef(0);

  const evaluate = useCallback(async () => {
    const current = ++requestId.current;
    setUser(getStoredUser());
    const token = getToken();

    if (!token) {
      setHealth(null);
      setMode("demo");
      return;
    }

    const result = await checkHealth(1400);
    if (current !== requestId.current) return;
    setHealth(result);
    setMode(result ? "live" : "demo");

    if (result) {
      try {
        const me = await getMe();
        if (current === requestId.current) setUser(me);
      } catch {
        /* keep the cached user; unauthorised requests will surface elsewhere */
      }
    }
  }, []);

  useEffect(() => {
    void evaluate();
    const onChange = () => void evaluate();
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(AUTH_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [evaluate]);

  const refresh = useCallback(() => {
    void evaluate();
  }, [evaluate]);

  return (
    <AppModeContext.Provider value={{ mode, health, user, refresh }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppMode must be used inside AppModeProvider");
  }
  return context;
}
