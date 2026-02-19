"use client";

import { motion } from "framer-motion";
import { Bot, ConnectionStatus } from "@/types";
import { ConnectionIndicator } from "./ConnectionIndicator";

interface BotSidebarProps {
  bots: Bot[];
  activeBotId: string | null;
  connectionStatus: Record<string, ConnectionStatus>;
  onSelectBot: (id: string) => void;
  onAddBot: () => void;
}

export function BotSidebar({ bots, activeBotId, connectionStatus, onSelectBot, onAddBot }: BotSidebarProps) {
  return (
    <div className="w-72 h-full flex flex-col glass-heavy border-r border-border">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <h1 className="text-xl font-semibold tracking-tight">
          <span className="text-primary">Opta</span>Plus
        </h1>
        <p className="text-xs text-text-muted mt-1">Your bots. One app.</p>
      </div>

      {/* Bot list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {bots.map((bot) => (
          <motion.button
            key={bot.id}
            onClick={() => onSelectBot(bot.id)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
              activeBotId === bot.id
                ? "bg-primary/10 border border-primary/20"
                : "hover:bg-white/[0.03] border border-transparent"
            }`}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold text-white"
              style={{ backgroundColor: bot.accentColor }}
            >
              {bot.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary truncate">{bot.name}</div>
              <ConnectionIndicator status={connectionStatus[bot.id] ?? "disconnected"} />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Add bot */}
      <div className="p-3 border-t border-border">
        <button
          onClick={onAddBot}
          className="w-full py-2.5 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.03] transition-colors border border-dashed border-border"
        >
          + Add Bot
        </button>
      </div>
    </div>
  );
}
