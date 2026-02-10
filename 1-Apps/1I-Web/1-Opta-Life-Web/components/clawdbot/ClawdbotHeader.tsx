"use client";

import { motion } from "framer-motion";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectionState } from "@/lib/clawdbot/types";

interface ClawdbotHeaderProps {
  connectionState: ConnectionState;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function ClawdbotHeader({ connectionState, onConnect, onDisconnect }: ClawdbotHeaderProps) {
  const getStateColor = () => {
    switch (connectionState) {
      case "connected":
        return "bg-neon-green";
      case "connecting":
      case "reconnecting":
        return "bg-neon-amber";
      case "error":
        return "bg-neon-red";
      default:
        return "bg-text-muted";
    }
  };

  const getStateText = () => {
    switch (connectionState) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return "Connection Error";
      default:
        return "Disconnected";
    }
  };

  const isLoading = connectionState === "connecting" || connectionState === "reconnecting";
  const isConnected = connectionState === "connected";

  return (
    <div className="flex items-center gap-2">
      {/* Status indicator */}
      <div className="flex items-center gap-1.5">
        <motion.div
          className={cn("w-2 h-2 rounded-full", getStateColor())}
          animate={isConnected ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <span className="text-[10px] text-text-muted">{getStateText()}</span>
      </div>

      {/* Connection toggle button */}
      <button
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isLoading}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          "hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed",
          isConnected ? "text-neon-green" : "text-text-muted"
        )}
        title={isConnected ? "Disconnect" : "Connect"}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isConnected ? (
          <Wifi className="w-3.5 h-3.5" />
        ) : (
          <WifiOff className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
