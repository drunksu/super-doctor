"use client";

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, getToken, login } from "@/lib/api";
import { AGENT_ORDER } from "@/lib/format";
import { cn } from "@/lib/cn";

const DEMO_EMAIL = "demo@superdoctor.ai";
const DEMO_PASSWORD = "demo1234";

const HIGHLIGHTS = [
  {
    icon: Workflow,
    title: "五个智能体分工协作",
    detail: "分诊、问诊、全科、报告与安全审查各司其职。",
  },
  {
    icon: BookOpen,
    title: "每条结论引用指南",
    detail: "中文临床指南与专家共识，角标可回看原文段落。",
  },
  {
    icon: ShieldAlert,
    title: "红旗症状即时提示",
    detail: "识别需要紧急处理的症状组合，并给出行动建议。",
  },
];

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
      <div className="relative hidden w-[46%] max-w-[660px] shrink-0 overflow-hidden bg-[linear-gradient(150deg,#0b4f63_0%,#0e7490_46%,#0891b2_100%)] lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
            maskImage: "radial-gradient(ellipse at 30% 20%, black, transparent 75%)",
          }}
          aria-hidden
        />
        <div className="absolute -left-24 top-1/3 size-[360px] rounded-full bg-cyan-300/25 blur-[90px]" aria-hidden />
        <div className="absolute -bottom-24 right-0 size-[320px] rounded-full bg-emerald-300/15 blur-[80px]" aria-hidden />

        <div className="relative flex h-full flex-col px-10 py-9 xl:px-14">
          <div className="flex items-center gap-2.5">
            <span className="relative grid size-10 place-items-center overflow-hidden rounded-[12px] bg-white/15 text-white ring-1 ring-white/25 backdrop-blur">
              <Activity className="size-5" strokeWidth={2.3} aria-hidden />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-white">Super-Doctor</p>
              <p className="text-[9.5px] tracking-[0.08em] text-white/55">智能问诊多智能体系统</p>
            </div>
          </div>

          <div className="mt-[12vh] max-w-[430px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-cyan-50 backdrop-blur">
              <Sparkles className="size-3" aria-hidden />
              多智能体协同 · 指南可溯源
            </span>
            <h1 className="mt-5 text-[34px] font-semibold leading-[1.24] tracking-[-0.04em] text-white xl:text-[38px]">
              让每一次问诊，
              <br />
              都有据可循。
            </h1>
            <p className="mt-4 text-[12.5px] leading-[1.9] text-cyan-50/75">
              把模糊的不适拆成结构化信息，让分诊、全科建议与安全审查各司其职，
              并为下一次就诊准备好问题清单。
            </p>

            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-white/12 text-cyan-100 ring-1 ring-white/15">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-medium text-white">{item.title}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-cyan-50/55">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-auto">
            <div className="rounded-[14px] border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.14em] text-cyan-100/50">
                  示例运行
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden />
                  五个智能体就绪
                </span>
              </div>
              <div className="mt-2 flex items-end gap-5">
                <div>
                  <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-white">
                    2.4s
                  </p>
                  <p className="mt-1 text-[9px] text-cyan-50/50">端到端响应</p>
                </div>
                <div>
                  <p className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-white">
                    3
                  </p>
                  <p className="mt-1 text-[9px] text-cyan-50/50">条指南引用</p>
                </div>
                <div className="ml-auto flex flex-wrap justify-end gap-1">
                  {AGENT_ORDER.map((agent) => (
                    <AgentAvatar key={agent} agent={agent} size="xs" />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[9.5px] leading-relaxed text-cyan-50/45">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              Super-Doctor 提供健康信息与就医建议，不做诊断、不开处方。
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex min-h-dvh flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="grid size-8 place-items-center rounded-[10px] bg-[linear-gradient(140deg,#0e7490,#0891b2)] text-white">
              <Activity className="size-4" strokeWidth={2.4} aria-hidden />
            </span>
            <span className="text-[13px] font-semibold text-ink">Super-Doctor</span>
          </div>
          <Link
            href="/consult"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[10.5px] text-muted transition-colors hover:border-brand/25 hover:text-brand"
          >
            <ArrowLeft className="size-3" aria-hidden />
            返回工作台
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-10 sm:px-8">
          <div className="w-full max-w-[380px]">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-brand/70">
              Sign in
            </span>
            <h2 className="mt-2 text-[27px] font-semibold tracking-[-0.04em] text-ink">
              欢迎回来
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              登录后可同步问诊记录、患者档案与报告解读历史。
            </p>

            <button
              type="button"
              onClick={fillDemo}
              className="mt-5 flex w-full items-start gap-2.5 rounded-[11px] border border-cyan-100 bg-brand-soft/60 px-3.5 py-3 text-left transition-colors hover:border-cyan-200 hover:bg-brand-soft"
            >
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-cyan-100 text-brand">
                <Sparkles className="size-3" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-[10.5px] font-medium text-brand">
                  演示账号已自动填入
                  <span className="rounded-full bg-white/70 px-1.5 py-px font-mono text-[9px] text-cyan-700">
                    demo
                  </span>
                </span>
                <span className="mt-1 block font-mono text-[10px] leading-relaxed text-cyan-800/70">
                  demo@superdoctor.ai / demo1234
                </span>
              </span>
              <span className="mt-0.5 text-[9px] text-cyan-600/70">点击填充</span>
            </button>

            <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[10.5px] font-medium text-slate-600"
                >
                  邮箱
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
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
                  className="mb-1.5 block text-[10.5px] font-medium text-slate-600"
                >
                  密码
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
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
                    className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-[7px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
                    "flex items-start gap-2 rounded-[9px] border px-3 py-2 text-[10.5px] leading-relaxed",
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
              <span className="text-[9px] text-slate-400">或</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/consult")}
              className="h-10 w-full justify-center rounded-[10px] text-[11.5px]"
            >
              <Stethoscope className="size-3.5" aria-hidden />
              以演示模式继续
            </Button>
            <p className="mt-2 text-center text-[9px] leading-relaxed text-slate-400">
              演示模式使用本地脚本化对话，无需启动后端。
            </p>

            <div className="mt-7 rounded-[10px] border border-line bg-surface-2/70 px-3 py-2.5">
              <p className="text-[9px] leading-relaxed text-slate-400">
                登录即表示你理解：Super-Doctor 提供健康信息与就医建议，不构成诊断或处方；
                紧急情况请立即拨打 120。演示环境中的对话仅用于产品体验。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
