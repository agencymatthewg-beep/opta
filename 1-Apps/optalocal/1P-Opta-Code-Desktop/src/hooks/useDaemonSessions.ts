import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type {
  DaemonConnectionOptions,
  DaemonSessionSummary,
  RuntimeSnapshot,
  TimelineItem,
} from "../types";

const DEFAULT_CONNECTION: DaemonConnectionOptions = {
  host: "127.0.0.1",
  port: 3456,
  token: "",
};

const RUNTIME_POLL_MS = 4000;
const EVENT_POLL_MS = 500;
const STOP_EVENT_KINDS = new Set([
  "turn.end",
  "turn.complete",
  "turn.error",
  "session.closed",
]);

function makeSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function withFallbackTitle(index: number, title?: string): string {
  return title?.trim() || `Session ${index + 1}`;
}

type DaemonEvent = Record<string, unknown>;

function eventsToTimelineItems(
  events: DaemonEvent[],
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
    const kind = String(event.kind ?? "unknown");
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const seq = event.seq;

    // Accumulate text deltas into a single assistant card per batch
    if (
      kind === "text.delta" ||
      kind === "text.chunk" ||
      kind === "content_block_delta"
    ) {
      const delta =
        (payload.content as string) ||
        (payload.delta as string) ||
        (payload.text as string) ||
        "";
      pendingText += delta;
      continue;
    }

    // Non-text event: flush any accumulated text first
    flushText();

    if (STOP_EVENT_KINDS.has(kind)) {
      items.push({
        id: `${sessionId}-stop-${String(seq ?? Date.now())}`,
        kind: "system",
        title: kind === "turn.error" ? "Turn error" : "Turn complete",
        body:
          kind === "turn.error"
            ? String(payload.error ?? payload.message ?? "")
            : undefined,
        createdAt: nowIso(),
      });
      continue;
    }

    if (kind === "tool.call" || kind === "tool_use") {
      items.push({
        id: `${sessionId}-tool-${String(seq ?? Date.now())}`,
        kind: "tool",
        title: `Tool: ${String(payload.name ?? payload.tool_name ?? "?")}`,
        body:
          payload.input != null
            ? JSON.stringify(payload.input, null, 2).slice(0, 400)
            : undefined,
        createdAt: nowIso(),
      });
      continue;
    }

    if (kind === "tool.result" || kind === "tool_result") {
      const toolContent = payload.content ?? payload.output ?? payload.result;
      items.push({
        id: `${sessionId}-result-${String(seq ?? Date.now())}`,
        kind: "tool",
        title: "Tool result",
        body:
          typeof toolContent === "string"
            ? toolContent.slice(0, 300)
            : toolContent != null
              ? JSON.stringify(toolContent).slice(0, 300)
              : undefined,
        createdAt: nowIso(),
      });
      continue;
    }

    // Suppress noise
    if (kind === "turn.start" || kind === "ping" || kind === "heartbeat") {
      continue;
    }

    // Catch-all for any other event kind
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

export function useDaemonSessions() {
  const [connection, setConnection] =
    useState<DaemonConnectionOptions>(DEFAULT_CONNECTION);
  const [sessions, setSessions] = useState<DaemonSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [timelineBySession, setTimelineBySession] = useState<
    Record<string, TimelineItem[]>
  >({});
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("disconnected");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [runtimeOverride, setRuntimeOverride] =
    useState<RuntimeSnapshot | null>(null);
  const [streamingSessionId, setStreamingSessionId] = useState<string | null>(
    null,
  );

  const mountedRef = useRef(true);
  // Per-session event sequence cursor — survives re-renders without triggering them
  const seqCursorRef = useRef<Record<string, number>>({});
  const pollingSessionRef = useRef<string | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  // Mirror connection into a ref so the async polling closure always has the latest value
  const connectionRef = useRef(connection);
  connectionRef.current = connection;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const stopEventPolling = useCallback(() => {
    if (pollingTimerRef.current !== null) {
      window.clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
    const stoppedSession = pollingSessionRef.current;
    pollingSessionRef.current = null;
    if (stoppedSession) {
      setStreamingSessionId((prev) =>
        prev === stoppedSession ? null : prev,
      );
    }
  }, []);

  const startEventPolling = useCallback(
    (sessionId: string) => {
      // Clear any previous interval without resetting streamingSessionId to null first
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      pollingSessionRef.current = sessionId;
      setStreamingSessionId(sessionId);

      const poll = async () => {
        if (!mountedRef.current || pollingSessionRef.current !== sessionId)
          return;

        const afterSeq = seqCursorRef.current[sessionId] ?? 0;
        try {
          const { events } = await daemonClient.sessionEvents(
            connectionRef.current,
            sessionId,
            afterSeq,
          );

          if (!mountedRef.current || pollingSessionRef.current !== sessionId)
            return;

          if (events.length > 0) {
            const lastSeq = events[events.length - 1]?.seq;
            if (typeof lastSeq === "number") {
              seqCursorRef.current[sessionId] = lastSeq;
            }

            const newItems = eventsToTimelineItems(events, sessionId);
            if (newItems.length > 0) {
              setTimelineBySession((prev) => {
                const existing = prev[sessionId] ?? [];
                return { ...prev, [sessionId]: [...existing, ...newItems] };
              });
            }

            const hasTerminal = events.some((e) =>
              STOP_EVENT_KINDS.has(String(e.kind ?? "")),
            );
            if (hasTerminal) {
              stopEventPolling();
            }
          }
        } catch {
          stopEventPolling();
        }
      };

      void poll();
      pollingTimerRef.current = window.setInterval(() => {
        void poll();
      }, EVENT_POLL_MS);
    },
    [stopEventPolling],
  );

  useEffect(() => {
    return () => {
      stopEventPolling();
    };
  }, [stopEventPolling]);

  const runtime = useMemo<RuntimeSnapshot>(() => {
    if (runtimeOverride) return runtimeOverride;
    const activeTurnCount = activeSessionId ? 1 : 0;
    return {
      sessionCount: sessions.length,
      activeTurnCount,
      queuedTurnCount: Math.max(0, sessions.length - activeTurnCount),
      subscriberCount: activeSessionId ? 1 : 0,
    };
  }, [activeSessionId, runtimeOverride, sessions.length]);

  const refreshNow = useCallback(async () => {
    setConnectionState("connecting");
    try {
      const [health, metrics] = await Promise.all([
        daemonClient.health(connection),
        daemonClient.metrics(connection).catch(() => null),
      ]);

      if (!mountedRef.current) return;

      if (health.status) {
        setConnectionState("connected");
        setConnectionError(null);
      }

      const runtimeMetrics = metrics?.runtime;
      if (runtimeMetrics) {
        setRuntimeOverride({
          sessionCount: runtimeMetrics.sessionCount ?? sessions.length,
          activeTurnCount: runtimeMetrics.activeTurnCount ?? 0,
          queuedTurnCount: runtimeMetrics.queuedTurnCount ?? 0,
          subscriberCount: runtimeMetrics.subscriberCount ?? 0,
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setConnectionState("disconnected");
      setConnectionError(
        error instanceof Error ? error.message : String(error),
      );
      setRuntimeOverride(null);
    }
  }, [connection, sessions.length]);

  useEffect(() => {
    void refreshNow();
    const timer = window.setInterval(() => {
      void refreshNow();
    }, RUNTIME_POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshNow]);

  const createSession = useCallback(
    async (opts: { workspace: string; title?: string }) => {
      const fallbackId = makeSessionId();
      const fallbackWorkspace = opts.workspace || "Workspace";
      const fallbackTitle = withFallbackTitle(sessions.length, opts.title);

      try {
        const created = await daemonClient.createSession(connection, {
          workspace: fallbackWorkspace,
          title: fallbackTitle,
        });
        const sessionId = created.sessionId || fallbackId;
        const nextSession: DaemonSessionSummary = {
          sessionId,
          workspace: created.workspace || fallbackWorkspace,
          title: created.title || fallbackTitle,
          updatedAt: created.updatedAt || nowIso(),
        };
        if (!mountedRef.current) return sessionId;
        setSessions((prev) => {
          const existing = prev.find((item) => item.sessionId === sessionId);
          if (existing) return prev;
          return [nextSession, ...prev];
        });
        setActiveSessionId(sessionId);
        setTimelineBySession((prev) => ({
          ...prev,
          [sessionId]: [
            {
              id: `${sessionId}-boot`,
              kind: "system",
              title: "Session created",
              body: "Daemon accepted session and is ready for prompts.",
              createdAt: nowIso(),
            },
          ],
        }));
        setConnectionState("connected");
        setConnectionError(null);
        return sessionId;
      } catch {
        const sessionId = fallbackId;
        if (mountedRef.current) {
          setSessions((prev) => [
            {
              sessionId,
              workspace: fallbackWorkspace,
              title: fallbackTitle,
              updatedAt: nowIso(),
            },
            ...prev,
          ]);
          setActiveSessionId(sessionId);
          setTimelineBySession((prev) => ({
            ...prev,
            [sessionId]: [
              {
                id: `${sessionId}-offline`,
                kind: "system",
                title: "Offline session",
                body: "Daemon unavailable; working in local fallback mode.",
                createdAt: nowIso(),
              },
            ],
          }));
        }
        return sessionId;
      }
    },
    [connection, sessions.length],
  );

  const trackSession = useCallback(
    async (sessionId: string, workspace?: string) => {
      setSessions((prev) => {
        if (prev.some((session) => session.sessionId === sessionId))
          return prev;
        return [
          {
            sessionId,
            title: `Tracked ${sessionId.slice(0, 7)}`,
            workspace: workspace || "Tracked",
            updatedAt: nowIso(),
          },
          ...prev,
        ];
      });
      setActiveSessionId(sessionId);
      setConnectionError(null);
    },
    [],
  );

  const submitMessage = useCallback(
    async (message: string) => {
      if (!activeSessionId) {
        throw new Error("No active session selected.");
      }

      setTimelineBySession((prev) => {
        const existing = prev[activeSessionId] ?? [];
        return {
          ...prev,
          [activeSessionId]: [
            ...existing,
            {
              id: `${activeSessionId}-user-${Date.now()}`,
              kind: "user",
              title: "Prompt",
              body: message,
              createdAt: nowIso(),
            },
          ],
        };
      });

      try {
        await daemonClient.submitTurn(connection, activeSessionId, {
          content: message,
        });
        setConnectionState("connected");
        setConnectionError(null);
        // Wire up live event streaming now that the daemon has the turn
        startEventPolling(activeSessionId);
      } catch (error) {
        setTimelineBySession((prev) => {
          const existing = prev[activeSessionId] ?? [];
          return {
            ...prev,
            [activeSessionId]: [
              ...existing,
              {
                id: `${activeSessionId}-error-${Date.now()}`,
                kind: "system",
                title: "Send failed",
                body: error instanceof Error ? error.message : String(error),
                createdAt: nowIso(),
              },
            ],
          };
        });
        setConnectionState("disconnected");
        throw error;
      }
    },
    [activeSessionId, connection, startEventPolling],
  );

  const isStreaming =
    streamingSessionId !== null && streamingSessionId === activeSessionId;

  return {
    activeSessionId,
    connection,
    connectionError,
    connectionState,
    isStreaming,
    refreshNow,
    runtime,
    sessions,
    setActiveSessionId,
    setConnection,
    submitMessage,
    timelineBySession,
    trackSession,
    createSession,
  };
}
