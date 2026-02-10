"use client";

import { motion } from "framer-motion";
import type { BotState } from "@/lib/clawdbot/types";

interface ClawdbotTypingIndicatorProps {
  botState: BotState;
  detail?: string | null;
}

export function ClawdbotTypingIndicator({ botState, detail }: ClawdbotTypingIndicatorProps) {
  if (botState === "idle") return null;

  const getStateText = () => {
    switch (botState) {
      case "thinking":
        return "Thinking...";
      case "typing":
        return "Typing...";
      case "toolUse":
        return detail || "Using tools...";
      default:
        return "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="flex items-center gap-3 px-4 py-3"
    >
      {/* Bot avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-neon-cyan/30 border border-primary/30 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-primary">C</span>
      </div>

      {/* Typing indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-glass-border">
        {/* Animated dots */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.1, 0.8],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.15,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        {/* State text */}
        <span className="text-[10px] text-text-muted ml-1">{getStateText()}</span>
      </div>
    </motion.div>
  );
}
