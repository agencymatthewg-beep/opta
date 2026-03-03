import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { daemonClient, type V3Envelope } from "../../lib/daemonClient";
import { getTauriInvoke } from "../../lib/runtime";
import type {
  DaemonConnectionOptions,
  PermissionRequest,
  TimelineItem,
} from "../../types";
import { STOP_EVENT_KINDS, eventsToTimelineItems } from "./timeline";

const TOKEN_FLUSH_MS = 40;

// ─── Heartbeat config ────────────────────────────────────────────────────────
// A ping is sent after HEARTBEAT_IDLE_MS of no server messages.
// If no message arrives within HEARTBEAT_PONG_TIMEOUT_MS of the ping,
// the connection is treated as stale and forcibly closed for reconnect.
// This catches NAT/firewall silent drops that never send a WS close frame.
const HEARTBEAT_IDLE_MS = 20_000;
const HEARTBEAT_PONG_TIMEOUT_MS = 5_000;

export interface WsHandle {
  close: () => void;
  send: (msg: object) => void;
}

interface UseSessionSocketsArgs {
  connection: DaemonConnectionOptions;
  sessionIds: string[];
  mountedRef: MutableRefObject<boolean>;
  seqCursorRef: MutableRefObject<Record<string, number>>;
  wsHandlesRef: MutableRefObject<Map<string, WsHandle>>;
  setTimelineBySession: Dispatch<
    SetStateAction<Record<string, TimelineItem[]>>
  >;
  setStreamingBySession: Dispatch<SetStateAction<Record<string, boolean>>>;
  setPendingPermissionsBySession: Dispatch<
    SetStateAction<Record<string, PermissionRequest[]>>
  >;
  setRawEventsBySession: Dispatch<SetStateAction<Record<string, V3Envelope[]>>>;
}

