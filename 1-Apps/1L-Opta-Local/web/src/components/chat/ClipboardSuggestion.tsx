'use client';

import { cn } from '@opta/ui';
import { motion } from 'framer-motion';
import {
  Code2,
  Paintbrush,
  Braces,
  FileCode2,
  Database,
  Terminal,
  Link,
  FileText,
  X,
} from 'lucide-react';
import type { ClipboardContentType } from '@/hooks/useClipboardDetector';

// ---------------------------------------------------------------------------
// Icon Map — Lucide React icons keyed by string name from detection hook
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Code2,
  Paintbrush,
  Braces,
  FileCode2,
  Database,
  Terminal,
  Link,
  FileText,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ClipboardSuggestionProps {
  type: ClipboardContentType;
  icon: string;
  label: string;
  suggestions: readonly string[];
  onSelect: (prompt: string, content: string) => void;
  onDismiss: () => void;
  pastedContent: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Floating suggestion panel that appears above the chat input when clipboard
 * content is detected. Shows the detected type with icon, label, and a row
 * of suggested prompts. Clicking a suggestion fills the input with a
 * formatted prompt + the pasted content.
 *
 * Animation: Framer Motion slide-up from bottom with fade.
 * Styling: glass-subtle with primary border glow.
 */
export function ClipboardSuggestion({
  type,
  icon,
  label,
  suggestions,
  onSelect,
  onDismiss,
  pastedContent,
}: ClipboardSuggestionProps) {
  const IconComponent = ICON_MAP[icon] ?? FileText;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'glass-subtle rounded-xl px-4 py-3 max-w-4xl mx-auto mb-2',
        'border border-primary/30 shadow-[0_0_12px_0_rgba(139,92,246,0.15)]',
      )}
      role="region"
      aria-label={`${label} — clipboard suggestions`}
    >
      {/* Header row: icon + label + dismiss */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-text-secondary">{label}</span>
          <span className="text-[10px] text-text-muted font-mono px-1.5 py-0.5 rounded glass-subtle">
            {type}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'p-1 rounded-md transition-colors',
            'text-text-muted hover:text-text-secondary hover:bg-white/5',
          )}
          aria-label="Dismiss suggestions"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Suggestion buttons */}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt, pastedContent)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg transition-colors',
              'glass-subtle border border-primary/20',
              'text-text-primary hover:text-primary-glow',
              'hover:border-primary/40 hover:bg-primary/10',
            )}
          >
            {prompt}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
