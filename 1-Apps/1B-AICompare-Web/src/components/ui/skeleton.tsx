'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/5',
        'relative overflow-hidden',
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_2s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent",
        className
      )}
    />
  );
}

/**
 * Skeleton for ModelCard while loading
 */
export function ModelCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden',
        'bg-glass-bg/50 border border-glass-border',
        'p-4 md:p-6'
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="flex items-start gap-4">
        {/* Rank diamond skeleton */}
        <div className="flex-shrink-0">
          <Skeleton className="w-12 h-12 rotate-45 rounded-sm" />
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              {/* Model name */}
              <Skeleton className="h-6 w-48 max-w-full" />
              {/* Company + update */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {/* Score */}
            <Skeleton className="h-10 w-16 rounded-lg" />
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>

          {/* Source badges */}
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-8 rounded-full" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Multiple skeleton cards for loading state
 */
export function ModelCardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, i) => (
        <ModelCardSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for search results dropdown
 */
export function SearchResultSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-7 h-7 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-4 w-10" />
    </div>
  );
}

/**
 * Skeleton for filter panel
 */
export function FilterPanelSkeleton() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Skeleton className="h-10 flex-1 min-w-[200px] max-w-md rounded-xl" />
      <Skeleton className="h-10 w-28 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
  );
}

/**
 * Skeleton for stats/hero section
 */
export function HeroStatsSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-5 w-8 rounded-full" />
      <Skeleton className="h-5 w-8 rounded-full" />
    </div>
  );
}
