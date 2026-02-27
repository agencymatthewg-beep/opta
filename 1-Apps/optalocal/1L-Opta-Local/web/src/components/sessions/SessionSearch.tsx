'use client';

/**
 * SessionSearch — Debounced search input with filter chips for sessions.
 *
 * Provides a glass-style search bar with Lucide Search icon and 300ms
 * debounce. Below the search bar: model filter dropdown, tag filter,
 * and a clear-all button. Shows result count contextually.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { cn, Badge } from '@opta/ui';
import { shortModelName } from '@/lib/format';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionSearchProps {
  /** Current search query (controlled) */
  searchQuery: string;
  /** Update the search query */
  onSearchChange: (query: string) => void;
  /** Available models for the filter dropdown */
  availableModels: string[];
  /** Current model filter */
  modelFilter: string;
  /** Update model filter */
  onModelFilterChange: (model: string) => void;
  /** Available tags for the filter */
  availableTags: string[];
  /** Current tag filter */
  tagFilter: string;
  /** Update tag filter */
  onTagFilterChange: (tag: string) => void;
  /** Whether any filters are active */
  hasActiveFilters: boolean;
  /** Clear all search and filters */
  onClearFilters: () => void;
  /** Number of results shown */
  resultCount: number;
  /** Total session count (before filters) */
  totalCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// shortModelName imported from shared utils

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionSearch({
  searchQuery,
  onSearchChange,
  availableModels,
  modelFilter,
  onModelFilterChange,
  availableTags,
  tagFilter,
  onTagFilterChange,
  hasActiveFilters,
  onClearFilters,
  resultCount,
  totalCount,
}: SessionSearchProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external query changes (e.g., from clearFilters)
  useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Debounce search input
  const handleInputChange = useCallback(
    (value: string) => {
      setLocalQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleClearSearch = useCallback(() => {
    setLocalQuery('');
    onSearchChange('');
    inputRef.current?.focus();
  }, [onSearchChange]);

  // Result count text
  const countText = hasActiveFilters
    ? `${resultCount} of ${totalCount} sessions`
    : `${totalCount} sessions`;

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
        <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search sessions..."
          value={localQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          className={cn(
            'bg-transparent text-text-primary text-sm flex-1',
            'placeholder:text-text-muted outline-none',
          )}
          aria-label="Search sessions"
        />

        {localQuery && (
          <button
            onClick={handleClearSearch}
            className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <span className="text-xs text-text-muted whitespace-nowrap">
          {countText}
        </span>
      </div>

      {/* Filter chips */}
      {(availableModels.length > 0 || availableTags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />

          {/* Model filter chips */}
          {availableModels.map((model) => (
            <button
              key={model}
              onClick={() =>
                onModelFilterChange(modelFilter === model ? '' : model)
              }
              className="transition-colors"
            >
              <Badge
                variant={modelFilter === model ? 'purple' : 'default'}
                size="sm"
                className={cn(
                  'cursor-pointer',
                  modelFilter !== model && 'opacity-60 hover:opacity-100',
                )}
              >
                {shortModelName(model)}
              </Badge>
            </button>
          ))}

          {/* Tag filter chips */}
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() =>
                onTagFilterChange(tagFilter === tag ? '' : tag)
              }
              className="transition-colors"
            >
              <Badge
                variant={tagFilter === tag ? 'info' : 'default'}
                size="sm"
                className={cn(
                  'cursor-pointer',
                  tagFilter !== tag && 'opacity-60 hover:opacity-100',
                )}
              >
                {tag}
              </Badge>
            </button>
          ))}

          {/* Clear all filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className={cn(
                'text-xs text-text-muted hover:text-text-primary',
                'transition-colors ml-1',
              )}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
