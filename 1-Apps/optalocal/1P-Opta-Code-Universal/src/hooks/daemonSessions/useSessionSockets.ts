import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { daemonClient, type V3Envelope } from "../../lib/daemonClient";
import { getTauriInvoke } from "../../lib/runtime";
import type {
  DaemonConnectionOptions,
  PermissionRequest,
  TimelineItem,
} from "../../types";
import { STOP_EVENT_KINDS, eventsToTimelineItems } from "./timeline";

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
  setTimelineBySession: Dispatch<SetStateAction<Record<string, TimelineItem[]>>>;
  setStreamingBySession: Dispatch<SetStateAction<Record<string, boolean>>>;
  setPendingPermissionsBySession: Dispatch<
    SetStateAction<Record<string, PermissionRequest[]>>
  >;
  setConnectionState?: Dispatch<
    SetStateAction<"connected" | "connecting" | "disconnected">
  >;
  setConnectionError?: Dispatch<SetStateAction<string | null>>;
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
  setConnectionState,
  setConnectionError,
}: UseSessionSocketsArgs) {
  const sessionIdsKey = sessionIds.join(",");

  useEffect(() => {
    const conn = connection;
    const currentSessionIds = new Set(
      sessionIdsKey ? sessionIdsKey.split(",") : [],
    );

    for (const [id, handle] of wsHandlesRef.current) {
      if (!currentSessionIds.has(id)) {
        handle.close();
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

    for (const sessionId of currentSessionIds) {
      if (wsHandlesRef.current.has(sessionId)) continue;

      let reconnectTimer: number | null = null;
      let attempts = 0;
      let innerHandle: ReturnType<typeof daemonClient.connectWebSocket> | null =
        null;
      const cursor = { seq: seqCursorRef.current[sessionId] ?? 0 };

      const handleEnvelope = (envelope: V3Envelope) => {
        if (!mountedRef.current) return;
        if (typeof envelope.seq === "number") {
          cursor.seq = envelope.seq;
          seqCursorRef.current[sessionId] = envelope.seq;
        }

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
        if (!mountedRef.current || !wsHandlesRef.current.has(sessionId)) return;

        innerHandle = daemonClient.connectWebSocket(conn, sessionId, cursor.seq, {
          onOpen: () => {
            attempts = 0;
            setConnectionState?.("connected");
            setConnectionError?.(null);
          },
          onEvent: (envelope) => {
            if (!mountedRef.current) return;
            handleEnvelope(envelope);
          },
          onClose: (code) => {
            innerHandle = null;
            if (!mountedRef.current || !wsHandlesRef.current.has(sessionId)) return;
            if (code !== 1000) {
              setConnectionState?.("disconnected");
              setConnectionError?.("Lost daemon stream connection. Reconnecting...");
              const delay = Math.min(1000 * Math.pow(2, attempts), 10_000);
              attempts = Math.min(attempts + 1, 10);
              reconnectTimer = window.setTimeout(open, delay);
            }
          },
          onError: () => {
            // onClose handles recovery path.
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

    return () => {
      for (const handle of wsHandlesRef.current.values()) {
        handle.close();
      }
      wsHandlesRef.current.clear();
    };
  }, [
    connection,
    mountedRef,
    seqCursorRef,
    sessionIdsKey,
    setConnectionError,
    setConnectionState,
    setPendingPermissionsBySession,
    setStreamingBySession,
    setTimelineBySession,
    wsHandlesRef,
  ]);
}
