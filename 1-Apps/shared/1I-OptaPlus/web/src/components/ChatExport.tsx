"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatMessage } from "@/types";

type ExportFormat = "markdown" | "json" | "text";

interface ChatExportProps {
  messages: ChatMessage[];
  botName: string;
  onClose: () => void;
}

function formatMarkdown(messages: ChatMessage[], botName: string): string {
  const lines: string[] = [`# ${botName} — Chat Export`, `*Exported ${new Date().toLocaleString()}*`, ""];
  for (const m of messages) {
    const role = m.role === "user" ? "**You**" : `**${botName}**`;
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    lines.push(`### ${role} — ${time}`);
    lines.push(m.content);
    lines.push("");
  }
  return lines.join("\n");
}

function formatText(messages: ChatMessage[], botName: string): string {
  const lines: string[] = [`${botName} — Chat Export`, `Exported ${new Date().toLocaleString()}`, "", "---", ""];
  for (const m of messages) {
    const role = m.role === "user" ? "You" : botName;
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    lines.push(`[${time}] ${role}:`);
    lines.push(m.content);
    lines.push("");
  }
  return lines.join("\n");
}

function formatJson(messages: ChatMessage[]): string {
  const data = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    replyToId: m.replyToId,
    isPinned: m.isPinned,
  }));
  return JSON.stringify(data, null, 2);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ChatExport({ messages, botName, onClose }: ChatExportProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");

  const handleExport = () => {
    const slug = botName.toLowerCase().replace(/\s+/g, "-");
    const date = new Date().toISOString().slice(0, 10);
    switch (format) {
      case "markdown":
        download(formatMarkdown(messages, botName), `${slug}-${date}.md`, "text/markdown");
        break;
      case "json":
        download(formatJson(messages), `${slug}-${date}.json`, "application/json");
        break;
      case "text":
        download(formatText(messages, botName), `${slug}-${date}.txt`, "text/plain");
        break;
    }
    onClose();
  };

  const formats: { value: ExportFormat; label: string; icon: string }[] = [
    { value: "markdown", label: "Markdown", icon: "📝" },
    { value: "json", label: "JSON", icon: "{ }" },
    { value: "text", label: "Plain Text", icon: "📄" },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-heavy rounded-2xl p-6 w-80 glow-primary"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-1">Export Chat</h3>
        <p className="text-xs text-text-muted mb-4">{messages.length} messages</p>

        <div className="space-y-2 mb-5">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                format === f.value
                  ? "bg-primary/15 border border-primary/25 text-primary"
                  : "glass hover:bg-white/[0.04]"
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm text-text-secondary hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            className="flex-1 py-2.5 rounded-xl bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
          >
            Export
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
