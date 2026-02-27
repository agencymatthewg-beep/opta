"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { GatewayClient } from "@/lib/gateway";
import { ConnectionStatus, ChatMessage, CronJob, BotConfig, BotHealth } from "@/types";

export function useGateway(url: string, token: string) {
  const clientRef = useRef<GatewayClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [health, setHealth] = useState<BotHealth | null>(null);
  const connectTimeRef = useRef<Date | null>(null);
  const messageCountRef = useRef(0);

  useEffect(() => {
    if (!url || !token) return;

    const client = new GatewayClient(url, token);
    clientRef.current = client;

    const unsub1 = client.onStatus((s) => {
      setStatus(s);
      if (s === "connected") {
        connectTimeRef.current = new Date();
      }
    });

    const unsub2 = client.onEvent((event, data) => {
      const d = data as Record<string, unknown>;
      switch (event) {
        case "chat.delta":
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === d.messageId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                content: updated[idx].content + (d.delta as string ?? ""),
                isStreaming: true,
              };
              return updated;
            }
            return prev;
          });
          break;
        case "chat.message": {
          messageCountRef.current++;
          setMessages((prev) => {
            const msg = d as unknown as ChatMessage;
            const idx = prev.findIndex((m) => m.id === msg.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...msg, isStreaming: false, timestamp: new Date(msg.timestamp) };
              return updated;
            }
            return [...prev, { ...msg, isStreaming: false, timestamp: new Date(msg.timestamp) }];
          });
          break;
        }
        case "chat.done":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === d.messageId ? { ...m, isStreaming: false } : m
            )
          );
          break;
      }
    });

    client.connect();

    return () => {
      unsub1();
      unsub2();
      client.disconnect();
    };
  }, [url, token]);

  const sendMessage = useCallback(async (content: string, replyToId?: string) => {
    if (!clientRef.current) return;
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      botId: "",
      role: "user",
      content,
      timestamp: new Date(),
      isStreaming: false,
      replyToId,
    };
    setMessages((prev) => [...prev, userMsg]);
    messageCountRef.current++;
    try {
      await clientRef.current.send("chat.send", {
        content,
        ...(replyToId ? { replyToId } : {}),
      });
    } catch (err) {
      console.error("Send failed:", err);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const data = (await clientRef.current.send("chat.history", { limit: 100 })) as ChatMessage[];
      setMessages(
        data.map((m) => ({ ...m, timestamp: new Date(m.timestamp), isStreaming: false }))
      );
    } catch {
      // ignore
    }
  }, []);

  const reactToMessage = useCallback(async (messageId: string, command: string) => {
    if (!clientRef.current) return;
    // Update local state
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = { ...m.reactions };
        reactions[command] = !reactions[command];
        return { ...m, reactions };
      })
    );
    // Send to gateway
    try {
      await clientRef.current.send("chat.react", { messageId, reaction: command });
    } catch {
      // ignore
    }
  }, []);

  const togglePin = useCallback(async (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, isPinned: !m.isPinned } : m))
    );
    if (!clientRef.current) return;
    try {
      await clientRef.current.send("chat.pin", { messageId });
    } catch {
      // ignore
    }
  }, []);

  const getHealth = useCallback((botId: string, botName: string): BotHealth => {
    const now = new Date();
    const uptime = connectTimeRef.current && status === "connected"
      ? Math.floor((now.getTime() - connectTimeRef.current.getTime()) / 1000)
      : 0;
    return {
      botId,
      botName,
      latencyMs: health?.latencyMs ?? 0,
      uptime,
      messageCount: messageCountRef.current,
      status,
    };
  }, [status, health]);

  // Measure latency periodically
  useEffect(() => {
    if (status !== "connected" || !clientRef.current) return;
    const measure = async () => {
      const start = performance.now();
      try {
        await clientRef.current?.send("ping");
        const ms = Math.round(performance.now() - start);
        setHealth((prev) => ({ ...prev, latencyMs: ms } as BotHealth));
      } catch {
        // ignore
      }
    };
    measure();
    const interval = setInterval(measure, 15000);
    return () => clearInterval(interval);
  }, [status]);

  const loadCronJobs = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const data = (await clientRef.current.send("cron.list")) as CronJob[];
      setCronJobs(data);
    } catch {
      // ignore
    }
  }, []);

  const addCronJob = useCallback(async (job: Partial<CronJob>) => {
    if (!clientRef.current) return;
    await clientRef.current.send("cron.add", job as Record<string, unknown>);
    await loadCronJobs();
  }, [loadCronJobs]);

  const updateCronJob = useCallback(async (id: string, updates: Partial<CronJob>) => {
    if (!clientRef.current) return;
    await clientRef.current.send("cron.update", { id, ...updates } as Record<string, unknown>);
    await loadCronJobs();
  }, [loadCronJobs]);

  const removeCronJob = useCallback(async (id: string) => {
    if (!clientRef.current) return;
    await clientRef.current.send("cron.remove", { id });
    await loadCronJobs();
  }, [loadCronJobs]);

  const loadConfig = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      const data = (await clientRef.current.send("config.get")) as BotConfig;
      setBotConfig(data);
    } catch {
      // ignore
    }
  }, []);

  const restartBot = useCallback(async () => {
    if (!clientRef.current) return;
    await clientRef.current.send("gateway.restart");
  }, []);

  const abortChat = useCallback(async () => {
    if (!clientRef.current) return;
    await clientRef.current.send("chat.abort");
  }, []);

  return {
    status,
    messages,
    cronJobs,
    botConfig,
    sendMessage,
    loadHistory,
    loadCronJobs,
    addCronJob,
    updateCronJob,
    removeCronJob,
    loadConfig,
    restartBot,
    abortChat,
    reactToMessage,
    togglePin,
    getHealth,
  };
}
