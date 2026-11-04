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
  primary: "bg-brand text-white hover:bg-brand-strong active:translate-y-px",
  secondary:
    "border border-line-control bg-surface text-ink hover:bg-surface-2 active:translate-y-px",
  soft: "bg-brand-soft text-brand hover:bg-brand/10",
  ghost: "text-muted hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:bg-danger/90 active:translate-y-px",
  link: "text-brand underline-offset-4 hover:underline",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-[8px] px-2.5 text-[13px]",
  md: "h-10 gap-2 rounded-[9px] px-3.5 text-[13.5px]",
  lg: "h-11 gap-2 rounded-[10px] px-5 text-[14px]",
  icon: "h-9 w-9 rounded-[9px]",
  "icon-sm": "h-8 w-8 rounded-[8px]",
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        "disabled:pointer-events-none disabled:opacity-45",
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
