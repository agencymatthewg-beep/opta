'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Swords,
  SendHorizontal,
  Square,
  ChevronDown,
  ChevronUp,
  Trophy,
  BarChart3,
  Check,
} from 'lucide-react';
import Link from 'next/link';
import { cn, Button } from '@opta/ui';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { useModels } from '@/hooks/useModels';
import { useArenaStream } from '@/hooks/useArenaStream';
import { saveVote, getVoteStats } from '@/lib/arena-store';
import type { ArenaVote, ModelWinStats } from '@/lib/arena-store';
import { ArenaPanel } from '@/components/arena/ArenaPanel';
import { ArenaRating } from '@/components/arena/ArenaRating';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArenaPage() {
  // ---- Connection ----
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const { models, isLoading: modelsLoading } = useModels(client);

  // ---- Model selection ----
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  // ---- Prompt input ----
  const [promptValue, setPromptValue] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');

  // ---- Arena streaming ----
  const selectedArray = useMemo(
    () => Array.from(selectedModels),
    [selectedModels],
  );
  const { channels, sendPrompt, stopAll, isAnyStreaming, reset } =
    useArenaStream(client, selectedArray);

  // ---- Rating state ----
  const [hasRated, setHasRated] = useState(false);

  // ---- Vote history ----
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState<ModelWinStats[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  // Determine if all channels have finished
  const allFinished =
    channels.length > 0 && channels.every((ch) => !ch.isStreaming);
  const hasChannels = channels.length > 0;

  // ---- Auto-select first 2 models when available ----
  useEffect(() => {
    if (selectedModels.size === 0 && models.length >= 2) {
      setSelectedModels(new Set([models[0]!.id, models[1]!.id]));
    }
  }, [models, selectedModels.size]);

  // ---- Load stats when history panel opens ----
  useEffect(() => {
    if (!showHistory) return;
    let cancelled = false;
    setStatsLoading(true);

    void getVoteStats().then((result) => {
      if (!cancelled) {
        setStats(result);
        setStatsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [showHistory, hasRated]);

  // ---- Handlers ----

  const toggleModel = useCallback(
    (modelId: string) => {
      setSelectedModels((prev) => {
        const next = new Set(prev);
        if (next.has(modelId)) {
          next.delete(modelId);
        } else if (next.size < 3) {
          next.add(modelId);
        }
        return next;
      });
    },
    [],
  );

  const handleSend = useCallback(() => {
    const trimmed = promptValue.trim();
    if (!trimmed || selectedModels.size < 2 || isAnyStreaming) return;

    setHasRated(false);
    setLastPrompt(trimmed);
    sendPrompt(trimmed);
    setPromptValue('');
  }, [promptValue, selectedModels.size, isAnyStreaming, sendPrompt]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleRate = useCallback(
    async (winner: string | 'tie') => {
      if (hasRated) return;

      // Build ratings map
      const ratings: Record<string, 'better' | 'worse' | 'tie'> = {};
      for (const modelId of selectedArray) {
        if (winner === 'tie') {
          ratings[modelId] = 'tie';
        } else if (modelId === winner) {
          ratings[modelId] = 'better';
        } else {
          ratings[modelId] = 'worse';
        }
      }

      const vote: ArenaVote = {
        id: crypto.randomUUID(),
        prompt: lastPrompt,
        models: selectedArray,
        winner,
        ratings,
        created_at: new Date().toISOString(),
      };

      await saveVote(vote);
      setHasRated(true);
    },
    [hasRated, selectedArray, lastPrompt],
  );

  const handleReset = useCallback(() => {
    reset();
    setHasRated(false);
    setLastPrompt('');
  }, [reset]);

  const canSend =
    promptValue.trim().length > 0 &&
    selectedModels.size >= 2 &&
    !isAnyStreaming;

  // ---- Render ----

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10',
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-neon-amber" />
          <h1 className="text-lg font-semibold text-text-primary">Arena</h1>
        </div>

        {hasChannels && (
          <div className="ml-auto">
            <Button variant="primary" size="sm" onClick={handleReset}>
              New Round
            </Button>
          </div>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Model selector */}
          <ModelSelector
            models={models}
            selectedModels={selectedModels}
            onToggle={toggleModel}
            isLoading={modelsLoading}
            disabled={isAnyStreaming}
          />

          {/* Empty state */}
          {!hasChannels && (
            <EmptyState
              hasEnoughModels={models.length >= 2}
              hasSelectedModels={selectedModels.size >= 2}
            />
          )}

          {/* Arena panels — side by side */}
          {hasChannels && (
            <div
              className={cn(
                'grid gap-4',
                channels.length === 2 && 'grid-cols-1 md:grid-cols-2',
                channels.length === 3 && 'grid-cols-1 md:grid-cols-3',
              )}
            >
              {channels.map((channel) => (
                <ArenaPanel
                  key={channel.modelId}
                  modelId={channel.modelId}
                  content={channel.content}
                  isStreaming={channel.isStreaming}
                  error={channel.error}
                  tokenCount={channel.tokenCount}
                  elapsedMs={
                    channel.finishedAt !== null
                      ? channel.finishedAt - channel.startedAt
                      : channel.isStreaming
                        ? null
                        : null
                  }
                />
              ))}
            </div>
          )}

          {/* Rating bar — appears after all models finish */}
          <AnimatePresence>
            {allFinished && !hasRated && (
              <ArenaRating
                models={selectedArray}
                onRate={(winner) => void handleRate(winner)}
                disabled={isAnyStreaming}
              />
            )}
          </AnimatePresence>

          {/* Rated confirmation */}
          <AnimatePresence>
            {hasRated && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-subtle rounded-xl px-4 py-3 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4 text-neon-green" />
                <span className="text-sm text-text-secondary">
                  Vote recorded. Start a new round or review history below.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vote history (collapsible) */}
          <div className="pt-2">
            <button
              onClick={() => setShowHistory((prev) => !prev)}
              className={cn(
                'flex items-center gap-2 text-sm text-text-secondary',
                'hover:text-text-primary transition-colors',
              )}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Vote History</span>
              {showHistory ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>

            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <VoteHistoryTable stats={stats} isLoading={statsLoading} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Prompt input (pinned to bottom) */}
      <div className="border-t border-opta-border px-4 py-3 flex-shrink-0">
        <div className="glass-subtle rounded-xl flex items-end gap-2 px-4 py-2 max-w-4xl mx-auto">
          <textarea
            value={promptValue}
            onChange={(e) => setPromptValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedModels.size < 2
                ? 'Select at least 2 models above...'
                : 'Enter a prompt to compare models...'
            }
            disabled={isAnyStreaming || selectedModels.size < 2}
            rows={1}
            className={cn(
              'flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted',
              'text-sm leading-relaxed resize-none py-1',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          />
          {isAnyStreaming ? (
            <button
              type="button"
              onClick={stopAll}
              className={cn(
                'flex-shrink-0 p-2 rounded-lg transition-colors',
                'text-neon-red hover:text-neon-red/80 hover:bg-neon-red/10',
              )}
              aria-label="Stop all streams"
            >
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'flex-shrink-0 p-2 rounded-lg transition-colors',
                canSend
                  ? 'text-primary hover:text-primary-glow hover:bg-primary/10'
                  : 'text-text-muted cursor-not-allowed',
              )}
              aria-label="Send prompt"
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
        <p className="text-center text-xs text-text-muted mt-2 max-w-4xl mx-auto">
          Same prompt sent to all selected models simultaneously.
        </p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ModelSelector({
  models,
  selectedModels,
  onToggle,
  isLoading,
  disabled,
}: {
  models: { id: string; name: string; quantization?: string }[];
  selectedModels: Set<string>;
  onToggle: (modelId: string) => void;
  isLoading: boolean;
  disabled: boolean;
}) {
  if (isLoading) {
    return (
      <div className="glass-subtle rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-text-muted/10 rounded w-1/4 mb-3" />
        <div className="flex gap-2">
          <div className="h-9 bg-text-muted/10 rounded-lg w-32" />
          <div className="h-9 bg-text-muted/10 rounded-lg w-32" />
          <div className="h-9 bg-text-muted/10 rounded-lg w-32" />
        </div>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="glass-subtle rounded-xl p-4 text-center">
        <p className="text-sm text-text-secondary">
          No models loaded. Load at least 2 models from the Models page to use
          Arena mode.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-subtle rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-text-secondary">
          Select 2-3 models to compare
        </p>
        <span className="text-xs text-text-muted tabular-nums">
          {selectedModels.size}/3 selected
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {models.map((model) => {
          const isSelected = selectedModels.has(model.id);
          const isMaxed = selectedModels.size >= 3 && !isSelected;

          return (
            <button
              key={model.id}
              onClick={() => onToggle(model.id)}
              disabled={disabled || isMaxed}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                'transition-all duration-150',
                isSelected
                  ? 'glass text-text-primary border border-primary/40 shadow-sm shadow-primary/10'
                  : 'glass-subtle text-text-secondary hover:text-text-primary',
                (disabled || isMaxed) &&
                  !isSelected &&
                  'opacity-40 cursor-not-allowed',
              )}
            >
              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
              <span className="truncate max-w-[200px]">{model.name}</span>
              {model.quantization && (
                <span className="text-xs text-text-muted">
                  {model.quantization}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({
  hasEnoughModels,
  hasSelectedModels,
}: {
  hasEnoughModels: boolean;
  hasSelectedModels: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto mb-6">
        <Swords className="w-8 h-8 text-neon-amber" />
      </div>
      <h2 className="text-2xl font-semibold text-text-primary mb-2">
        Multi-Model Arena
      </h2>
      <p className="text-text-secondary max-w-md mb-4">
        {!hasEnoughModels
          ? 'Load at least 2 models to start comparing. Head to Models to load runtime models.'
          : !hasSelectedModels
            ? 'Select at least 2 models above, then enter a prompt to see them compete.'
            : 'Enter a prompt below to send it to all selected models simultaneously.'}
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-xs text-text-muted max-w-lg">
        <span className="glass-subtle rounded-full px-3 py-1.5">
          Side-by-side comparison
        </span>
        <span className="glass-subtle rounded-full px-3 py-1.5">
          Rate responses
        </span>
        <span className="glass-subtle rounded-full px-3 py-1.5">
          Build preference data
        </span>
      </div>
    </motion.div>
  );
}

function VoteHistoryTable({
  stats,
  isLoading,
}: {
  stats: ModelWinStats[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-3 glass-subtle rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-text-muted/10 rounded w-1/3 mb-3" />
        <div className="h-4 bg-text-muted/10 rounded w-full mb-2" />
        <div className="h-4 bg-text-muted/10 rounded w-full" />
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="mt-3 glass-subtle rounded-xl p-4">
        <p className="text-sm text-text-muted text-center">
          No votes recorded yet. Complete an arena round to see stats.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 glass-subtle rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-opta-border">
            <th className="text-left px-4 py-2.5 text-text-secondary font-medium">
              Model
            </th>
            <th className="text-center px-3 py-2.5 text-text-secondary font-medium tabular-nums">
              Wins
            </th>
            <th className="text-center px-3 py-2.5 text-text-secondary font-medium tabular-nums">
              Losses
            </th>
            <th className="text-center px-3 py-2.5 text-text-secondary font-medium tabular-nums">
              Ties
            </th>
            <th className="text-right px-4 py-2.5 text-text-secondary font-medium tabular-nums">
              Win Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.map((stat, index) => (
            <tr
              key={stat.modelId}
              className={cn(
                'border-b border-opta-border/50 last:border-b-0',
                index === 0 && 'bg-neon-amber/5',
              )}
            >
              <td className="px-4 py-2.5 text-text-primary flex items-center gap-2">
                {index === 0 && (
                  <Trophy className="w-3.5 h-3.5 text-neon-amber flex-shrink-0" />
                )}
                <span className="truncate max-w-[200px]">
                  {extractModelName(stat.modelId)}
                </span>
              </td>
              <td className="text-center px-3 py-2.5 text-neon-green tabular-nums">
                {stat.wins}
              </td>
              <td className="text-center px-3 py-2.5 text-neon-red tabular-nums">
                {stat.losses}
              </td>
              <td className="text-center px-3 py-2.5 text-text-muted tabular-nums">
                {stat.ties}
              </td>
              <td className="text-right px-4 py-2.5 text-text-primary font-medium tabular-nums">
                {(stat.winRate * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractModelName(modelId: string): string {
  const parts = modelId.split('/');
  return parts[parts.length - 1] ?? modelId;
}
