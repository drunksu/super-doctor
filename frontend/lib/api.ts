import type {
  AuthResponse,
  Health,
  Insights,
  Message,
  Meta,
  PatientProfile,
  ReportInsight,
  ReportListItem,
  SessionSummary,
  User,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

const TOKEN_KEY = "super-doctor.token";
const USER_KEY = "super-doctor.user";
export const AUTH_EVENT = "super-doctor:auth-changed";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "邮箱或密码不正确",
  email_taken: "该邮箱已被注册",
  unauthorized: "登录已过期，请重新登录",
  not_found: "没有找到对应的内容",
  rate_limited: "请求过于频繁，请稍后再试",
  file_too_large: "文件超过 10 MB 限制",
  unsupported_file: "仅支持 PDF、PNG、JPG 格式",
  bad_request: "请求参数有误",
  upstream_unavailable: "模型服务暂时不可用，请稍后重试",
  network: "无法连接服务器，请确认后端已启动",
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message?: string, status = 0) {
    super(message || ERROR_MESSAGES[code] || "请求失败，请稍后重试");
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function emitAuthChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EVENT));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeSession(auth: AuthResponse): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, auth.access_token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  } catch {
    /* storage may be unavailable in private mode — the app falls back to demo */
  }
  emitAuthChange();
}

export function storeUser(user: User): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  emitAuthChange();
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  emitAuthChange();
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    auth = true,
    timeoutMs = 20_000,
    signal: externalSignal,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  const headers = new Headers();
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: payload,
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      let code = "bad_request";
      let message: string | undefined;
      try {
        const parsed = (await response.json()) as {
          error?: { code?: string; message?: string };
          detail?: string;
        };
        code = parsed.error?.code ?? (response.status === 401 ? "unauthorized" : code);
        message = parsed.error?.message ?? parsed.detail;
      } catch {
        if (response.status === 401) code = "unauthorized";
      }
      throw new ApiError(code, message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("aborted", "请求已取消");
    }
    throw new ApiError("network");
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export async function login(email: string, password: string): Promise<AuthResponse> {
  const auth = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
  storeSession(auth);
  return auth;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const auth = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: { email, password, display_name: displayName },
    auth: false,
  });
  storeSession(auth);
  return auth;
}

export function getMe(): Promise<User> {
  return request<User>("/me");
}

export function updateProfile(profile: Partial<PatientProfile>): Promise<PatientProfile> {
  return request<PatientProfile>("/me/profile", { method: "PUT", body: profile });
}

/* ------------------------------------------------------------------ */
/* Sessions & chat                                                     */
/* ------------------------------------------------------------------ */

export async function listSessions(): Promise<SessionSummary[]> {
  const data = await request<{ sessions: SessionSummary[] }>("/sessions");
  return data.sessions;
}

export async function createSession(title?: string): Promise<SessionSummary> {
  return request<SessionSummary>("/sessions", { method: "POST", body: { title } });
}

export async function getSessionMessages(
  sessionId: string,
): Promise<{ session: SessionSummary; messages: Message[] }> {
  return request<{ session: SessionSummary; messages: Message[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export type UploadReportResponse = { report_id: string; status: "parsing" };

export function uploadReport(file: File): Promise<UploadReportResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadReportResponse>("/reports", {
    method: "POST",
    body: form,
    timeoutMs: 60_000,
  });
}

export function getReport(reportId: string): Promise<ReportInsight> {
  return request<ReportInsight>(`/reports/${encodeURIComponent(reportId)}`);
}

export async function listReports(): Promise<ReportListItem[]> {
  const data = await request<{ reports: ReportListItem[] }>("/reports");
  return data.reports;
}

/* ------------------------------------------------------------------ */
/* Meta, insights, health                                              */
/* ------------------------------------------------------------------ */

export function getMeta(): Promise<Meta> {
  return request<Meta>("/meta/agents");
}

export function getInsights(): Promise<Insights> {
  return request<Insights>("/insights/summary");
}

export async function checkHealth(timeoutMs = 1500): Promise<Health | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_BASE}/health`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const health = (await response.json()) as Health;
    return health.status === "ok" ? health : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.code === "aborted") ||
    (error instanceof DOMException && error.name === "AbortError")
  );
}
