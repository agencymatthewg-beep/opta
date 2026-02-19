"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "@/types";

interface ReactionDef {
  emoji: string;
  label: string;
  command: string;
}

const REACTIONS: ReactionDef[] = [
  { emoji: "👍", label: "Proceed", command: "proceed" },
  { emoji: "👎", label: "Undo", command: "undo" },
  { emoji: "❓", label: "Explain", command: "explain" },
  { emoji: "🔄", label: "Retry", command: "retry" },
];

interface MessageBubbleProps {
  message: ChatMessage;
  searchQuery?: string;
  onReact?: (messageId: string, command: string) => void;
  onReply?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  replyToMessage?: ChatMessage | null;
}

function HighlightedContent({ content, query }: { content: string; query?: string }) {
  if (!query) {
    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  }

  // For search highlighting, render with markdown then note it's approximate
  // We highlight in the raw markdown which works for most cases
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const highlighted = content.replace(regex, "**==$1==**");

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {highlighted}
    </ReactMarkdown>
  );
}

export function MessageBubble({ message, searchQuery, onReact, onReply, onPin, replyToMessage }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [showActions, setShowActions] = useState(false);

  const activeReactions = Object.entries(message.reactions ?? {}).filter(([, v]) => v);

  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3 group relative`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 relative ${
          isUser
            ? "bg-primary/20 border border-primary/20"
            : "glass"
        } ${message.isPinned ? "ring-1 ring-primary/30" : ""}`}
      >
        {/* Pin indicator */}
        {message.isPinned && (
          <div className="absolute -top-2 -right-2 text-xs bg-primary/20 rounded-full w-5 h-5 flex items-center justify-center">
            📌
          </div>
        )}

        {/* Reply quote */}
        {replyToMessage && (
          <div className="mb-2 pl-3 border-l-2 border-primary/40 text-xs text-text-muted truncate max-w-full">
            <span className="text-text-secondary font-medium">
              {replyToMessage.role === "user" ? "You" : "Bot"}
            </span>
            {": "}
            {replyToMessage.content.slice(0, 100)}
            {replyToMessage.content.length > 100 ? "..." : ""}
          </div>
        )}

        {/* Thinking indicator */}
        {message.thinkingContent && (
          <details className="mb-2">
            <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
              💭 Thinking...
            </summary>
            <div className="mt-1 text-xs text-text-muted whitespace-pre-wrap">
              {message.thinkingContent}
            </div>
          </details>
        )}

        {/* Content */}
        <div className="markdown-content text-sm leading-relaxed">
          <HighlightedContent content={message.content} query={searchQuery} />
        </div>

        {/* Streaming indicator */}
        {message.isStreaming && (
          <motion.span
            className="inline-block w-2 h-4 bg-primary rounded-sm ml-1"
            animate={{ opacity: [1, 0] }}
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}

        {/* Active reactions */}
        {activeReactions.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {activeReactions.map(([cmd]) => {
              const r = REACTIONS.find((rx) => rx.command === cmd);
              return r ? (
                <span key={cmd} className="text-xs bg-white/[0.06] rounded-full px-1.5 py-0.5">
                  {r.emoji}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Timestamp */}
        <div className="text-[10px] text-text-muted mt-1.5">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {/* Hover action bar */}
      <AnimatePresence>
        {showActions && !message.isStreaming && (
          <motion.div
            className={`absolute ${isUser ? "right-0" : "left-0"} -top-8 flex items-center gap-0.5 glass rounded-xl px-1.5 py-1 z-10`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            {/* Reactions */}
            {!isUser && REACTIONS.map((r) => (
              <button
                key={r.command}
                onClick={() => onReact?.(message.id, r.command)}
                title={r.label}
                className="text-sm hover:bg-white/[0.08] rounded-lg w-7 h-7 flex items-center justify-center transition-colors"
              >
                {r.emoji}
              </button>
            ))}
            {/* Reply */}
            <button
              onClick={() => onReply?.(message.id)}
              title="Reply"
              className="text-sm hover:bg-white/[0.08] rounded-lg w-7 h-7 flex items-center justify-center transition-colors text-text-muted"
            >
              ↩
            </button>
            {/* Pin */}
            <button
              onClick={() => onPin?.(message.id)}
              title={message.isPinned ? "Unpin" : "Pin"}
              className="text-sm hover:bg-white/[0.08] rounded-lg w-7 h-7 flex items-center justify-center transition-colors text-text-muted"
            >
              📌
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
