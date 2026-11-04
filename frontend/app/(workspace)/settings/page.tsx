"use client";

import {
  Check,
  Cpu,
  Database,
  LogIn,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAppMode } from "@/components/app-mode-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  API_BASE,
  ApiError,
  clearSession,
  storeUser,
  updateProfile,
} from "@/lib/api";
import { DEMO_DISCLAIMER, DEMO_META } from "@/lib/demo-fixtures";
import { loadDemoProfile, saveDemoProfile } from "@/lib/demo-store";
import type { PatientProfile } from "@/lib/types";

type FormState = {
  birthYear: string;
  sex: string;
  height: string;
  weight: string;
  allergies: string;
  conditions: string;
  medications: string;
  smoker: string;
  summary: string;
};

function toForm(profile: PatientProfile | null | undefined): FormState {
  return {
    birthYear: profile?.birth_year ? String(profile.birth_year) : "",
    sex: profile?.sex ?? "",
    height: profile?.height_cm ? String(profile.height_cm) : "",
    weight: profile?.weight_kg ? String(profile.weight_kg) : "",
    allergies: (profile?.allergies ?? []).join("、"),
    conditions: (profile?.conditions ?? []).join("、"),
    medications: (profile?.medications ?? []).join("、"),
    smoker: profile?.smoker ?? "",
    summary: profile?.summary ?? "",
  };
}

