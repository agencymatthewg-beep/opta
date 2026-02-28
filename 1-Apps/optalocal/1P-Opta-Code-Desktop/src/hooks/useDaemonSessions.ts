import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { V3Envelope } from "../lib/daemonClient";
import type {
  DaemonConnectionOptions,
  DaemonSessionSummary,
  PermissionRequest,
  RuntimeSnapshot,
  TimelineItem,
} from "../types";

const DEFAULT_CONNECTION: DaemonConnectionOptions = {
  host: "127.0.0.1",
  port: 9999,
  token: "",
};

const STORAGE_KEY = "opta:daemon-connection";

function loadStoredConnection(): DaemonConnectionOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONNECTION;
    const parsed = JSON.parse(raw) as Partial<DaemonConnectionOptions>;
    return {
      host: typeof parsed.host === "string" ? parsed.host : DEFAULT_CONNECTION.host,
      port: typeof parsed.port === "number" ? parsed.port : DEFAULT_CONNECTION.port,
      token: typeof parsed.token === "string" ? parsed.token : DEFAULT_CONNECTION.token,
      protocol: parsed.protocol ?? DEFAULT_CONNECTION.protocol,
    };
  } catch {
    return DEFAULT_CONNECTION;
  }
}

function saveConnection(conn: DaemonConnectionOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
  } catch {
    // ignore quota/security errors
  }
}

const RUNTIME_POLL_MS = 4000;

