'use client';

/**
 * Tool Call Block
 *
 * Renders tool call information from CLI sessions as collapsible blocks.
 * Read-only display of historical tool usage — users cannot invoke tools
 * from the web UI. Shows function name, arguments (JSON), and result.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@opta/ui';
import { truncate } from '@/lib/format';
import type { ToolCall } from '@/types/lmx';

interface ToolCallBlockProps {
  /** Tool calls from an assistant message. */
  toolCalls: ToolCall[];
  /** Tool result content (from the subsequent tool-role message). */
  toolResult?: string;
}

/**
 * Format JSON string with indentation for display.
 * Falls back to the raw string if parsing fails.
 */
function formatArgs(argsStr: string): string {
  try {
    return JSON.stringify(JSON.parse(argsStr), null, 2);
  } catch {
    return argsStr;
  }
}

/**
 * Collapsible display for a single tool call.
 */
function SingleToolCall({
  toolCall,
  toolResult,
}: {
  toolCall: ToolCall;
  toolResult?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-subtle rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          'text-sm text-text-secondary hover:text-text-primary',
          'transition-colors',
        )}
        aria-expanded={expanded}
      >
        <Wrench className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span className="truncate font-medium">
          Used tool: {toolCall.function.name}
        </span>
        <span className="ml-auto flex-shrink-0">
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2 border-t border-opta-border/50">
              {/* Arguments */}
              <div className="pt-2">
                <p className="text-xs text-text-muted mb-1 font-medium">Arguments</p>
                <pre className="text-xs font-mono text-text-secondary bg-opta-bg/50 rounded-md p-2 overflow-x-auto max-h-48">
                  {formatArgs(toolCall.function.arguments)}
                </pre>
              </div>

              {/* Result */}
              {toolResult && (
                <div>
                  <p className="text-xs text-text-muted mb-1 font-medium">Result</p>
                  <pre className="text-xs font-mono text-text-secondary bg-opta-bg/50 rounded-md p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {truncate(toolResult, 2000)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Renders one or more tool calls as collapsible blocks.
 *
 * - Collapsed: "Used tool: {function.name}" with chevron
 * - Expanded: JSON-formatted arguments and optional result
 * - Glass-subtle background, monospace font for code content
 */
export function ToolCallBlock({ toolCalls, toolResult }: ToolCallBlockProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {toolCalls.map((tc) => (
        <SingleToolCall
          key={tc.id}
          toolCall={tc}
          toolResult={toolResult}
        />
      ))}
    </div>
  );
}
