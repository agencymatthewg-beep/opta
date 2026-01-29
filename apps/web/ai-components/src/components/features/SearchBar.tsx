'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';
import { useModelSearch } from '@/lib/hooks/useModels';
import type { AIModel } from '@/lib/types';

interface SearchBarProps {
  allModels: AIModel[];
  onSelect?: (model: AIModel) => void;
  onSearchChange?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Universal search bar with fuzzy matching and dropdown results
 */
export function SearchBar({
  allModels,
  onSelect,
  onSearchChange,
  placeholder = 'Search models...',
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      onSearchChange?.(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearchChange]);

  // Get search results using Fuse.js
  const searchResults = useModelSearch(debouncedQuery, allModels, 5);

  // Open dropdown when we have results
  useEffect(() => {
    if (searchResults.length > 0 && query.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchResults.length, query.length]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < searchResults.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : searchResults.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
            handleSelect(searchResults[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, searchResults, highlightedIndex]
  );

  const handleSelect = (model: AIModel) => {
    onSelect?.(model);
    setQuery(model.name);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    onSearchChange?.('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn('relative w-full max-w-md', className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <Search className="w-5 h-5 text-text-muted" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-12 pr-10 py-3 rounded-xl',
            'bg-white/5 backdrop-blur-md border border-glass-border',
            'text-white placeholder:text-text-muted',
            'focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/50',
            'transition-all duration-200'
          )}
          aria-label="Search AI models"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="search-results"
          role="combobox"
        />
        {/* Clear button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-4 text-text-muted hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="search-results"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 w-full mt-2 rounded-xl overflow-hidden',
              'bg-opta-bg/95 backdrop-blur-xl border border-glass-border',
              'shadow-2xl shadow-purple-glow/20'
            )}
            role="listbox"
          >
            {searchResults.map((model, index) => (
              <motion.button
                key={model.id}
                onClick={() => handleSelect(model)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left',
                  'transition-colors duration-100',
                  highlightedIndex === index
                    ? 'bg-purple-glow/20'
                    : 'hover:bg-white/5'
                )}
                role="option"
                aria-selected={highlightedIndex === index}
              >
                <CompanyLogo company={model.company} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {model.name}
                  </p>
                  <p className="text-xs text-text-muted truncate">
                    {model.company} &middot; Rank #{model.rank}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-mono text-purple-glow">
                    {model.compositeScore}
                  </span>
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </motion.button>
            ))}

            {/* Footer hint */}
            <div className="px-4 py-2 border-t border-glass-border bg-white/2">
              <p className="text-[10px] text-text-muted">
                <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">
                  ↑↓
                </kbd>{' '}
                to navigate &middot;{' '}
                <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">
                  Enter
                </kbd>{' '}
                to select &middot;{' '}
                <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono">
                  Esc
                </kbd>{' '}
                to close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Minimal search input for filter bars
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="w-4 h-4 text-text-muted" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full pl-9 pr-8 py-2 rounded-lg text-sm',
          'bg-white/5 border border-glass-border',
          'text-white placeholder:text-text-muted',
          'focus:outline-none focus:ring-1 focus:ring-neon-cyan/50',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-white"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
