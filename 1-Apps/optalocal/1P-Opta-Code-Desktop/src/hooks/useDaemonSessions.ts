import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { daemonClient } from "../lib/daemonClient";
import {
  clearToken,
  isSecureConnectionStoreAvailable,
  loadToken,
  saveToken,
} from "../lib/secureConnectionStore";
import type { V3Envelope } from "../lib/daemonClient";
import type {
  DaemonConnectionOptions,
  DaemonSessionSummary,
  PermissionRequest,
  RuntimeSnapshot,
  TimelineItem,
  TurnStats,
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

function saveConnection(
  conn: DaemonConnectionOptions,
  persistToken: boolean,
): void {
  try {
    const stored: Partial<DaemonConnectionOptions> = {
      host: conn.host,
      port: conn.port,
      protocol: conn.protocol,
    };
    if (persistToken) {
      stored.token = conn.token;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
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
      let stats: TurnStats | undefined;
      if (kind === "turn.done" && payload.stats && typeof payload.stats === "object") {
        const s = payload.stats as Record<string, unknown>;
        stats = {
          tokens: Number(s.tokens ?? s.completionTokens ?? 0),
          speed: Number(s.speed ?? 0),
          elapsed: Number(s.elapsed ?? 0),
          toolCalls: Number(s.toolCalls ?? 0),
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

// ── Tauri invoke bridge for session persistence ────────────────────────────
type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface TauriBridge {
  core?: { invoke?: TauriInvoke };
}

function getTauriInvoke(): TauriInvoke | null {
  const bridge = (globalThis as { __TAURI__?: TauriBridge }).__TAURI__;
  const fn_ = bridge?.core?.invoke;
  return typeof fn_ === "function" ? fn_ : null;
}

// ── WS handle kept per session in a stable ref map ─────────────────────────
interface WsHandle {
  close: () => void;
  send: (msg: object) => void;
}

export function useDaemonSessions() {
  const [connection, setConnectionRaw] =
    useState<DaemonConnectionOptions>(loadStoredConnection);
  // Mirror connection into a ref so callbacks always use the latest settings.
  const connectionRef = useRef(connection);
  // Serialize secure-store operations to avoid out-of-order writes.
  const secureStoreQueueRef = useRef<Promise<void>>(Promise.resolve());

  const setConnection = useCallback((next: DaemonConnectionOptions) => {
    const previous = connectionRef.current;
    const secureStoreAvailable = isSecureConnectionStoreAvailable();
    const endpointChanged =
      previous.host !== next.host || previous.port !== next.port;

    // Keep plaintext token persistence only for browser/dev fallback mode.
    saveConnection(next, !secureStoreAvailable);
    setConnectionRaw(next);

    if (!secureStoreAvailable) return;
    const token = next.token.trim();
    secureStoreQueueRef.current = secureStoreQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (token) {
          await saveToken(next.host, next.port, token);
          return;
        }
        // A blank token on endpoint switch means "try existing token for this
        // endpoint", not "delete this endpoint token".
        if (!endpointChanged) {
          await clearToken(next.host, next.port);
        }
      })
      .catch(() => {
        // Fallback for runtime/bridge failures: keep token persisted locally.
        saveConnection(next, true);
      });

    // If endpoint changed and the token is blank, try loading any existing
    // credential from secure storage for that endpoint.
    if (!token && endpointChanged) {
      secureStoreQueueRef.current = secureStoreQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const loadedToken = await loadToken(next.host, next.port);
          if (!loadedToken) return;
          setConnectionRaw((current) =>
            current.host === next.host &&
              current.port === next.port &&
              !current.token
              ? { ...current, token: loadedToken }
              : current,
          );
        })
        .catch(() => {
          saveConnection(next, true);
        });
    }
  }, []);

  const [sessions, setSessions] = useLocalStorage<DaemonSessionSummary[]>("opta:sessions", []);
  const [activeSessionId, setActiveSessionId] = useLocalStorage<string | null>("opta:activeSessionId", null);
  const [timelineBySession, setTimelineBySession] = useState<
    Record<string, TimelineItem[]>
  >({});
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("disconnected");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [runtimeOverride, setRuntimeOverride] =
    useState<RuntimeSnapshot | null>(null);

  // Per-session streaming and permission state — supports N concurrent sessions
  const [streamingBySession, setStreamingBySession] = useState<
    Record<string, boolean>
  >({});
  const [pendingPermissionsBySession, setPendingPermissionsBySession] = useState<
    Record<string, PermissionRequest[]>
  >({});

  const mountedRef = useRef(true);
  // Per-session event sequence cursor — advances as events arrive over WS
  const seqCursorRef = useRef<Record<string, number>>({});
  // Stable client ID for multi-writer protocol identification
  const clientIdRef = useRef<string>(
    `opta-code-desktop-${crypto.randomUUID().slice(0, 8)}`,
  );
  // One WS handle per session — fan-out subscriptions
  const wsHandlesRef = useRef<Map<string, WsHandle>>(new Map());

  connectionRef.current = connection;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // On native desktop runtimes, pull token from secure storage and clear
  // any legacy plaintext token persistence from localStorage.
  useEffect(() => {
    if (!isSecureConnectionStoreAvailable()) return;
    let cancelled = false;
    const host = connection.host;
    const port = connection.port;

    secureStoreQueueRef.current = secureStoreQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const legacyToken = connectionRef.current.token.trim();
        if (legacyToken) {
          await saveToken(host, port, legacyToken);
        }
        saveConnection(connectionRef.current, false);
        const storedToken = await loadToken(host, port);
        if (cancelled) return;
        if (!storedToken || storedToken === connectionRef.current.token) return;
        setConnectionRaw((current) =>
          current.host === host && current.port === port
            ? { ...current, token: storedToken }
            : current,
        );
      })
      .catch(() => {
        saveConnection(connectionRef.current, true);
      });

    return () => {
      cancelled = true;
    };
  }, [connection.host, connection.port]);

  // ── Multi-session WebSocket fan-out ────────────────────────────────────────
  // Keyed on a stable string of all session IDs + connection endpoint so the
  // effect only re-runs when sessions are added/removed or the endpoint changes.
  const sessionIdsKey = sessions.map((s) => s.sessionId).join(",");

  useEffect(() => {
    // Snapshot the connection once; this effect owns its own conn reference
    const conn = connectionRef.current;
    const currentSessionIds = new Set(sessionIdsKey ? sessionIdsKey.split(",") : []);

    // ── Close WS for sessions no longer tracked ──
    for (const [id, handle] of wsHandlesRef.current) {
      if (!currentSessionIds.has(id)) {
        handle.close();
        // wsHandlesRef.current is mutated inside handle.close() via the
        // internal close callback, but we force-delete here as well.
        wsHandlesRef.current.delete(id);
        setStreamingBySession((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setPendingPermissionsBySession((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }

    // ── Open WS for newly-tracked sessions ──
    for (const sessionId of currentSessionIds) {
      if (wsHandlesRef.current.has(sessionId)) continue; // already subscribed

      let reconnectTimer: number | null = null;
      let attempts = 0;
      let innerHandle: ReturnType<typeof daemonClient.connectWebSocket> | null = null;
      const cursor = { seq: seqCursorRef.current[sessionId] ?? 0 };

      const handleEnvelope = (envelope: V3Envelope) => {
        if (!mountedRef.current) return;
        if (typeof envelope.seq === "number") {
          cursor.seq = envelope.seq;
          seqCursorRef.current[sessionId] = envelope.seq;
        }

        // Fire-and-forget persistence to disk (Stream F)
        const invoke = getTauriInvoke();
        if (invoke) {
          invoke("append_session_event", {
            sessionId,
            eventJson: JSON.stringify(envelope),
          }).catch(() => {});
        }

        const kind = String(envelope.event ?? "");
        const payload = (envelope.payload ?? {}) as Record<string, unknown>;

        // ── Permission state management ─────────────────────────────────
        if (kind === "permission.request") {
          const requestId = String(payload.requestId ?? payload.request_id ?? "");
          const toolName = String(
            payload.toolName ?? payload.tool_name ?? payload.name ?? "",
          );
          const args = (payload.args ?? payload.input ?? {}) as Record<string, unknown>;
          if (requestId) {
            setPendingPermissionsBySession((prev) => {
              const existing = prev[sessionId] ?? [];
              if (existing.some((p) => p.requestId === requestId)) return prev;
              return {
                ...prev,
                [sessionId]: [...existing, { requestId, toolName, args, sessionId }],
              };
            });
          }
          return;
        }

        if (kind === "permission.resolved") {
          const requestId = String(payload.requestId ?? payload.request_id ?? "");
          if (requestId) {
            setPendingPermissionsBySession((prev) => {
              const existing = prev[sessionId];
              if (!existing) return prev;
              return {
                ...prev,
                [sessionId]: existing.filter((p) => p.requestId !== requestId),
              };
            });
          }
          return;
        }

        // ── Streaming indicator (per-session) ───────────────────────────
        if (kind === "turn.start") {
          setStreamingBySession((prev) => ({ ...prev, [sessionId]: true }));
        } else if (STOP_EVENT_KINDS.has(kind)) {
          setStreamingBySession((prev) => {
            if (!prev[sessionId]) return prev;
            return { ...prev, [sessionId]: false };
          });
        }

        // ── Timeline update ──────────────────────────────────────────────
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
        if (!mountedRef.current || !wsHandlesRef.current.has(sessionId)) return;

        innerHandle = daemonClient.connectWebSocket(conn, sessionId, cursor.seq, {
          onOpen: () => {
            attempts = 0;
          },
          onEvent: (envelope) => {
            if (!mountedRef.current) return;
            handleEnvelope(envelope);
          },
          onClose: (code) => {
            innerHandle = null;
            if (!mountedRef.current || !wsHandlesRef.current.has(sessionId)) return;
            if (code !== 1000) {
              // Exponential backoff: 1s, 2s, 4s, 8s, capped at 10s
              const delay = Math.min(1000 * Math.pow(2, attempts), 10_000);
              attempts = Math.min(attempts + 1, 10);
              reconnectTimer = window.setTimeout(open, delay);
            }
          },
          onError: () => {
            // WebSocket errors are always followed by an onClose event
          },
        });
      };

      const handle: WsHandle = {
        close: () => {
          if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
          innerHandle?.close();
          innerHandle = null;
          wsHandlesRef.current.delete(sessionId);
        },
        send: (msg) => innerHandle?.send(msg),
      };

      wsHandlesRef.current.set(sessionId, handle);
      open();
    }

    // Full teardown when the connection endpoint changes or on unmount
    return () => {
      for (const handle of wsHandlesRef.current.values()) {
        handle.close();
      }
      wsHandlesRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdsKey, connection]);

  // ── Runtime metrics poll (4s) ───────────────────────────────────────────────
  const runtime = useMemo<RuntimeSnapshot>(() => {
    if (runtimeOverride) return runtimeOverride;
    const streamingCount = Object.values(streamingBySession).filter(Boolean).length;
    return {
      sessionCount: sessions.length,
      activeTurnCount: streamingCount,
      queuedTurnCount: Math.max(0, sessions.length - streamingCount),
      subscriberCount: sessions.length,
    };
  }, [runtimeOverride, sessions.length, streamingBySession]);

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
    refreshNow().finally(() => setInitialCheckDone(true));
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

      // Load persisted events from disk (Stream F)
      const invoke = getTauriInvoke();
      if (invoke) {
        try {
          const lines = (await invoke("load_session_events", {
            sessionId,
          })) as string[];
          if (lines.length > 0) {
            const envelopes: V3Envelope[] = [];
            const seenSeqs = new Set<number>();
            for (const line of lines) {
              try {
                const env = JSON.parse(line) as V3Envelope;
                if (typeof env.seq === "number") {
                  if (seenSeqs.has(env.seq)) continue;
                  seenSeqs.add(env.seq);
                }
                envelopes.push(env);
              } catch {
                // skip malformed lines
              }
            }
            const items = eventsToTimelineItems(envelopes, sessionId);
            if (items.length > 0) {
              setTimelineBySession((prev) => ({
                ...prev,
                [sessionId]: items,
              }));
            }
          }
        } catch {
          // persistence unavailable, continue without
        }
      }
    },
    [],
  );

  const submitMessage = useCallback(
    async (message: string, mode: "chat" | "do" = "chat") => {
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
              title: mode === "do" ? "Do" : "Prompt",
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
          mode,
        });
        setConnectionState("connected");
        setConnectionError(null);
        // Optimistically mark streaming — WS will clear on turn.done/turn.error
        setStreamingBySession((prev) => ({ ...prev, [activeSessionId]: true }));
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
      setPendingPermissionsBySession((prev) => {
        const existing = prev[activeSessionId];
        if (!existing) return prev;
        return {
          ...prev,
          [activeSessionId]: existing.filter((p) => p.requestId !== requestId),
        };
      });
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

  // Derived values — backward-compatible surface for consumers that only care
  // about the currently-active session
  const isStreaming =
    activeSessionId !== null &&
    (streamingBySession[activeSessionId] ?? false);

  const pendingPermissions =
    activeSessionId !== null
      ? (pendingPermissionsBySession[activeSessionId] ?? [])
      : [];

  /** Remove a session from local tracking. Does not delete it from the daemon. */
  const removeSession = useCallback(
    (sessionId: string) => {
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      setTimelineBySession((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
      if (activeSessionId === sessionId) setActiveSessionId(null);
    },
    [activeSessionId],
  );

  return {
    activeSessionId,
    cancelActiveTurn,
    connection,
    connectionError,
    connectionState,
    isStreaming,
    pendingPermissions,
    // Per-session state — enables multi-session UI (badges, parallel views)
    streamingBySession,
    pendingPermissionsBySession,
    refreshNow,
    removeSession,
    resolvePermission,
    runtime,
    sessions,
    setActiveSessionId,
    setConnection,
    submitMessage,
    timelineBySession,
    trackSession,
    createSession,
    initialCheckDone,
  };
}
