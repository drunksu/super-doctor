"use client";

import { ArrowUp, CornerDownLeft, FileUp, Square } from "lucide-react";
import Link from "next/link";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

export type ComposerHandle = { focus: () => void };

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  placeholder?: string;
};

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { value, onChange, onSend, onStop, streaming, placeholder },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => textareaRef.current?.focus(),
    }),
    [],
  );

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 44), 148)}px`;
  }, [value]);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || streaming) return;
    onSend(text);
  }, [onSend, streaming, value]);

  return (
    <div
      data-testid="composer"
      className={cn(
        "rounded-[16px] border border-line bg-surface p-1.5 shadow-[0_1px_2px_rgba(15,23,42,.05),0_10px_30px_-20px_rgba(15,23,42,.25)]",
        "transition-[border-color,box-shadow] duration-150 focus-within:border-brand/40",
        "focus-within:shadow-[0_0_0_4px_rgba(14,116,144,.07),0_10px_30px_-20px_rgba(15,23,42,.25)]",
      )}
    >
      <div className="flex items-end gap-1">
        <Tooltip
          content="解读化验单 · 支持 PDF / 图片"
          side="top"
          tone="dark"
          contentClassName="whitespace-nowrap"
        >
          <Link
            href="/reports"
            aria-label="前往报告解读"
            className="mb-0.5 grid size-9 shrink-0 place-items-center rounded-[9px] text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
          >
            <FileUp className="size-[17px]" aria-hidden />
          </Link>
        </Tooltip>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              submit();
            }
          }}
          rows={1}
          aria-label="输入问诊内容"
          placeholder={
            placeholder ?? "描述你的症状、持续时间和伴随情况，或直接提问…"
          }
          className="max-h-[148px] min-h-[44px] w-full resize-none bg-transparent px-1.5 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-slate-400"
        />

        <div className="mb-0.5 flex shrink-0 items-center gap-1">
          {streaming ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onStop}
              className="h-9 rounded-[9px] px-3"
              aria-label="停止生成"
            >
              <Square className="size-3 fill-current" aria-hidden />
              <span className="hidden sm:inline">停止</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={submit}
              disabled={!value.trim()}
              className="h-9 rounded-[9px] pl-2.5 pr-3"
              aria-label="发送消息"
            >
              <ArrowUp className="size-3.5" strokeWidth={2.6} aria-hidden />
              <span className="hidden sm:inline">发送</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-2 pb-0.5 pt-0.5">
        <span className="hidden items-center gap-1 text-[10px] text-slate-400 sm:inline-flex">
          <CornerDownLeft className="size-3" aria-hidden />
          Enter 发送 · Shift + Enter 换行
        </span>
        <span className="text-[10px] text-slate-400 sm:hidden">支持多轮追问</span>
        <span className="text-[10px] text-slate-400">健康信息，不构成诊断</span>
      </div>
    </div>
  );
});
