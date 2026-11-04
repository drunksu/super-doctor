"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getToken, login } from "@/lib/api";
import { cn } from "@/lib/cn";

const DEMO_EMAIL = "demo@superdoctor.ai";
const DEMO_PASSWORD = "demo1234";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (getToken()) {
      router.replace("/consult");
    }
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setOffline(false);
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push("/consult");
    } catch (loginError) {
      if (loginError instanceof ApiError) {
        if (loginError.code === "network") {
          setOffline(true);
          setError("无法连接后端服务，可直接使用演示模式体验完整界面。");
        } else {
          setError(loginError.message);
        }
      } else {
        setError("登录失败，请稍后重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div className="flex min-h-dvh bg-canvas">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] max-w-[660px] shrink-0 flex-col border-r border-line bg-canvas lg:flex">
        <div className="flex h-full flex-col px-10 py-9 xl:px-14">
          <div className="flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-[11px] bg-brand text-white">
              <Activity className="size-5" strokeWidth={2.2} aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Super-Doctor</p>
              <p className="mt-0.5 text-[12.5px] text-faint">智能问诊多智能体系统</p>
            </div>
          </div>

          <div className="mt-[12vh] max-w-[430px]">
            <h1 className="text-[34px] font-semibold leading-[1.24] tracking-[-0.04em] text-ink xl:text-[38px]">
              让每一次问诊，
              <br />
              都有据可循。
            </h1>
          </div>

          <div className="mt-auto flex items-center gap-2 text-[13px] leading-relaxed text-muted">
            <ShieldCheck className="size-3.5 shrink-0 text-brand" aria-hidden />
            Super-Doctor 提供健康信息与就医建议，不做诊断、不开处方。
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex min-h-dvh flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-[9px] bg-brand text-white">
              <Activity className="size-4" strokeWidth={2.4} aria-hidden />
            </span>
            <span className="text-[13px] font-semibold text-ink">Super-Doctor</span>
          </div>
          <Link
            href="/consult"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-brand/25 hover:text-brand"
          >
            <ArrowLeft className="size-3" aria-hidden />
            返回工作台
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-[380px]">
            <span className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-brand/70">
              Sign in
            </span>
            <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em] text-ink">
              欢迎回来
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
              登录后可同步问诊记录、患者档案与报告解读历史。
            </p>

            <button
              type="button"
              onClick={fillDemo}
              className="mt-5 flex w-full items-start gap-2.5 rounded-[11px] border border-line bg-brand-soft/60 px-3.5 py-3 text-left transition-colors hover:border-brand/40 hover:bg-brand-soft"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                <Sparkles className="size-3" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-medium text-brand">
                  示例账号已自动填入
                  <span className="rounded-full bg-surface px-1.5 py-px font-mono text-[12.5px] text-brand">
                    demo
                  </span>
                </span>
                <span className="mt-1 block font-mono text-[12.5px] leading-relaxed text-muted">
                  demo@superdoctor.ai / demo1234
                </span>
              </span>
              <span className="mt-0.5 text-[12.5px] text-faint">点击填充</span>
            </button>

            <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[13px] font-medium text-muted"
                >
                  邮箱
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint"
                    aria-hidden
                  />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(error)}
                    className="h-11 pl-9 text-[12.5px]"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[13px] font-medium text-muted"
                >
                  密码
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 pl-9 pr-10 text-[12.5px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-[7px] text-faint hover:bg-slate-100 hover:text-muted"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" aria-hidden />
                    ) : (
                      <Eye className="size-3.5" aria-hidden />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className={cn(
                    "flex items-start gap-2 rounded-[9px] border px-3 py-2 text-[13px] leading-relaxed",
                    offline
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-red-200 bg-red-50 text-red-700",
                  )}
                >
                  <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="flex-1">{error}</span>
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="h-11 w-full justify-center rounded-[10px] text-[12.5px]"
              >
                {loading ? "正在登录…" : "登录并进入工作台"}
                {!loading ? <ArrowRight className="size-4" aria-hidden /> : null}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[12.5px] text-faint">或</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/consult")}
              className="h-10 w-full justify-center rounded-[10px] text-[13px]"
            >
              <Stethoscope className="size-3.5" aria-hidden />
              直接体验
            </Button>

            <p className="mt-6 text-center text-[12.5px] leading-[1.7] text-muted">
              登录即表示你理解：Super-Doctor 提供健康信息与就医建议，不构成诊断或处方；
              紧急情况请立即拨打 120。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
