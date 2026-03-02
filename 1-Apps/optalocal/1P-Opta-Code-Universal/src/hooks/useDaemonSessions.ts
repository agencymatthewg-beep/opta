import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { daemonClient } from "../lib/daemonClient";
import {
  bootstrapDaemonConnection,
  clearToken,
  isSecureConnectionStoreAvailable,
  loadToken,
  saveToken,
} from "../lib/secureConnectionStore";
import { getTauriInvoke } from "../lib/runtime";
import type { V3Envelope } from "../lib/daemonClient";
import type {
  DaemonConnectionOptions,
  DaemonSessionSummary,
  PermissionRequest,
  RuntimeSnapshot,
  TimelineItem,
} from "../types";
import {
  loadStoredConnection,
  saveConnection,
} from "./daemonSessions/connectionStorage";
import {
  makeSessionId,
  nowIso,
  withFallbackTitle,
  eventsToTimelineItems,
} from "./daemonSessions/timeline";
import {
  useSessionSockets,
  type WsHandle,
} from "./daemonSessions/useSessionSockets";

const RUNTIME_POLL_MS = 4000;
const RUNTIME_POLL_MAX_MS = 30000;
const AUTH_REPAIR_COOLDOWN_MS = 30000;

function isLocalEndpointHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized === "0.0.0.0"
  );
}

function isAuthFailure(error: unknown): boolean {
  if (error instanceof Error) {
    return /\b(401|403)\b/.test(error.message);
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return status === 401 || status === 403;
  }
  return false;
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
  const [runtimePollDelayMs, setRuntimePollDelayMs] = useState(RUNTIME_POLL_MS);
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
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const runtimePollDelayRef = useRef(RUNTIME_POLL_MS);
  const lastAuthRepairAtRef = useRef(0);
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
    const localEndpoint = isLocalEndpointHost(host);

    secureStoreQueueRef.current = secureStoreQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (localEndpoint) {
          try {
            await bootstrapDaemonConnection(true);
          } catch {
            // Bootstrap is best-effort; keep existing secure-store flow.
          }
        }
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

  useSessionSockets({
    connection,
    sessionIds: sessions.map((session) => session.sessionId),
    mountedRef,
    seqCursorRef,
    wsHandlesRef,
    setTimelineBySession,
    setStreamingBySession,
    setPendingPermissionsBySession,
  });

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
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const runRefresh = (async () => {
      setConnectionState((prev) => (prev === "connected" ? prev : "connecting"));
      try {
        const runHealthCheck = async (conn: DaemonConnectionOptions) => {
          const [health, metrics] = await Promise.all([
            daemonClient.health(conn),
            daemonClient.metrics(conn).catch(() => null),
          ]);
          return { health, metrics };
        };

        let activeConnection = connection;
        let result: Awaited<ReturnType<typeof runHealthCheck>> | null = null;

        try {
          const checked = await runHealthCheck(activeConnection);
          result = checked;
        } catch (error) {
          const canRepairAuth =
            isSecureConnectionStoreAvailable() &&
            isLocalEndpointHost(activeConnection.host) &&
            isAuthFailure(error);
          if (!canRepairAuth) {
            throw error;
          }

          const now = Date.now();
          const canAttemptBootstrap =
            now - lastAuthRepairAtRef.current >= AUTH_REPAIR_COOLDOWN_MS;
          if (canAttemptBootstrap) {
            lastAuthRepairAtRef.current = now;
            try {
              await bootstrapDaemonConnection(true);
            } catch {
              // Keep retry path best-effort and continue with stored token load.
            }
          }

          const repairedToken = (await loadToken(
            activeConnection.host,
            activeConnection.port,
          ))?.trim();
          if (repairedToken && repairedToken !== activeConnection.token) {
            activeConnection = { ...activeConnection, token: repairedToken };
            setConnectionRaw((current) =>
              current.host === connection.host && current.port === connection.port
                ? { ...current, token: repairedToken }
                : current,
            );
          }

          const checked = await runHealthCheck(activeConnection);
          result = checked;
        }

        if (!mountedRef.current) return;

        runtimePollDelayRef.current = RUNTIME_POLL_MS;
        setRuntimePollDelayMs(RUNTIME_POLL_MS);
        if (result?.health.status) {
          setConnectionState("connected");
          setConnectionError(null);
        }

        const runtimeMetrics = result?.metrics?.runtime;
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
        const nextDelay = Math.min(
          RUNTIME_POLL_MAX_MS,
          Math.max(RUNTIME_POLL_MS, runtimePollDelayRef.current * 2),
        );
        runtimePollDelayRef.current = nextDelay;
        setRuntimePollDelayMs(nextDelay);
        setConnectionState("disconnected");
        setConnectionError(
          error instanceof Error ? error.message : String(error),
        );
        setRuntimeOverride(null);
        // Daemon is unreachable — any in-progress turns will never send turn.done.
        // Clear streaming indicators so the UI doesn't show perpetual spinners.
        setStreamingBySession((prev) => {
          if (Object.values(prev).every((v) => !v)) return prev;
          return Object.fromEntries(Object.keys(prev).map((k) => [k, false]));
        });
      }
    })();

    refreshInFlightRef.current = runRefresh.finally(() => {
      refreshInFlightRef.current = null;
    });
    return refreshInFlightRef.current;
  }, [connection, sessions.length]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const loop = async () => {
      await refreshNow().finally(() => setInitialCheckDone(true));
      if (cancelled) return;
      timeoutId = window.setTimeout(loop, runtimePollDelayRef.current);
    };

    void loop();
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
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
    runtimePollDelayMs,
  };
}