function splitList(value: string): string[] {
  return value
    .split(/[、,，;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

const labelClass = "mb-1.5 block text-[13px] font-medium text-muted";
const selectClass =
  "control h-10 w-full px-3 text-[12.5px] text-ink focus:border-brand/40 focus:outline-none";

export default function SettingsPage() {
  const router = useRouter();
  const { mode, user, health } = useAppMode();
  const isLive = mode === "live";
  const [form, setForm] = useState<FormState>(() =>
    toForm(isLive ? (user?.profile ?? null) : loadDemoProfile()),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(toForm(isLive ? (user?.profile ?? null) : loadDemoProfile()));
  }, [isLive, user]);

  const update = (key: keyof FormState, value: string) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    const birthYear = form.birthYear ? Number(form.birthYear) : null;
    const height = form.height ? Number(form.height) : null;
    const weight = form.weight ? Number(form.weight) : null;

    if (birthYear != null && (!Number.isFinite(birthYear) || birthYear < 1900 || birthYear > new Date().getFullYear())) {
      setError("请填写有效的出生年份");
      return;
    }
    if (height != null && (!Number.isFinite(height) || height < 80 || height > 250)) {
      setError("身高需在 80–250 cm 之间");
      return;
    }
    if (weight != null && (!Number.isFinite(weight) || weight < 20 || weight > 300)) {
      setError("体重需在 20–300 kg 之间");
      return;
    }

    const payload: PatientProfile = {
      birth_year: birthYear,
      sex: (form.sex || null) as PatientProfile["sex"],
      height_cm: height,
      weight_kg: weight,
      allergies: splitList(form.allergies),
      conditions: splitList(form.conditions),
      medications: splitList(form.medications),
      smoker: (form.smoker || null) as PatientProfile["smoker"],
      summary: form.summary.trim() || null,
    };

    if (!isLive) {
      saveDemoProfile(payload);
      setForm(toForm(payload));
      setSaved(true);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(payload);
      if (user) {
        storeUser({ ...user, profile: updated });
      }
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof ApiError ? saveError.message : "保存失败，请稍后重试",
      );
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    clearSession();
    router.push("/login");
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-[1080px] px-4 pb-10 pt-5 sm:px-6 sm:pt-7 xl:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.035em] text-ink sm:text-[24px]">
              设置
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => void save()}
              loading={saving}
              className="h-9"
            >
              <Save className="size-3.5" aria-hidden />
              保存修改
            </Button>
          </div>
        </header>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
          <div className="space-y-4">
            <section className="card p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                    <UserRound className="size-4 text-brand" aria-hidden />
                    患者档案
                  </h2>
                  <p className="mt-0.5 text-[13px] text-muted">
                    用于问诊上下文与风险提示，不会用于诊断。
                  </p>
                </div>
                {saved ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12.5px] font-medium text-emerald-700">
                    <Check className="size-2.5" aria-hidden />
                    已保存
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="birthYear" className={labelClass}>
                    出生年份
                  </label>
                  <Input
                    id="birthYear"
                    inputMode="numeric"
                    value={form.birthYear}
                    onChange={(event) => update("birthYear", event.target.value)}
                    placeholder="例如 1992"
                  />
                </div>
                <div>
                  <label htmlFor="sex" className={labelClass}>
                    生理性别
                  </label>
                  <select
                    id="sex"
                    className={selectClass}
                    value={form.sex}
                    onChange={(event) => update("sex", event.target.value)}
                  >
                    <option value="">未填写</option>
                    <option value="female">女</option>
                    <option value="male">男</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="height" className={labelClass}>
                    身高（cm）
                  </label>
                  <Input
                    id="height"
                    inputMode="decimal"
                    value={form.height}
                    onChange={(event) => update("height", event.target.value)}
                    placeholder="例如 165"
                  />
                </div>
                <div>
                  <label htmlFor="weight" className={labelClass}>
                    体重（kg）
                  </label>
                  <Input
                    id="weight"
                    inputMode="decimal"
                    value={form.weight}
                    onChange={(event) => update("weight", event.target.value)}
                    placeholder="例如 58.4"
                  />
                </div>
              </div>

              <div className="mt-4 border-t border-line/70 pt-4">
                <div className="grid gap-3">
                  <div>
                    <label htmlFor="allergies" className={labelClass}>
                      过敏史
                      <span className="ml-1 font-normal text-faint">用顿号或逗号分隔</span>
                    </label>
                    <Input
                      id="allergies"
                      value={form.allergies}
                      onChange={(event) => update("allergies", event.target.value)}
                      placeholder="例如 青霉素、磺胺类"
                    />
                  </div>
                  <div>
                    <label htmlFor="conditions" className={labelClass}>
                      基础疾病
                    </label>
                    <Input
                      id="conditions"
                      value={form.conditions}
                      onChange={(event) => update("conditions", event.target.value)}
                      placeholder="例如 高血压（1 级）"
                    />
                  </div>
                  <div>
                    <label htmlFor="medications" className={labelClass}>
                      长期用药
                    </label>
                    <Input
                      id="medications"
                      value={form.medications}
                      onChange={(event) => update("medications", event.target.value)}
                      placeholder="例如 氨氯地平 5mg 每日一次"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="smoker" className={labelClass}>
                    吸烟情况
                  </label>
                  <select
                    id="smoker"
                    className={selectClass}
                    value={form.smoker}
                    onChange={(event) => update("smoker", event.target.value)}
                  >
                    <option value="">未填写</option>
                    <option value="never">从不吸烟</option>
                    <option value="former">已戒烟</option>
                    <option value="current">目前吸烟</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="summary" className={labelClass}>
                    补充说明
                  </label>
                  <Input
                    id="summary"
                    value={form.summary}
                    onChange={(event) => update("summary", event.target.value)}
                    placeholder="例如 家庭血压多在 128/82 mmHg"
                  />
                </div>
              </div>

              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-[9px] border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700"
                >
                  {error}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3">
                <p className="text-[12.5px] text-faint">
                  {isLive
                    ? "保存后会同步到当前账户。"
                    : "未登录时，修改仅保留在当前浏览器会话。"}
                </p>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void save()}
                  loading={saving}
                  className="h-8"
                >
                  <Save className="size-3" aria-hidden />
                  保存
                </Button>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                <ShieldCheck className="size-4 text-brand" aria-hidden />
                免责声明
              </h2>
              <p className="mt-2 text-[13px] leading-[1.9] text-muted">{DEMO_DISCLAIMER}</p>
            </section>
          </div>

          <div className="space-y-4">
            <section className="card p-5">
              <h2 className="text-[13.5px] font-semibold text-ink">账户</h2>
              {user ? (
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-canvas">
                    {user.display_name?.slice(0, 1) || "访"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">
                      {user.display_name}
                    </p>
                    <p className="truncate text-[12.5px] text-muted">{user.email}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[12.5px] leading-[1.6] text-muted">
                  未登录：登录后可同步问诊记录与档案。
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {user ? (
                  <Button type="button" variant="secondary" size="sm" onClick={logout} className="h-8">
                    <LogOut className="size-3.5" aria-hidden />
                    退出登录
                  </Button>
                ) : (
                  <Link
                    href="/login"
                    className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-surface px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-brand/25 hover:text-brand"
                  >
                    <LogIn className="size-3.5" aria-hidden />
                    登录账户
                  </Link>
                )}
                {user ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[12.5px] text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                    JWT 已保存
                  </span>
                ) : null}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink">
                <Cpu className="size-4 text-brand" aria-hidden />
                运行环境
              </h2>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">调度模型</dt>
                  <dd className="font-mono text-[12.5px] font-semibold text-ink">
                    {DEMO_META.models.supervisor}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">执行模型</dt>
                  <dd className="font-mono text-[12.5px] font-semibold text-ink">
                    {DEMO_META.models.worker}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="flex items-center gap-1 text-faint">
                    <Database className="size-3" aria-hidden />
                    指南语料
                  </dt>
                  <dd className="text-muted">中文临床指南</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">运行模式</dt>
                  <dd>
                    <Badge variant={isLive ? "ok" : "warn"} dot>
                      {isLive
                        ? health?.model_mode === "mock"
                          ? "Mock 后端"
                          : "实时"
                        : "演示"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">API</dt>
                  <dd className="max-w-[190px] truncate font-mono text-[12.5px] text-muted" title={API_BASE}>
                    {API_BASE}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-faint">版本</dt>
                  <dd className="font-mono text-[12.5px] text-muted">
                    {health?.version ?? "demo-script"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[12px] border border-line bg-surface-2/70 p-4">
              <p className="text-[12.5px] leading-relaxed text-faint">
                Super-Doctor 不会存储你的真实病历。演示环境中的档案与对话均为本地示例数据，
                刷新页面后可重新体验。
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