const STOP_EVENT_KINDS = new Set([
  "turn.done",
  "turn.error",
  "session.cancelled",
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

function eventsToTimelineItems(
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

    // Accumulate streaming tokens into a single assistant card per batch
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

    // Non-text event: flush any accumulated text first
    flushText();

    // Permission and resolved events are handled in the WS event handler
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

    if (kind === "tool.end") {
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
  const [connection, setConnectionRaw] =
    useState<DaemonConnectionOptions>(loadStoredConnection);

  const setConnection = useCallback((conn: DaemonConnectionOptions) => {
    saveConnection(conn);
    setConnectionRaw(conn);
  }, []);
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
  const [pendingPermissions, setPendingPermissions] = useState<
    PermissionRequest[]
  >([]);

  const mountedRef = useRef(true);
  // Per-session event sequence cursor — advances as events arrive over WS
  const seqCursorRef = useRef<Record<string, number>>({});
  // Stable client ID for multi-writer protocol identification
  const clientIdRef = useRef<string>(
    `opta-code-desktop-${crypto.randomUUID().slice(0, 8)}`,
  );
  // Mirror connection into a ref so HTTP callbacks always use the latest settings
  const connectionRef = useRef(connection);
  connectionRef.current = connection;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── WebSocket session subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!activeSessionId) {
      setPendingPermissions([]);
      return;
    }

    const sessionId = activeSessionId;
    const conn = connection;
    let closed = false;
    let reconnectTimer: number | null = null;
    let attempts = 0;
    let wsHandle: { close: () => void; send: (msg: object) => void } | null =
      null;

    // Cursor carries forward across reconnects so history is never re-sent
    const cursor = { seq: seqCursorRef.current[sessionId] ?? 0 };

    // Clear stale permissions from a previous session
    setPendingPermissions([]);

    const handleEnvelope = (envelope: V3Envelope) => {
      if (typeof envelope.seq === "number") {
        cursor.seq = envelope.seq;
        seqCursorRef.current[sessionId] = envelope.seq;
      }

      const kind = String(envelope.event ?? "");
      const payload = (envelope.payload ?? {}) as Record<string, unknown>;

      // ── Permission state management ───────────────────────────────────────
      if (kind === "permission.request") {
        const requestId = String(payload.requestId ?? payload.request_id ?? "");
        const toolName = String(
          payload.toolName ?? payload.tool_name ?? payload.name ?? "",
        );
        const args = (payload.args ?? payload.input ?? {}) as Record<
          string,
          unknown
        >;
        if (requestId) {
          setPendingPermissions((prev) => {
            if (prev.some((p) => p.requestId === requestId)) return prev;
            return [...prev, { requestId, toolName, args, sessionId }];
          });
        }
        return;
      }

      if (kind === "permission.resolved") {
        const requestId = String(payload.requestId ?? payload.request_id ?? "");
        if (requestId) {
          setPendingPermissions((prev) =>
            prev.filter((p) => p.requestId !== requestId),
          );
        }
        return;
      }

      // ── Streaming indicator ───────────────────────────────────────────────
      if (kind === "turn.start") {
        setStreamingSessionId(sessionId);
      } else if (STOP_EVENT_KINDS.has(kind)) {
        setStreamingSessionId((prev) => (prev === sessionId ? null : prev));
      }

      // ── Timeline update ───────────────────────────────────────────────────
      const newItems = eventsToTimelineItems([envelope], sessionId);
      if (newItems.length === 0) return;

      setTimelineBySession((prev) => {
        const existing = prev[sessionId] ?? [];

        // Merge adjacent assistant tokens for smooth in-place streaming
        if (
          newItems.length === 1 &&
          newItems[0].kind === "assistant" &&
          existing.length > 0 &&
          existing[existing.length - 1].kind === "assistant"
        ) {
          const last = existing[existing.length - 1];
          const merged = {
            ...last,
            body: (last.body ?? "") + (newItems[0].body ?? ""),
          };
          return {
            ...prev,
            [sessionId]: [...existing.slice(0, -1), merged],
          };
        }

        return { ...prev, [sessionId]: [...existing, ...newItems] };
      });
    };

    const open = () => {
      if (closed || !mountedRef.current) return;

      wsHandle = daemonClient.connectWebSocket(conn, sessionId, cursor.seq, {
        onOpen: () => {
          if (closed || !mountedRef.current) return;
          attempts = 0;
          setConnectionState("connected");
          setConnectionError(null);
        },
        onEvent: (envelope) => {
          if (closed || !mountedRef.current) return;
          handleEnvelope(envelope);
        },
        onClose: (code) => {
          wsHandle = null;
          if (closed || !mountedRef.current) return;
          if (code !== 1000) {
            // Exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
            const delay = Math.min(1000 * Math.pow(2, attempts), 10_000);
            attempts = Math.min(attempts + 1, 10);
            setConnectionState("connecting");
            reconnectTimer = window.setTimeout(open, delay);
          }
        },
        onError: () => {
          // WebSocket errors are always followed by an onClose event
        },
      });
    };

    setConnectionState("connecting");
    open();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsHandle?.close();
      wsHandle = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, connection]);

  // ── Runtime metrics poll (4s) ───────────────────────────────────────────────
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
          clientId: clientIdRef.current,
          writerId: clientIdRef.current,
          mode: "chat",
        });
        setConnectionState("connected");
        setConnectionError(null);
        // Show streaming indicator — the WS will clear it on turn.done/turn.error
        setStreamingSessionId(activeSessionId);
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
    [activeSessionId, connection],
  );

  const resolvePermission = useCallback(
    async (requestId: string, decision: "allow" | "deny") => {
      if (!activeSessionId) return;
      // Optimistically remove from pending — the 'permission.resolved' WS event
      // will also remove it if it arrives, but this keeps the UI snappy
      setPendingPermissions((prev) =>
        prev.filter((p) => p.requestId !== requestId),
      );
      try {
        await daemonClient.resolvePermission(
          connectionRef.current,
          activeSessionId,
          requestId,
          decision,
          clientIdRef.current,
        );
      } catch (error) {
        console.error("resolvePermission failed:", error);
      }
    },
    [activeSessionId],
  );

  const cancelActiveTurn = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await daemonClient.cancel(connectionRef.current, activeSessionId, {
        writerId: clientIdRef.current,
      });
    } catch (error) {
      console.error("cancelActiveTurn failed:", error);
    }
  }, [activeSessionId]);

  const isStreaming =
    streamingSessionId !== null && streamingSessionId === activeSessionId;

  return {
    activeSessionId,
    cancelActiveTurn,
    connection,
    connectionError,
    connectionState,
    isStreaming,
    pendingPermissions,
    refreshNow,
    resolvePermission,
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
