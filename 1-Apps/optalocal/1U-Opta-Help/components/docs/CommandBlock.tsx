"use client";

import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

interface CommandBlockProps {
  command: string;
  output?: string;
  description?: string;
}

export function CommandBlock({ command, output, description }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable in non-secure contexts */ }
  };

  return (
    <div className="rounded-lg border border-white/5 overflow-hidden mb-4">
      {description && (
        <div className="px-4 py-2 bg-surface border-b border-white/5 text-xs text-text-muted">
          {description}
        </div>
      )}
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--color-code-bg)] group">
        <Terminal size={14} className="text-text-muted shrink-0" />
        <code className="flex-1 text-sm text-neon-cyan font-mono">{command}</code>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-secondary transition-all shrink-0"
          aria-label="Copy command"
        >
          {copied ? <Check size={14} className="text-neon-green" /> : <Copy size={14} />}
        </button>
      </div>
      {output && (
        <pre className="px-4 py-3 border-t border-white/5 bg-[var(--color-code-bg)] text-xs text-text-muted font-mono overflow-x-auto">
          {output}
        </pre>
      )}
    </div>
  );
}
