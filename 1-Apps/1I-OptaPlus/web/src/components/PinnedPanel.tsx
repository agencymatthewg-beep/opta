"use client";

import { motion } from "framer-motion";
import { ChatMessage } from "@/types";
import { GlassPanel } from "./GlassPanel";

interface PinnedPanelProps {
  messages: ChatMessage[];
  onUnpin: (messageId: string) => void;
  onClose: () => void;
}

export function PinnedPanel({ messages, onUnpin, onClose }: PinnedPanelProps) {
  const pinned = messages.filter((m) => m.isPinned);

  return (
    <GlassPanel heavy className="w-96 h-full flex flex-col border-l border-border rounded-none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold">📌 Pinned Messages</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {pinned.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">No pinned messages</div>
        ) : (
          pinned.map((msg) => (
            <motion.div
              key={msg.id}
              className="glass rounded-xl p-3"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-text-muted mb-1">
                    {msg.role === "user" ? "You" : "Bot"} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="text-sm text-text-primary line-clamp-3">
                    {msg.content}
                  </div>
                </div>
                <button
                  onClick={() => onUnpin(msg.id)}
                  className="text-xs text-text-muted hover:text-error shrink-0"
                  title="Unpin"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </GlassPanel>
  );
}
