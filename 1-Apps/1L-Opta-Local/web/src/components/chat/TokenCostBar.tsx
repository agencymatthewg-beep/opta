'use client';

/**
 * TokenCostBar — Compact token counter and cloud cost savings display.
 *
 * Renders below the chat input area. Shows running token count and
 * estimated cloud equivalent cost. Expandable to show per-provider
 * breakdown. Uses tabular-nums for number alignment.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, Coins, Zap } from 'lucide-react';
import { cn } from '@opta/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenCostBarProps {
  /** Estimated prompt (input) token count */
  promptTokens: number;
  /** Estimated completion (output) token count */
  completionTokens: number;
  /** Total estimated tokens */
  totalTokens: number;
  /** Estimated cost per cloud provider (USD) */
  estimatedCosts: Record<string, number>;
  /** Whether chat is currently streaming */
  isStreaming: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number with commas (e.g. 1234 -> "1,234") */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format USD cost with appropriate precision */
function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TokenCostBar({
  promptTokens,
  completionTokens,
  totalTokens,
  estimatedCosts,
  isStreaming,
}: TokenCostBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render if no tokens yet
  if (totalTokens === 0) return null;

  // Average cloud cost
  const providers = Object.entries(estimatedCosts);
  const avgCost =
    providers.length > 0
      ? providers.reduce((sum, [, cost]) => sum + cost, 0) / providers.length
      : 0;

  return (
    <div className="px-4 max-w-4xl mx-auto w-full">
      <div className="glass-subtle rounded-lg overflow-hidden">
        {/* Main bar */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className={cn(
            'flex w-full items-center justify-between px-3 py-1.5',
            'text-xs transition-colors hover:bg-white/[0.02]',
          )}
        >
          <div className="flex items-center gap-3">
            {/* Token count with streaming pulse */}
            <span className="flex items-center gap-1.5 text-text-muted">
              <Zap className="h-3 w-3" />
              <span className="relative">
                <span className="tabular-nums">
                  {formatNumber(totalTokens)}
                </span>
                {isStreaming && (
                  <motion.span
                    className="absolute -right-1.5 top-0 h-1.5 w-1.5 rounded-full bg-primary"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </span>
              <span>tokens</span>
            </span>

            {/* Savings indicator */}
            {avgCost > 0 && (
              <span className="flex items-center gap-1 text-neon-green">
                <Coins className="h-3 w-3" />
                <span>
                  Saved ~{formatCost(avgCost)} vs cloud
                </span>
              </span>
            )}
          </div>

          {/* Expand chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="h-3 w-3 text-text-muted" />
          </motion.div>
        </button>

        {/* Expanded breakdown */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="border-t border-opta-border px-3 py-2 space-y-2">
                {/* Token breakdown */}
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>
                    Prompt:{' '}
                    <span className="tabular-nums text-text-secondary">
                      {formatNumber(promptTokens)}
                    </span>
                  </span>
                  <span>
                    Completion:{' '}
                    <span className="tabular-nums text-text-secondary">
                      {formatNumber(completionTokens)}
                    </span>
                  </span>
                </div>

                {/* Per-provider costs */}
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest">
                    Cloud equivalent cost
                  </p>
                  {providers.map(([provider, cost]) => (
                    <div
                      key={provider}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-text-secondary">{provider}</span>
                      <span className="tabular-nums text-text-muted">
                        {formatCost(cost)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-opta-border">
                    <span className="font-medium text-text-secondary">
                      Your cost (local)
                    </span>
                    <span className="font-medium tabular-nums text-neon-green">
                      $0.00
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
