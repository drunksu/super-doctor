"use client";

import { FileText, LoaderCircle, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg";
const MAX_BYTES = 10 * 1024 * 1024;

export type UploadZoneProps = {
  onFile: (file: File) => void;
  onDemo?: () => void;
  busy?: boolean;
  compact?: boolean;
  className?: string;
};

export function UploadZone({
  onFile,
  onDemo,
  busy = false,
  compact = false,
  className,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): boolean => {
    const name = file.name.toLowerCase();
    const allowed =
      name.endsWith(".pdf") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      ["application/pdf", "image/png", "image/jpeg"].includes(file.type);
    if (!allowed) {
      setError("仅支持 PDF、PNG、JPG 格式");
      return false;
    }
    if (file.size > MAX_BYTES) {
      setError("文件超过 10 MB，请压缩后重试");
      return false;
    }
    setError(null);
    return true;
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!validate(file)) return;
    onFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  };

  if (compact) {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="上传报告文件"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          loading={busy}
          className="h-8"
        >
          <UploadCloud className="size-3.5" aria-hidden />
          重新上传
        </Button>
        {error ? (
          <span role="alert" className="text-[12.5px] text-red-600">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="upload-zone"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 py-9 text-center transition-[border-color,background-color] duration-150",
        dragging
          ? "border-brand/60 bg-brand-soft/70"
          : "border-line bg-surface hover:border-brand/30",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        aria-label="上传报告文件"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <span className="relative grid size-12 place-items-center rounded-[14px] border border-line bg-brand-soft text-brand">
        {busy ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <UploadCloud className="size-5" strokeWidth={1.9} aria-hidden />
        )}
        <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border border-line bg-surface text-[12.5px] text-faint">
          <FileText className="size-2.5" aria-hidden />
        </span>
      </span>

      <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em] text-ink">
        {busy ? "正在上传报告…" : "拖拽报告到这里"}
      </h3>
      <p className="mt-1 max-w-[340px] text-[12.5px] leading-relaxed text-muted">
        支持 PDF、PNG、JPG，单个文件不超过 10 MB。上传后会自动识别指标并生成通俗解读。
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="h-9 px-3.5"
        >
          <UploadCloud className="size-3.5" aria-hidden />
          选择文件
        </Button>
        {onDemo ? (
          <>
            <span className="text-[12.5px] text-line-strong">或</span>
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={onDemo}
              disabled={busy}
              className="h-9 px-3.5"
            >
              <FileText className="size-3.5" aria-hidden />
              使用示例报告
            </Button>
          </>
        ) : null}
      </div>

      {dragging ? (
        <p className="mt-3 text-[13px] font-medium text-brand">松开即可上传</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-full bg-red-50 px-2.5 py-1 text-[12.5px] text-red-600">
          {error}
        </p>
      ) : null}

      <p className="mt-4 text-[12.5px] text-faint">
        示例报告为内置演示数据，无需上传真实文件
      </p>
    </div>
  );
}
