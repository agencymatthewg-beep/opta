"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot } from "@/types";

interface AddBotModalProps {
  onAdd: (bot: Bot) => void;
  onClose: () => void;
}

export function AddBotModal({ onAdd, onClose }: AddBotModalProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("3000");
  const [token, setToken] = useState("");
  const [color, setColor] = useState("#8B5CF6");

  const handleSubmit = () => {
    if (!name || !host || !token) return;
    onAdd({
      id: crypto.randomUUID(),
      name,
      host,
      port: parseInt(port, 10),
      token,
      accentColor: color,
      connectionMethod: "manual",
      isEnabled: true,
    });
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-heavy rounded-2xl p-6 w-96 glow-primary"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4">Add Bot</h3>
        <div className="space-y-3">
          <input
            placeholder="Bot name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/[0.04] border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40"
          />
          <div className="flex gap-2">
            <input
              placeholder="Host (IP or domain)"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40"
            />
            <input
              placeholder="Port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-20 bg-white/[0.04] border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40"
            />
          </div>
          <input
            placeholder="Gateway token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full bg-white/[0.04] border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/40"
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-text-secondary">Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg border-0 cursor-pointer"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-text-secondary hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
          >
            Add
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
