"use client";

import { motion } from "framer-motion";
import { ConnectionStatus } from "@/types";

const statusConfig: Record<ConnectionStatus, { color: string; label: string }> = {
  connected: { color: "bg-success", label: "Connected" },
  connecting: { color: "bg-warning", label: "Connecting..." },
  disconnected: { color: "bg-text-muted", label: "Disconnected" },
  error: { color: "bg-error", label: "Error" },
};

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const cfg = statusConfig[status];
  return (
    <div className="flex items-center gap-2 text-xs text-text-secondary">
      <motion.div
        className={`w-2 h-2 rounded-full ${cfg.color}`}
        animate={
          status === "connected"
            ? { opacity: [1, 0.4, 1] }
            : status === "connecting"
              ? { scale: [1, 1.3, 1] }
              : {}
        }
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      />
      {cfg.label}
    </div>
  );
}
