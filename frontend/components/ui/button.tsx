import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_1px_2px_rgba(8,51,68,.24),inset_0_1px_0_rgba(255,255,255,.12)] hover:bg-brand-strong active:translate-y-px",
  secondary:
    "border border-line bg-surface text-ink shadow-[0_1px_2px_rgba(15,23,42,.04)] hover:border-line-strong hover:bg-slate-50 active:translate-y-px",
  soft: "border border-cyan-100 bg-brand-soft text-brand hover:border-cyan-200 hover:bg-cyan-100/70",
  ghost: "text-muted hover:bg-slate-100/80 hover:text-ink",
  danger: "bg-danger text-white hover:bg-red-700 active:translate-y-px",
  link: "text-brand underline-offset-4 hover:underline",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-[9px] px-3 text-xs",
  md: "h-10 gap-2 rounded-[10px] px-4 text-[13px]",
  lg: "h-11 gap-2 rounded-[10px] px-5 text-sm",
  icon: "h-9 w-9 rounded-[10px]",
  "icon-sm": "h-8 w-8 rounded-[9px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
