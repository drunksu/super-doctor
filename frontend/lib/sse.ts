import { API_BASE, ApiError, getToken } from "./api";
import type { StreamEvent, StreamEventName } from "./types";

const KNOWN_EVENTS = new Set<StreamEventName>([
  "run_started",
  "agent",
  "token",
  "tool",
  "citation",
  "intake",
  "safety",
  "memory",
  "interrupt",
  "done",
  "error",
]);

type ParsedFrame = { event: string; data: unknown };

/**
 * Incremental SSE frame parser. Accepts arbitrary chunk boundaries because the
 * caller keeps the unconsumed tail in `buffer`.
 */
export function parseSSEFrame(frame: string): ParsedFrame | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of frame.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    else if (field === "data") dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(raw) as unknown };
  } catch {
    return null;
  }
}

function toStreamEvent(parsed: ParsedFrame): StreamEvent | null {
  if (!KNOWN_EVENTS.has(parsed.event as StreamEventName)) return null;
  return { type: parsed.event, data: parsed.data } as StreamEvent;
}

export type StreamChatOptions = {
  signal?: AbortSignal;
  onEvent: (event: StreamEvent) => void;
  onOpen?: () => void;
};

/**
 * POST /chat/stream and consume the SSE response as a ReadableStream.
 * The promise resolves when the server closes the stream (normally after
 * `done`), and rejects with ApiError on transport/HTTP errors or AbortError.
 */
export async function streamChat(
  payload: { session_id: string; message: string },
  { signal, onEvent, onOpen }: StreamChatOptions,
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("network");
  }

  if (!response.ok) {
    let code = "bad_request";
    let message: string | undefined;
    try {
      const parsed = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      code = parsed.error?.code ?? (response.status === 401 ? "unauthorized" : code);
      message = parsed.error?.message;
    } catch {
      if (response.status === 401) code = "unauthorized";
    }
    throw new ApiError(code, message, response.status);
  }

  if (!response.body) {
    throw new ApiError("upstream_unavailable", "当前浏览器不支持流式响应");
  }

  onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;

  const dispatch = (frame: string): boolean => {
    const parsed = parseSSEFrame(frame);
    if (!parsed) return false;
    const event = toStreamEvent(parsed);
    if (!event) return false;
    onEvent(event);
    return event.type === "done" || event.type === "error";
  };

  try {
    while (!finished) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      // Normalise CRLF only after appending, so a split "\r" + "\n" still matches.
      buffer = buffer.replace(/\r\n/g, "\n");

      let separator = buffer.indexOf("\n\n");
      while (separator !== -1) {
        const frame = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        if (dispatch(frame)) {
          finished = true;
          break;
        }
        separator = buffer.indexOf("\n\n");
      }
    }

    if (!finished) {
      const tail = buffer.trim();
      if (tail) dispatch(tail);
    }
  } finally {
    if (finished) {
      try {
        await reader.cancel();
      } catch {
        /* stream already closed */
      }
    }
    reader.releaseLock();
  }
}
