'use client';

/**
 * QueryPanel — Semantic search interface for RAG collections.
 *
 * Provides a query input with search mode toggle (vector/keyword/hybrid),
 * top-k slider, and displays results as glass cards with score badges,
 * text previews, and metadata. Scores are color-coded: green > 0.8,
 * amber 0.5-0.8, red < 0.5.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Settings2,
  Clock,
  Hash,
} from 'lucide-react';
import { cn, Button, Badge } from '@opta/ui';
import { truncate } from '@/lib/format';
import type { RagQueryRequest, RagQueryResponse, RagQueryResult } from '@/types/rag';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchMode = 'vector' | 'keyword' | 'hybrid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QueryPanelProps {
  /** Collection to query (null = no collection selected) */
  selectedCollection: string | null;
  /** Called to execute a query */
  onQuery: (req: RagQueryRequest) => Promise<RagQueryResponse>;
  /** Additional class names */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score >= 0.8) return 'text-neon-green';
  if (score >= 0.5) return 'text-neon-amber';
  return 'text-neon-red';
}

function scoreBarColor(score: number): string {
  if (score >= 0.8) return 'bg-neon-green';
  if (score >= 0.5) return 'bg-neon-amber';
  return 'bg-neon-red';
}

function scoreBadgeVariant(score: number): 'default' | 'purple' {
  return score >= 0.8 ? 'purple' : 'default';
}

// truncate imported from @/lib/format

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueryPanel({
  selectedCollection,
  onQuery,
  className,
}: QueryPanelProps) {
  // Query state
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('vector');
  const [topK, setTopK] = useState(5);
  const [showSettings, setShowSettings] = useState(false);

  // Result state
  const [isQuerying, setIsQuerying] = useState(false);
  const [response, setResponse] = useState<RagQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleQuery = useCallback(async () => {
    if (!selectedCollection || !query.trim()) return;

    setIsQuerying(true);
    setError(null);
    setResponse(null);

    try {
      const res = await onQuery({
        collection: selectedCollection,
        query: query.trim(),
        top_k: topK,
        search_mode: searchMode,
      });
      setResponse(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Query failed',
      );
    } finally {
      setIsQuerying(false);
    }
  }, [selectedCollection, query, topK, searchMode, onQuery]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleQuery();
      }
    },
    [handleQuery],
  );

  const copyToClipboard = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        // Clipboard not available
      }
    },
    [],
  );

  const copyAllContext = useCallback(async () => {
    if (!response) return;
    const allText = response.results
      .map((r) => r.text)
      .join('\n\n---\n\n');
    await copyToClipboard(allText, '__all__');
  }, [response, copyToClipboard]);

  const canQuery =
    selectedCollection != null &&
    query.trim().length > 0 &&
    !isQuerying;

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* No collection selected */}
      {!selectedCollection && (
        <div className="text-center py-8">
          <Search className="mx-auto h-8 w-8 text-text-muted mb-3" />
          <p className="text-sm text-text-secondary">
            Select a collection from the sidebar to start querying
          </p>
        </div>
      )}

      {selectedCollection && (
        <>
          {/* Query input */}
          <div>
            <label
              htmlFor="rag-query"
              className="block text-xs font-semibold text-text-muted uppercase tracking-widest mb-2"
            >
              Search Query
            </label>
            <div className="relative">
              <input
                id="rag-query"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search your documents..."
                className={cn(
                  'w-full rounded-lg pl-3 pr-24 py-2.5 text-sm',
                  'bg-opta-surface border border-opta-border',
                  'text-text-primary placeholder:text-text-muted',
                  'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                  'transition-colors',
                )}
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleQuery}
                  disabled={!canQuery}
                >
                  {isQuerying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-3.5 w-3.5 mr-1" />
                      Search
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Search mode toggle + settings */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(['vector', 'keyword', 'hybrid'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSearchMode(mode)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                    searchMode === mode
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'bg-opta-surface text-text-secondary border border-transparent hover:border-opta-border',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowSettings((prev) => !prev)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
              aria-expanded={showSettings}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </button>
          </div>

          {/* Settings panel */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs text-text-muted">
                    Top K Results
                  </label>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {topK}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  className="w-full accent-primary mt-1"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-4 py-3"
              >
                <AlertCircle className="h-4 w-4 text-neon-red flex-shrink-0 mt-0.5" />
                <p className="text-sm text-neon-red break-words">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence mode="wait">
            {response && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {/* Results header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                      Results ({response.results.length} / {response.total_in_collection})
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                      <Clock className="w-3 h-3" />
                      <span className="tabular-nums">
                        {response.duration_ms.toFixed(0)}
                      </span>
                      ms
                    </span>
                  </div>

                  {response.results.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyAllContext}
                      className="text-xs"
                    >
                      {copiedId === '__all__' ? (
                        <>
                          <Check className="h-3 w-3 mr-1 text-neon-green" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy All
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Result cards */}
                {response.results.length === 0 && (
                  <div className="text-center py-8">
                    <Search className="mx-auto h-6 w-6 text-text-muted mb-2" />
                    <p className="text-sm text-text-secondary">
                      No results found for this query
                    </p>
                  </div>
                )}

                {response.results.map((result, i) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    index={i}
                    isCopied={copiedId === result.id}
                    onCopy={() => copyToClipboard(result.text, result.id)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultCard sub-component
// ---------------------------------------------------------------------------

interface ResultCardProps {
  result: RagQueryResult;
  index: number;
  isCopied: boolean;
  onCopy: () => void;
}

function ResultCard({ result, index, isCopied, onCopy }: ResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = result.text.length > 300;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.15 }}
      className="glass-subtle rounded-xl px-4 py-3.5 group"
    >
      {/* Header row: score + metadata */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {/* Score badge */}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'h-2 rounded-full',
                scoreBarColor(result.score),
              )}
              style={{ width: `${Math.max(result.score * 48, 8)}px` }}
            />
            <span
              className={cn(
                'text-xs font-semibold tabular-nums',
                scoreColor(result.score),
              )}
            >
              {result.score.toFixed(3)}
            </span>
          </div>

          {/* Rank number */}
          <Badge variant={scoreBadgeVariant(result.score)} size="sm">
            <Hash className="w-2.5 h-2.5 mr-0.5" />
            {index + 1}
          </Badge>

          {/* Source metadata */}
          {'source' in result.metadata && typeof result.metadata.source === 'string' && (
            <span className="text-xs text-text-muted truncate max-w-[200px]">
              {result.metadata.source}
            </span>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={onCopy}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
            'text-text-muted hover:text-text-secondary',
          )}
          aria-label="Copy text"
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-neon-green" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Text content */}
      <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap break-words font-mono">
        {isExpanded || !isLong
          ? result.text
          : truncate(result.text, 300)}
      </p>

      {isLong && (
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-1.5 text-xs text-primary hover:text-primary-glow transition-colors"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}

      {/* Metadata tags */}
      {Object.keys(result.metadata).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Object.entries(result.metadata)
            .filter(([key]) => key !== 'source')
            .slice(0, 5)
            .map(([key, value]) => (
              <Badge key={key} variant="default" size="sm">
                {key}: {String(value)}
              </Badge>
            ))}
        </div>
      )}
    </motion.div>
  );
}
