"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage, ConnectionStatus } from "@/types";
import { MessageBubble } from "./MessageBubble";
import { ConnectionIndicator } from "./ConnectionIndicator";

interface ChatViewProps {
  botName: string;
  messages: ChatMessage[];
  status: ConnectionStatus;
  onSend: (content: string, replyToId?: string) => void;
  onAbort: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onReact: (messageId: string, command: string) => void;
  onPin: (messageId: string) => void;
}

export function ChatView({
  botName,
  messages,
  status,
  onSend,
  onAbort,
  searchQuery,
  onSearchChange,
  onReact,
  onPin,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = messages.some((m) => m.isStreaming);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filtered = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const replyToMessage = replyToId ? messages.find((m) => m.id === replyToId) ?? null : null;

  const messagesById = new Map(messages.map((m) => [m.id, m]));

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed, replyToId ?? undefined);
    setInput("");
    setReplyToId(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyToId) {
      setReplyToId(null);
    }
  };

  const handleReply = (messageId: string) => {
    setReplyToId(messageId);
    inputRef.current?.focus();
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border glass-heavy">
        <div>
          <h2 className="text-lg font-semibold">{botName}</h2>
          <ConnectionIndicator status={status} />
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search messages… (⌘F)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-white/[0.04] border border-border rounded-xl px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/40 w-52"
            />
            {searchQuery && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">
                {filtered.length} match{filtered.length !== 1 ? "es" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            {searchQuery ? "No matching messages" : "Start a conversation..."}
          </div>
        ) : (
          filtered.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              searchQuery={searchQuery}
              onReact={onReact}
              onReply={handleReply}
              onPin={onPin}
              replyToMessage={msg.replyToId ? messagesById.get(msg.replyToId) ?? null : null}
            />
          ))
        )}
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {replyToMessage && (
          <motion.div
            className="mx-6 px-4 py-2 glass rounded-t-xl border-b-0 flex items-center justify-between"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-primary">↩ Replying to</span>
              <span className="text-xs text-text-secondary truncate">
                {replyToMessage.content.slice(0, 80)}
                {replyToMessage.content.length > 80 ? "..." : ""}
              </span>
            </div>
            <button
              onClick={() => setReplyToId(null)}
              className="text-text-muted hover:text-text-primary text-sm ml-2 shrink-0"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        <div className="flex items-end gap-3">
          <div className="flex-1 glass rounded-2xl px-4 py-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={status === "connected" ? "Message..." : "Waiting for connection..."}
              disabled={status !== "connected"}
              rows={1}
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
              style={{ minHeight: "24px", maxHeight: "120px" }}
            />
          </div>
          {isStreaming ? (
            <motion.button
              onClick={onAbort}
              className="px-4 py-3 rounded-2xl bg-error/20 border border-error/30 text-error text-sm font-medium"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Stop
            </motion.button>
          ) : (
            <motion.button
              onClick={handleSend}
              disabled={!input.trim() || status !== "connected"}
              className="px-4 py-3 rounded-2xl bg-primary/20 border border-primary/30 text-primary text-sm font-medium disabled:opacity-30"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              Send
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
