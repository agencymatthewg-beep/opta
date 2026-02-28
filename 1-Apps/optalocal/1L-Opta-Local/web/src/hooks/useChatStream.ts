"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import type { LMXClient } from "@/lib/lmx-client";
import type { OptaDaemonClient } from "@/lib/opta-daemon-client";
import type { ChatMessage } from "@/types/lmx";

const MAX_DAEMON_RECONNECT_ATTEMPTS = 8;
const INITIAL_RECONNECT_DELAY_MS = 150;
const MAX_RECONNECT_DELAY_MS = 2000;

export interface PermissionRequestPayload {
  requestId: string;
  sessionId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface ToolEventEntry {
  id: string;
  toolCallId: string;
  toolName: string;
  args?: string;
  detail?: string;
  status: "running" | "done" | "error";
}

interface UseChatStreamOptions {
  onError?: (error: Error) => void;
  onPermissionRequest?: (
    request: PermissionRequestPayload,
  ) => Promise<"allow" | "deny"> | "allow" | "deny";
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  toolEvents: ToolEventEntry[];
  isStreaming: boolean;
  isPending: boolean;
  sendMessage: (
    client: LMXClient | OptaDaemonClient,
    model: string,
    content: string,
    opts?: { sessionId?: string; onSessionId?: (id: string) => void },
  ) => Promise<void>;
  stop: () => void;
}

/**
 * Streaming chat hook supporting both direct LMX and Opta daemon transports.
 *
 * Token-append state updates are wrapped in startTransition() so rapid streaming
 * (20-100 tok/s) doesn't block user input. The hook manages messages state,
 * streaming status, and abort control.
 */
export function useChatStream(
  options?: UseChatStreamOptions,
): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  });
  const [toolEvents, setToolEvents] = useState<ToolEventEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef<{ abort: () => void } | null>(null);

  const isDaemonClient = (
    client: LMXClient | OptaDaemonClient,
  ): client is OptaDaemonClient => {
    return "submitTurn" in client && "connectWebSocket" in client;
  };

  const appendAssistantToken = useCallback(
    (token: string) => {
      startTransition(() => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + token,
            };
          }
          return updated;
        });
      });
    },
    [startTransition],
  );

  const sendMessage = useCallback(
    async (
      client: LMXClient | OptaDaemonClient,
      model: string,
      content: string,
      opts?: { sessionId?: string; onSessionId?: (id: string) => void },
    ) => {
      // 1. Add user message immediately (optimistic)
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };

      // 2. Add placeholder assistant message
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        model,
        created_at: new Date().toISOString(),
      };

      // Build request context from current message history plus this turn.
      // This avoids depending on async state scheduler timing.
      const requestMessages = [...messagesRef.current, userMsg];
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setToolEvents([]);

      setIsStreaming(true);

      try {
        if (isDaemonClient(client)) {
          const sessionId = opts?.sessionId ?? crypto.randomUUID();
          if (!opts?.sessionId) {
            opts?.onSessionId?.(sessionId);
          }

          const history = requestMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));
          await client.createSession({
            sessionId,
            model,
            messages: history,
          });

          let currentTurnId: string | null = null;
          const clientId = `web-${crypto.randomUUID().slice(0, 8)}`;
          const writerId = `writer-${crypto.randomUUID().slice(0, 8)}`;

          await new Promise<void>((resolve, reject) => {
            let done = false;
            let cancelledByUser = false;
            let lastSeq = 0;
            let reconnectAttempt = 0;
            let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
            let closeStream: (() => void) | null = null;

            const clearReconnectTimer = () => {
              if (!reconnectTimer) return;
              clearTimeout(reconnectTimer);
              reconnectTimer = null;
            };

            const closeCurrentStream = () => {
              clearReconnectTimer();
              if (!closeStream) return;
              const close = closeStream;
              closeStream = null;
              close();
            };

            const fail = (error: Error) => {
              if (done) return;
              done = true;
              closeCurrentStream();
              reject(error);
            };

            const finish = () => {
              if (done) return;
              done = true;
              closeCurrentStream();
              resolve();
            };

            const handleDaemonEvent = (event: {
              event: string;
              seq: number;
              payload?: unknown;
            }) => {
              lastSeq = Math.max(lastSeq, event.seq);
              const payload = (event.payload ?? {}) as Record<string, unknown>;
              const payloadTurnId =
                typeof payload.turnId === "string" ? payload.turnId : undefined;

              if (event.event === "permission.request") {
                const requestId = payload.requestId;
                if (typeof requestId === "string") {
                  const toolName =
                    typeof payload.toolName === "string"
                      ? payload.toolName
                      : "tool";
                  const args = (
                    payload.args && typeof payload.args === "object"
                      ? payload.args
                      : {}
                  ) as Record<string, unknown>;
                  void Promise.resolve(
                    options?.onPermissionRequest?.({
                      requestId,
                      sessionId,
                      toolName,
                      args,
                    }) ?? "deny",
                  )
                    .then((decision) => {
                      void client.resolvePermission(sessionId, {
                        requestId,
                        decision,
                        decidedBy: clientId,
                      });
                    })
                    .catch(() => {
                      void client.resolvePermission(sessionId, {
                        requestId,
                        decision: "deny",
                        decidedBy: clientId,
                      });
                    });
                }
                return;
              }

              if (
                currentTurnId &&
                payloadTurnId &&
                payloadTurnId !== currentTurnId
              ) {
                return;
              }

              if (event.event === "tool.start") {
                const toolName =
                  typeof payload.name === "string" ? payload.name : "tool";
                const toolCallId =
                  typeof payload.id === "string"
                    ? payload.id
                    : crypto.randomUUID();
                const args =
                  typeof payload.args === "string" ? payload.args : undefined;
                setToolEvents((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    toolCallId,
                    toolName,
                    args,
                    status: "running",
                    detail: "Running...",
                  },
                ]);
                return;
              }

              if (event.event === "tool.end") {
                const toolCallId =
                  typeof payload.id === "string" ? payload.id : "";
                const result =
                  typeof payload.result === "string" ? payload.result : "";
                setToolEvents((prev) => {
                  const next = [...prev];
                  let idx = -1;
                  for (let i = next.length - 1; i >= 0; i -= 1) {
                    if (next[i]?.toolCallId === toolCallId) {
                      idx = i;
                      break;
                    }
                  }
                  if (idx === -1) {
                    next.push({
                      id: crypto.randomUUID(),
                      toolCallId: toolCallId || crypto.randomUUID(),
                      toolName:
                        typeof payload.name === "string"
                          ? payload.name
                          : "tool",
                      status: "done",
                      detail: result || "Done",
                    });
                    return next;
                  }
                  next[idx] = {
                    ...next[idx]!,
                    status: "done",
                    detail: result || "Done",
                  };
                  return next;
                });
                return;
              }

              if (
                event.event === "turn.token" &&
                typeof payload.text === "string"
              ) {
                appendAssistantToken(payload.text);
                return;
              }

              if (event.event === "turn.done") {
                finish();
                return;
              }

              if (event.event === "turn.error") {
                const message =
                  typeof payload.message === "string"
                    ? payload.message
                    : "Turn failed";
                setToolEvents((prev) =>
                  prev.map((entry) =>
                    entry.status === "running"
                      ? { ...entry, status: "error", detail: message }
                      : entry,
                  ),
                );
                if (cancelledByUser && /cancel/i.test(message)) {
                  fail(makeAbortError(message));
                  return;
                }
                fail(new Error(message));
              }
            };

            const connectSse = (afterSeq: number) => {
              const connection = client.connectSse(sessionId, afterSeq, {
                onEvent: (event) => {
                  if (done) return;
                  handleDaemonEvent(event);
                },
                onError: () => {
                  if (done) return;
                  if (cancelledByUser) {
                    fail(makeAbortError("Request cancelled"));
                    return;
                  }
                  fail(new Error("Daemon SSE stream error"));
                },
              });
              closeStream = connection.close;
            };

            const connectWs = (afterSeq: number) => {
              const connection = client.connectWebSocket(sessionId, afterSeq, {
                onOpen: () => {
                  reconnectAttempt = 0;
                },
                onError: (error) => {
                  if (done) return;
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Daemon WebSocket error";
                  if (/unauthorized|invalid ws payload/i.test(message)) {
                    fail(new Error(message));
                  }
                },
                onClose: () => {
                  if (done) return;
                  closeStream = null;
                  clearReconnectTimer();
                  if (cancelledByUser) {
                    fail(makeAbortError("Request cancelled"));
                    return;
                  }

                  reconnectAttempt += 1;
                  if (reconnectAttempt > MAX_DAEMON_RECONNECT_ATTEMPTS) {
                    connectSse(lastSeq);
                    return;
                  }

                  const delay = Math.min(
                    INITIAL_RECONNECT_DELAY_MS * 2 ** (reconnectAttempt - 1),
                    MAX_RECONNECT_DELAY_MS,
                  );
                  reconnectTimer = setTimeout(() => {
                    reconnectTimer = null;
                    connectWs(lastSeq);
                  }, delay);
                },
                onEvent: (event) => {
                  if (done) return;
                  handleDaemonEvent(event);
                },
              });
              closeStream = connection.close;
            };

            connectWs(0);

            abortRef.current = {
              abort: () => {
                cancelledByUser = true;
                void client.cancel(
                  sessionId,
                  currentTurnId ? { turnId: currentTurnId } : { writerId },
                );
              },
            };

            void client
              .submitTurn(sessionId, {
                clientId,
                writerId,
                content,
                mode: "chat",
              })
              .then((queued) => {
                if (done) return;
                currentTurnId = queued.turnId;
              })
              .catch((error) => {
                fail(error instanceof Error ? error : new Error(String(error)));
              });
          });
        } else {
          // Direct LMX mode
          const controller = new AbortController();
          abortRef.current = { abort: () => controller.abort() };

          // 3. Stream tokens, updating assistant message content
          for await (const token of client.streamChat(model, requestMessages, {
            signal: controller.signal,
          })) {
            appendAssistantToken(token);
          }
        }
      } catch (error) {
        // Don't report abort errors
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        if (error instanceof Error && error.name === "AbortError") return;
        options?.onError?.(
          error instanceof Error ? error : new Error(String(error)),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [appendAssistantToken, options],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    messages,
    setMessages,
    toolEvents,
    isStreaming,
    isPending,
    sendMessage,
    stop,
  };
}

function makeAbortError(message = "Request cancelled"): Error {
  const err = new Error(message);
  err.name = "AbortError";
  return err;
}