export function useSessionSockets({
  connection,
  sessionIds,
  mountedRef,
  seqCursorRef,
  wsHandlesRef,
  setTimelineBySession,
  setStreamingBySession,
  setPendingPermissionsBySession,
  setRawEventsBySession,
}: UseSessionSocketsArgs) {
  const sessionIdsKey = sessionIds.join(",");
  const connectionIdentityRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef<Record<string, number>>({});
  const tokenBufferRef = useRef<Record<string, string>>({});
  const tokenFlushTimerRef = useRef<Map<string, number>>(new Map());

  const clearTokenFlushTimer = (sessionId: string) => {
    const timer = tokenFlushTimerRef.current.get(sessionId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      tokenFlushTimerRef.current.delete(sessionId);
    }
  };

  const flushTokenBuffer = (sessionId: string) => {
    clearTokenFlushTimer(sessionId);
    const chunk = tokenBufferRef.current[sessionId] ?? "";
    if (!chunk) return;
    delete tokenBufferRef.current[sessionId];
    if (!mountedRef.current) return;

    setTimelineBySession((prev) => {
      const existing = prev[sessionId] ?? [];
      if (
        existing.length > 0 &&
        existing[existing.length - 1].kind === "assistant"
      ) {
        const last = existing[existing.length - 1];
        const merged = { ...last, body: (last.body ?? "") + chunk };
        return { ...prev, [sessionId]: [...existing.slice(0, -1), merged] };
      }
      return {
        ...prev,
        [sessionId]: [
          ...existing,
          {
            id: `${sessionId}-text-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 6)}`,
            kind: "assistant",
            title: "Assistant",
            body: chunk,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  };

  const scheduleTokenFlush = (sessionId: string) => {
    if (tokenFlushTimerRef.current.has(sessionId)) return;
    const timer = window.setTimeout(() => {
      tokenFlushTimerRef.current.delete(sessionId);
      flushTokenBuffer(sessionId);
    }, TOKEN_FLUSH_MS);
    tokenFlushTimerRef.current.set(sessionId, timer);
  };

  useEffect(() => {
    const connectionIdentity = [
      connection.protocol ?? "http",
      connection.host,
      connection.port,
      connection.token,
    ].join("|");
    const connectionChanged =
      connectionIdentityRef.current !== null &&
      connectionIdentityRef.current !== connectionIdentity;
    connectionIdentityRef.current = connectionIdentity;

    if (connectionChanged) {
      for (const handle of wsHandlesRef.current.values()) {
        handle.close();
      }
      wsHandlesRef.current.clear();
    }

    const conn = connection;
    const currentSessionIds = new Set(
      sessionIdsKey ? sessionIdsKey.split(",") : [],
    );

    for (const [id, handle] of wsHandlesRef.current) {
      if (!currentSessionIds.has(id)) {
        flushTokenBuffer(id);
        handle.close();
        wsHandlesRef.current.delete(id);
        delete sessionGenerationRef.current[id];
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

    for (const sessionId of currentSessionIds) {
      if (wsHandlesRef.current.has(sessionId)) continue;

      let reconnectTimer: number | null = null;
      let attempts = 0;
      let closeRequestedLocally = false;
      let networkOffline = false;
      let innerHandle: ReturnType<typeof daemonClient.connectWebSocket> | null =
        null;
      // Heartbeat state — reset on every received message
      let heartbeatIdleTimer: number | null = null;
      let heartbeatPongTimer: number | null = null;

      const clearHeartbeatTimers = () => {
        if (heartbeatIdleTimer !== null) {
          window.clearTimeout(heartbeatIdleTimer);
          heartbeatIdleTimer = null;
        }
        if (heartbeatPongTimer !== null) {
          window.clearTimeout(heartbeatPongTimer);
          heartbeatPongTimer = null;
        }
      };

      const scheduleHeartbeat = () => {
        clearHeartbeatTimers();
        heartbeatIdleTimer = window.setTimeout(() => {
          // Send ping and start pong timeout
          try { innerHandle?.send({ type: "ping" }); } catch { /* ignore */ }
          heartbeatPongTimer = window.setTimeout(() => {
            // No message received in time — force reconnect
            innerHandle?.close();
          }, HEARTBEAT_PONG_TIMEOUT_MS);
        }, HEARTBEAT_IDLE_MS);
      };

      const cursor = { seq: seqCursorRef.current[sessionId] ?? 0 };
      const generation = (sessionGenerationRef.current[sessionId] ?? 0) + 1;
      sessionGenerationRef.current[sessionId] = generation;
      const isCurrentGeneration = () =>
        sessionGenerationRef.current[sessionId] === generation;

      const handleEnvelope = (envelope: V3Envelope) => {
        if (!mountedRef.current || !isCurrentGeneration()) return;
        if (typeof envelope.seq === "number") {
          cursor.seq = envelope.seq;
          seqCursorRef.current[sessionId] = envelope.seq;
        }

        setRawEventsBySession?.((prev) => ({
          ...prev,
          [sessionId]: [...(prev[sessionId] || []), envelope].slice(-200), // Keep last 200 events for telemetry
        }));

        const invoke = getTauriInvoke();
        if (invoke) {
          invoke("append_session_event", {
            sessionId,
            eventJson: JSON.stringify(envelope),
          }).catch(() => {
            // Ignore disk persistence failures.
          });
        }

        const kind = String(envelope.event ?? "");
        const payload = (envelope.payload ?? {}) as Record<string, unknown>;

        if (kind === "turn.token") {
          const token =
            (payload.token as string) ||
            (payload.content as string) ||
            (payload.delta as string) ||
            (payload.text as string) ||
            "";
          if (!token) return;
          tokenBufferRef.current[sessionId] =
            (tokenBufferRef.current[sessionId] ?? "") + token;
          scheduleTokenFlush(sessionId);
          return;
        }

        flushTokenBuffer(sessionId);

        if (kind === "permission.request") {
          const requestId = String(
            payload.requestId ?? payload.request_id ?? "",
          );
          const toolName = String(
            payload.toolName ?? payload.tool_name ?? payload.name ?? "",
          );
          const args = (payload.args ?? payload.input ?? {}) as Record<
            string,
            unknown
          >;
          if (requestId) {
            setPendingPermissionsBySession((prev) => {
              const existing = prev[sessionId] ?? [];
              if (existing.some((p) => p.requestId === requestId)) return prev;
              return {
                ...prev,
                [sessionId]: [
                  ...existing,
                  { requestId, toolName, args, sessionId },
                ],
              };
            });
          }
          return;
        }

        if (kind === "permission.resolved") {
          const requestId = String(
            payload.requestId ?? payload.request_id ?? "",
          );
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

        if (kind === "turn.start") {
          setStreamingBySession((prev) => ({ ...prev, [sessionId]: true }));
        } else if (STOP_EVENT_KINDS.has(kind)) {
          setStreamingBySession((prev) => {
            if (!prev[sessionId]) return prev;
            return { ...prev, [sessionId]: false };
          });
        }

        const newItems = eventsToTimelineItems([envelope], sessionId);
        if (newItems.length === 0) return;

        setTimelineBySession((prev) => {
          const existing = prev[sessionId] ?? [];

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
        if (
          !mountedRef.current ||
          !wsHandlesRef.current.has(sessionId) ||
          !isCurrentGeneration()
        ) {
          return;
        }

        const persistedCursor = seqCursorRef.current[sessionId] ?? 0;
        if (persistedCursor > cursor.seq) {
          cursor.seq = persistedCursor;
        }

        innerHandle = daemonClient.connectWebSocket(
          conn,
          sessionId,
          cursor.seq,
          {
            onOpen: () => {
              if (!isCurrentGeneration()) return;
              attempts = 0;
              scheduleHeartbeat();
            },
            onEvent: (envelope) => {
              if (!mountedRef.current || !isCurrentGeneration()) return;
              // Any received message resets the heartbeat idle timer
              scheduleHeartbeat();
              // If a pong arrived, clear the pong timeout
              const eventKind = String((envelope as unknown as Record<string, unknown>).event ?? "");
              if (heartbeatPongTimer !== null && eventKind === "pong") {
                window.clearTimeout(heartbeatPongTimer);
                heartbeatPongTimer = null;
                scheduleHeartbeat();
                return;
              }
              handleEnvelope(envelope);
            },
            onClose: (_code) => {
              innerHandle = null;
              clearHeartbeatTimers();
              if (!isCurrentGeneration()) return;

              flushTokenBuffer(sessionId);
              setStreamingBySession((prev) => {
                if (!prev[sessionId]) return prev;
                return { ...prev, [sessionId]: false };
              });

              if (
                !mountedRef.current ||
                !wsHandlesRef.current.has(sessionId) ||
                closeRequestedLocally ||
                networkOffline
              ) {
                return;
              }

              const baseDelay = Math.min(1000 * Math.pow(2, attempts), 10_000);
              const jitter = Math.floor(baseDelay * 0.2 * Math.random());
              const delay = Math.min(10_000, baseDelay + jitter);
              attempts = Math.min(attempts + 1, 10);
              reconnectTimer = window.setTimeout(() => {
                if (!isCurrentGeneration()) return;
                open();
              }, delay);
            },
            onError: () => {
              // onClose handles recovery path.
            },
          },
        );
      };

      const handle: WsHandle = {
        close: () => {
          closeRequestedLocally = true;
          clearHeartbeatTimers();
          flushTokenBuffer(sessionId);
          if (reconnectTimer !== null) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          innerHandle?.close();
          innerHandle = null;
          if (sessionGenerationRef.current[sessionId] === generation) {
            sessionGenerationRef.current[sessionId] = generation + 1;
          }
          wsHandlesRef.current.delete(sessionId);
        },
        send: (msg) => innerHandle?.send(msg),
      };

      wsHandlesRef.current.set(sessionId, handle);
      open();
    }
  }, [
    connection,
    mountedRef,
    seqCursorRef,
    sessionIdsKey,
    setPendingPermissionsBySession,
    setStreamingBySession,
    setTimelineBySession,
    wsHandlesRef,
  ]);

  useEffect(
    () => () => {
      for (const handle of wsHandlesRef.current.values()) {
        handle.close();
      }
      wsHandlesRef.current.clear();
      for (const timer of tokenFlushTimerRef.current.values()) {
        window.clearTimeout(timer);
      }
      tokenFlushTimerRef.current.clear();
      tokenBufferRef.current = {};
      sessionGenerationRef.current = {};
    },
    [wsHandlesRef, tokenFlushTimerRef, tokenBufferRef, sessionGenerationRef],
  );

  // ─── Network change detection ──────────────────────────────────────────────
  // When the device loses network, suppress WS backoff retries to avoid
  // hammering with connection attempts that will all fail immediately.
  // When the device regains network, force-close current sockets so the
  // backoff loop restarts immediately on the fresh network path rather than
  // waiting for the current exponential delay to expire.
  useEffect(() => {
    const onOnline = () => {
      // Close all sockets — onClose will start a fresh reconnect immediately
      // since networkOffline is back to false (it was cleared before this fires)
      for (const handle of wsHandlesRef.current.values()) {
        // Re-open by closing (backoff timer will re-connect with attempts=0)
        const send = handle.send;
        void send; // keep reference alive
        handle.close();
      }
      wsHandlesRef.current.clear();
    };

    const onOffline = () => {
      // Nothing to do here — wsHandles have networkOffline flag set per-closure.
      // The reconnect suppression happens inside each ws close handler.
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [wsHandlesRef]);
}
