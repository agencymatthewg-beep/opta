"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

export function CodeBlock({ code, language, filename, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable in non-secure contexts */ }
  };

  return (
    <div className={cn("relative group rounded-lg overflow-hidden border border-white/5 mb-4", className)}>
      {(filename || language) && (
        <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-white/5">
          <span className="text-xs text-text-muted font-mono">
            {filename || language}
          </span>
          <button
            onClick={handleCopy}
            className="text-text-muted hover:text-text-secondary transition-colors"
            aria-label="Copy code"
          >
            {copied ? <Check size={14} className="text-neon-green" /> : <Copy size={14} />}
          </button>
        </div>
      )}
      <div className="relative">
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed bg-[var(--color-code-bg)]">
          <code className="text-text-secondary">{code}</code>
        </pre>
        {!filename && !language && (
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-secondary transition-all"
            aria-label="Copy code"
          >
            {copied ? <Check size={14} className="text-neon-green" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}
