"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Trash2, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClawdbot } from "@/contextsHooks/useClawdbot";
import { useClawdbotConfig } from "@/contextsHooks/ClawdbotContext";
import { ClawdbotHeader } from "./ClawdbotHeader";
import { ClawdbotMessageBubble } from "./ClawdbotMessageBubble";
import { ClawdbotTypingIndicator } from "./ClawdbotTypingIndicator";

export function ClawdbotWidget() {
  const { config } = useClawdbotConfig();
  const {
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
  } = useClawdbot(config.serverUrl || null);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-connect if configured
  useEffect(() => {
    if (config.autoConnect && config.serverUrl && connectionState === "disconnected") {
      connect();
    }
  }, [config.autoConnect, config.serverUrl, connectionState, connect]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !isConnected) return;

    sendMessage(trimmed);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // If no server URL configured, show setup prompt
  if (!config.serverUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm text-text-secondary mb-2">Clawdbot Not Configured</p>
        <p className="text-xs text-text-muted">
          Open Settings to enter your Clawdbot server URL
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-glass-border mb-3">
        <ClawdbotHeader
          connectionState={connectionState}
          onConnect={connect}
          onDisconnect={disconnect}
        />
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-lg hover:bg-white/10 text-text-muted hover:text-text-secondary transition-colors"
            title="Clear chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto -mx-4 scrollbar-thin scrollbar-thumb-glass-border scrollbar-track-transparent">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-text-muted">
              {isConnected
                ? "Say hello to Clawdbot!"
                : "Connect to start chatting"}
            </p>
          </div>
        ) : (
          <div className="py-2">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <ClawdbotMessageBubble
                  key={message.id}
                  message={message}
                  streamingContent={streamingContent[message.id]}
                />
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            <AnimatePresence>
              {isLoading && (
                <ClawdbotTypingIndicator botState={botState} detail={botStateDetail} />
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-glass-border mt-auto">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? "Message Clawdbot..." : "Connect to chat"}
            disabled={!isConnected}
            className={cn(
              "flex-1 bg-white/5 border border-glass-border rounded-xl px-4 py-2.5 text-sm",
              "text-text-primary placeholder:text-text-muted/50",
              "focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all"
            )}
          />
          <motion.button
            onClick={handleSend}
            disabled={!isConnected || !input.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "p-2.5 rounded-xl transition-colors",
              "bg-primary/20 border border-primary/30 text-primary",
              "hover:bg-primary/30 hover:border-primary/50",
              "disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
