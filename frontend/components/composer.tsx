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
    element.style.height = `${Math.min(Math.max(element.scrollHeight, 48), 168)}px`;
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
        "rounded-[14px] border border-line-control bg-surface px-2 py-1.5",
        "transition-[border-color,box-shadow] duration-150",
        "focus-within:border-brand focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.14)]",
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
            className="mb-1 grid size-8 shrink-0 place-items-center rounded-[8px] text-faint transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
          >
            <FileUp className="size-[17px]" strokeWidth={1.8} aria-hidden />
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
          className="max-h-[168px] min-h-[48px] w-full resize-none bg-transparent px-1.5 py-2.5 font-serif text-[15.5px] leading-[1.7] text-ink outline-none placeholder:text-faint"
        />

        <div className="mb-1 flex shrink-0 items-center gap-1">
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
              <ArrowUp className="size-3.5" strokeWidth={2.4} aria-hidden />
              <span className="hidden sm:inline">发送</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end px-2 pb-0.5">
        <span className="hidden items-center gap-1 text-[12.5px] text-faint sm:inline-flex">
          <CornerDownLeft className="size-3" aria-hidden />
          Enter 发送 · Shift + Enter 换行
        </span>
      </div>
    </div>
  );
});
