"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/clawdbot/types";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface ClawdbotMessageBubbleProps {
  message: ChatMessage;
  streamingContent?: string;
}

export function ClawdbotMessageBubble({ message, streamingContent }: ClawdbotMessageBubbleProps) {
  const isUser = message.sender.type === "user";
  const content = streamingContent ?? message.content;

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const getStatusIcon = () => {
    switch (message.status) {
      case "pending":
        return <Clock className="w-3 h-3 text-text-muted" />;
      case "sent":
        return <Clock className="w-3 h-3 text-text-muted" />;
      case "delivered":
        return <CheckCircle2 className="w-3 h-3 text-neon-green" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-neon-red" />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn("flex gap-3 px-4 py-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
          isUser
            ? "bg-primary/20 border-primary/30"
            : "bg-gradient-to-br from-primary/30 to-neon-cyan/30 border-primary/30"
        )}
      >
        <span className={cn("text-xs font-bold", isUser ? "text-primary" : "text-primary")}>
          {isUser ? "U" : "C"}
        </span>
      </div>

      {/* Message bubble */}
      <div className={cn("flex flex-col max-w-[80%]", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            isUser
              ? "bg-primary/20 border border-primary/30 text-text-primary rounded-tr-sm"
              : "bg-white/5 border border-glass-border text-text-primary rounded-tl-sm"
          )}
        >
          {/* Render content with line breaks */}
          {content.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < content.split("\n").length - 1 && <br />}
            </span>
          ))}

          {/* Streaming cursor */}
          {streamingContent && (
            <motion.span
              className="inline-block w-1.5 h-4 bg-primary ml-0.5 rounded-sm"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </div>

        {/* Timestamp and status */}
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <span className="text-[10px] text-text-muted">{formatTime(message.timestamp)}</span>
          {isUser && getStatusIcon()}
        </div>
      </div>
    </motion.div>
  );
}
