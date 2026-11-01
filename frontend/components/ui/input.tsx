import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "control h-10 w-full px-3 text-[13px] text-ink placeholder:text-slate-400",
        "focus:border-brand/40 focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
});
