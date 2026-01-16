import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { HardwareTierFilter, FilterMode } from './HardwareTierFilter';
import type { LeaderboardEntry, HardwareTier } from '@/types/scoring';
import { Trophy, Medal, Award, User } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  userRank?: number;
  userScore?: number;
  hardwareTier?: HardwareTier;
  loading?: boolean;
  onFilterChange?: (filter: FilterMode) => void;
}

export function Leaderboard({
  entries,
  userRank,
  userScore,
  hardwareTier,
  loading,
  onFilterChange
}: LeaderboardProps) {
  const [filter, setFilter] = useState<FilterMode>('similar');

  const handleFilterChange = (newFilter: FilterMode) => {
    setFilter(newFilter);
    onFilterChange?.(newFilter);
  };

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Filter */}
      <HardwareTierFilter
        currentFilter={filter}
        onFilterChange={handleFilterChange}
        hardwareTier={hardwareTier?.signature}
      />

      {/* User's position highlight */}
      {userRank && userScore && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-xl p-4 border-2 border-primary/50"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full glass flex items-center justify-center">
                <User className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-medium">Your Position</p>
                <p className="text-xs text-muted-foreground">
                  Top {100 - Math.min(99, Math.round((userRank / Math.max(entries.length, 1)) * 100))}%
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">#{userRank}</p>
              <p className="text-sm text-muted-foreground">{userScore} pts</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Leaderboard list */}
      <div className="glass rounded-xl border border-border/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20">
          <h3 className="text-sm font-semibold">Leaderboard</h3>
        </div>

        <div className="divide-y divide-border/10">
          <AnimatePresence mode="popLayout">
            {entries.slice(0, 10).map((entry, index) => (
              <LeaderboardRow
                key={entry.game_id}
                entry={entry}
                rank={index + 1}
                isUser={entry.rank === userRank}
              />
            ))}
          </AnimatePresence>
        </div>

        {entries.length === 0 && (
          <div className="py-12 text-center">
            <Trophy className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              No scores yet in this tier
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function LeaderboardRow({
  entry,
  rank,
  isUser
}: {
  entry: LeaderboardEntry;
  rank: number;
  isUser: boolean;
}) {
  const RankIcon = rank === 1 ? Trophy : rank <= 3 ? Medal : Award;
  const rankColor = rank === 1 ? 'text-warning' : rank <= 3 ? 'text-muted-foreground' : 'text-muted-foreground/50';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3',
        isUser && 'bg-primary/10'
      )}
    >
      {/* Rank */}
      <div className={cn('w-8 text-center font-bold', rankColor)}>
        {rank <= 3 ? (
          <RankIcon className="w-5 h-5 mx-auto" strokeWidth={1.75} />
        ) : (
          <span>{rank}</span>
        )}
      </div>

      {/* Game/User info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-medium truncate',
          isUser && 'text-primary'
        )}>
          {entry.game_name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {entry.game_id}
        </p>
      </div>

      {/* Score */}
      <div className="text-right">
        <motion.p
          className="text-lg font-bold"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
        >
          {entry.score}
        </motion.p>
      </div>
    </motion.div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 rounded-xl bg-muted/30 animate-shimmer" />
      <div className="glass rounded-xl border border-border/30 divide-y divide-border/10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded bg-muted/30 animate-shimmer" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 rounded bg-muted/30 animate-shimmer" />
              <div className="h-3 w-24 rounded bg-muted/30 animate-shimmer" />
            </div>
            <div className="h-6 w-12 rounded bg-muted/30 animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
