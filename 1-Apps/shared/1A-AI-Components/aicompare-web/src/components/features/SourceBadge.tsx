'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { DataSource } from '@/lib/types';
import { SOURCE_STYLES, formatTimeAgo } from '@/lib/data/constants';

interface SourceBadgeProps {
  source: DataSource;
  size?: 'xs' | 'sm' | 'md';
  showTimestamp?: boolean;
  className?: string;
}

/**
 * Clickable badge showing data source with tooltip
 */
export function SourceBadge({
  source,
  size = 'sm',
  showTimestamp = false,
  className,
}: SourceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const style = SOURCE_STYLES[source.name] || SOURCE_STYLES.manual;
  const timeAgo = formatTimeAgo(source.lastFetched);

  const sizeClasses = {
    xs: 'px-1 py-0.5 text-[8px] gap-0.5',
    sm: 'px-1.5 py-0.5 text-[9px] gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
  };

  return (
    <div className={cn('relative inline-block', className)}>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={cn(
          'inline-flex items-center rounded-full border transition-all duration-200',
          'hover:scale-105 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-opta-bg',
          sizeClasses[size],
          style.bg,
          style.text,
          style.border,
          style.focusRing
        )}
        aria-label={`Source: ${style.label}. Last updated ${timeAgo}. Click to view source.`}
      >
        <span className="font-mono font-bold">{style.abbrev}</span>
        {showTimestamp && (
          <span className="opacity-70 font-normal">{timeAgo}</span>
        )}
      </a>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2',
              'px-3 py-2 rounded-lg',
              'bg-opta-bg/95 backdrop-blur-md border border-glass-border',
              'shadow-xl shadow-purple-glow/10',
              'whitespace-nowrap pointer-events-none'
            )}
          >
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 rotate-45 bg-opta-bg border-r border-b border-glass-border" />
            </div>

            {/* Content */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-white flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full', style.indicator)} />
                {style.label}
              </p>
              <p className="text-[10px] text-text-muted">
                Updated: {new Date(source.lastFetched).toLocaleString('en-AU', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              {source.confidence && (
                <p className="text-[10px] text-text-muted flex items-center gap-1">
                  Confidence:
                  <span className={cn(
                    'font-medium',
                    source.confidence === 'high' && 'text-neon-green',
                    source.confidence === 'medium' && 'text-neon-amber',
                    source.confidence === 'low' && 'text-neon-coral'
                  )}>
                    {source.confidence}
                  </span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Multiple source badges in a row
 */
export function SourceBadgeGroup({
  sources,
  size = 'xs',
  maxVisible = 3,
  className,
}: {
  sources: DataSource[];
  size?: 'xs' | 'sm' | 'md';
  maxVisible?: number;
  className?: string;
}) {
  const visibleSources = sources.slice(0, maxVisible);
  const remainingCount = sources.length - maxVisible;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {visibleSources.map((source, index) => (
        <SourceBadge key={`${source.name}-${index}`} source={source} size={size} />
      ))}
      {remainingCount > 0 && (
        <span className="text-[9px] text-text-muted">+{remainingCount}</span>
      )}
    </div>
  );
}

/**
 * Inline source indicator for benchmark scores
 */
export function InlineSourceBadge({
  source,
  className,
}: {
  source: DataSource;
  className?: string;
}) {
  const style = SOURCE_STYLES[source.name] || SOURCE_STYLES.manual;

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Source: ${style.label} (${formatTimeAgo(source.lastFetched)})`}
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 rounded-sm text-[7px] font-bold',
        'transition-all duration-200 hover:scale-110',
        style.bg,
        style.text,
        className
      )}
    >
      {style.abbrev.charAt(0)}
    </a>
  );
}
