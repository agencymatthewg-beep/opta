'use client';

import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Guide } from '@/content/guides';
import { createSearchIndex, searchGuides } from '@/lib/search';
import { GuideCard } from './GuideCard';

interface SearchBarProps {
  guides: Guide[];
}

export function SearchBar({ guides }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Guide[]>([]);

  const fuse = useMemo(() => createSearchIndex(guides), [guides]);

  useEffect(() => {
    setResults(searchGuides(fuse, query));
  }, [fuse, query]);

  return (
    <div className="w-full max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search guides, features, apps..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full glass rounded-2xl pl-12 pr-12 py-4 text-base font-sora text-text-primary placeholder:text-text-muted border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all duration-300 bg-[rgba(12,12,18,0.8)] backdrop-blur-xl"
          aria-label="Search guides"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {query.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-3 space-y-2"
        >
          {results.length === 0 ? (
            <div className="obsidian rounded-xl border border-white/5 px-5 py-4">
              <p className="text-sm text-text-secondary">No guides found for '{query}'</p>
            </div>
          ) : (
            results.map((guide) => <GuideCard key={guide.slug} guide={guide} compact />)
          )}
        </motion.div>
      )}

      {!query && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-8 space-y-2"
        >
          <p className="mb-4 text-xs font-mono text-text-muted">All guides</p>
          {guides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} compact />
          ))}
        </motion.div>
      )}
    </div>
  );
}
