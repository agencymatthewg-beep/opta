"use client";

import { motion } from "framer-motion";
import { BotHealth } from "@/types";
import { GlassPanel } from "./GlassPanel";
import { ConnectionIndicator } from "./ConnectionIndicator";

interface HealthDashboardProps {
  health: BotHealth[];
  onClose: () => void;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function latencyColor(ms: number): string {
  if (ms < 100) return "text-success";
  if (ms < 300) return "text-warning";
  return "text-error";
}

export function HealthDashboard({ health, onClose }: HealthDashboardProps) {
  return (
    <GlassPanel heavy className="w-96 h-full flex flex-col border-l border-border rounded-none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold">🏥 Bot Health</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {health.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">No bots connected</div>
        ) : (
          health.map((bot) => (
            <motion.div
              key={bot.botId}
              className="glass rounded-xl p-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">{bot.botName}</span>
                <ConnectionIndicator status={bot.status} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className={`text-lg font-semibold ${latencyColor(bot.latencyMs)}`}>
                    {bot.latencyMs}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wide">ms</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-text-primary">
                    {formatUptime(bot.uptime)}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wide">uptime</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-text-primary">
                    {bot.messageCount}
                  </div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wide">msgs</div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </GlassPanel>
  );
}
