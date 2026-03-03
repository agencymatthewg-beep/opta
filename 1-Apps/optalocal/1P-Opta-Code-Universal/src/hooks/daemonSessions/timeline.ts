import type { V3Envelope } from "../../lib/daemonClient";
import type { TimelineItem, TurnStats } from "../../types";

export const STOP_EVENT_KINDS = new Set([
  "turn.done",
  "turn.error",
  "session.cancelled",
]);

export function makeSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function withFallbackTitle(index: number, title?: string): string {
  return title?.trim() || `Session ${index + 1}`;
}

export function eventsToTimelineItems(
  events: V3Envelope[],
  sessionId: string,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  let pendingText = "";

  const flushText = () => {
    if (!pendingText) return;
    items.push({
      id: `${sessionId}-text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "assistant",
      title: "Assistant",
      body: pendingText,
      createdAt: nowIso(),
    });
    pendingText = "";
  };

  for (const event of events) {
    const kind = String(event.event ?? "unknown");
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const seq = event.seq;

    if (kind === "turn.token") {
      const token =
        (payload.token as string) ||
        (payload.content as string) ||
        (payload.delta as string) ||
        (payload.text as string) ||
        "";
      pendingText += token;
      continue;
    }

    flushText();

    if (
      kind === "permission.request" ||
      kind === "permission.resolved" ||
      kind === "turn.start" ||
      kind === "ping" ||
      kind === "heartbeat"
    ) {
      continue;
    }

    if (STOP_EVENT_KINDS.has(kind)) {
      let stats: TurnStats | undefined;
      if (
        kind === "turn.done" &&
        payload.stats &&
        typeof payload.stats === "object"
      ) {
        const rawStats = payload.stats as Record<string, unknown>;
        stats = {
          tokens: Number(rawStats.tokens ?? rawStats.completionTokens ?? 0),
          speed: Number(rawStats.speed ?? 0),
          elapsed: Number(rawStats.elapsed ?? 0),
          toolCalls: Number(rawStats.toolCalls ?? 0),
        };
      }
      items.push({
        id: `${sessionId}-stop-${String(seq ?? Date.now())}`,
        kind: "system",
        title: kind === "turn.error" ? "Turn error" : "Turn complete",
        body:
          kind === "turn.error"
            ? String(payload.error ?? payload.message ?? "")
            : undefined,
        stats,
        createdAt: nowIso(),
      });
      continue;
    }

    if (kind === "turn.thinking") {
      items.push({
        id: `${sessionId}-thinking-${String(seq ?? Date.now())}`,
        kind: "thinking",
        title: "Thinking",
        body: String(payload.text ?? payload.content ?? payload.thinking ?? ""),
        createdAt: nowIso(),
      });
      continue;
    }

    if (kind === "tool.start") {
      const toolName = String(
        payload.toolName ?? payload.name ?? payload.tool_name ?? "?",
      );
      const args = payload.args ?? payload.input;
      items.push({
        id: `${sessionId}-tool-${String(seq ?? Date.now())}`,
        kind: "tool",
        title: toolName,
        body:
          args != null
            ? JSON.stringify(args, null, 2).slice(0, 600)
            : undefined,
        createdAt: nowIso(),
      });
      continue;
    }

    if (kind === "tool.end") {
      const toolContent = payload.result ?? payload.content ?? payload.output;
      const toolName = String(
        payload.toolName ?? payload.name ?? payload.tool_name ?? "",
      );
      items.push({
        id: `${sessionId}-result-${String(seq ?? Date.now())}`,
        kind: "tool",
        title: toolName || "result",
        body:
          typeof toolContent === "string"
            ? toolContent.slice(0, 600)
            : toolContent != null
              ? JSON.stringify(toolContent).slice(0, 400)
              : undefined,
        isToolResult: true,
        createdAt: nowIso(),
      });
      continue;
    }

    items.push({
      id: `${sessionId}-evt-${String(seq ?? Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
      kind: "event",
      title: kind,
      body:
        Object.keys(payload).length > 0
          ? JSON.stringify(payload).slice(0, 200)
          : undefined,
      createdAt: nowIso(),
    });
  }

  flushText();
  return items;
}
