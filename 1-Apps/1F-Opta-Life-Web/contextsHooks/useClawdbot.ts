"use client";

/**
 * useClawdbot Hook
 * React hook for Clawdbot WebSocket connection and state management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { ClawdbotClient } from "@/lib/clawdbot/websocket-client";
import type {
  ChatMessage,
  ConnectionState,
  BotState,
  StreamingChunk,
  MessageAck,
  BotStateUpdate,
} from "@/lib/clawdbot/types";

export interface UseClawdbotResult {
  // Connection
  connectionState: ConnectionState;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;

  // Messages
  messages: ChatMessage[];
  streamingContent: Record<string, string>;
  sendMessage: (content: string) => void;
  clearMessages: () => void;

  // Bot state
  botState: BotState;
  botStateDetail: string | null;

  // Helpers
  isLoading: boolean;
}

export function useClawdbot(serverUrl: string | null): UseClawdbotResult {
  const clientRef = useRef<ClawdbotClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [botState, setBotState] = useState<BotState>("idle");
  const [botStateDetail, setBotStateDetail] = useState<string | null>(null);

  // Initialize client when serverUrl changes
  useEffect(() => {
    if (!serverUrl) {
      clientRef.current = null;
      return;
    }

    const client = new ClawdbotClient({
      serverUrl,
      onConnectionChange: setConnectionState,
      onMessage: handleIncomingMessage,
      onMessageAck: handleMessageAck,
      onBotState: handleBotState,
      onStreamingChunk: handleStreamingChunk,
      onError: (error) => console.error("[useClawdbot] Error:", error),
    });

    clientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, [serverUrl]);

  const handleIncomingMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
    // Clear streaming content for completed message
    setStreamingContent((prev) => {
      const next = { ...prev };
      delete next[message.id];
      return next;
    });
  }, []);

  const handleMessageAck = useCallback((ack: MessageAck) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === ack.messageID
          ? { ...msg, status: ack.status === "error" ? "failed" : "delivered" }
          : msg
      )
    );
  }, []);

  const handleBotState = useCallback((update: BotStateUpdate) => {
    setBotState(update.state);
    setBotStateDetail(update.detail ?? null);
  }, []);

  const handleStreamingChunk = useCallback((chunk: StreamingChunk) => {
    setStreamingContent((prev) => ({
      ...prev,
      [chunk.messageID]: (prev[chunk.messageID] ?? "") + chunk.content,
    }));

    if (chunk.isFinal) {
      // Create the final message from accumulated content
      setStreamingContent((prev) => {
        const finalContent = prev[chunk.messageID];
        if (finalContent) {
          setMessages((msgs) => [
            ...msgs,
            {
              id: chunk.messageID,
              content: finalContent,
              sender: { type: "bot", name: "Clawdbot" },
              timestamp: new Date().toISOString(),
              status: "delivered",
            },
          ]);
        }
        const next = { ...prev };
        delete next[chunk.messageID];
        return next;
      });
    }
  }, []);

  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const sendMessage = useCallback((content: string) => {
    if (!clientRef.current) return;

    const message = clientRef.current.sendMessage(content);
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent({});
  }, []);

  const isConnected = connectionState === "connected";
  const isLoading = botState === "thinking" || botState === "typing" || botState === "toolUse";

  return {
    connectionState,
    isConnected,
    connect,
    disconnect,
    messages,
    streamingContent,
    sendMessage,
    clearMessages,
    botState,
    botStateDetail,
    isLoading,
  };
}
