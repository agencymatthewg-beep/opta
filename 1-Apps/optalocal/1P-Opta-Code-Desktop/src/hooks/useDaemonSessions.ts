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

function makeSessionId(): string {
  return `sess_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function withFallbackTitle(index: number, title?: string): string {
  return title?.trim() || `Session ${index + 1}`;
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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        setTimelineBySession((prev) => {
          const existing = prev[activeSessionId] ?? [];
          return {
            ...prev,
            [activeSessionId]: [
              ...existing,
              {
                id: `${activeSessionId}-queue-${Date.now()}`,
                kind: "event",
                title: "Queued",
                body: "Turn accepted by daemon.",
                createdAt: nowIso(),
              },
            ],
          };
        });
        setConnectionState("connected");
        setConnectionError(null);
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

  return {
    activeSessionId,
    connection,
    connectionError,
    connectionState,
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
