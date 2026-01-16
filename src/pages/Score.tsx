import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { OptaScoreCard } from '@/components/OptaScoreCard';
import { ScoreTimeline } from '@/components/ScoreTimeline';
import { Leaderboard } from '@/components/Leaderboard';
import { MilestoneBadges } from '@/components/MilestoneBadges';
import { LearnModeExplanation } from '@/components/LearnModeExplanation';
import { ShareModal } from '@/components/ShareModal';
import { ShareCard } from '@/components/ShareCard';
import { useScore } from '@/hooks/useScore';
import { saveAsImage } from '@/lib/shareUtils';
import type { FilterMode } from '@/components/HardwareTierFilter';
import { Award, RefreshCw, Play } from 'lucide-react';

/**
 * Score page - Full score breakdown with timeline and sharing.
 */
export function Score() {
  const { optaScore, leaderboard, loading, error, refreshScore } = useScore();
  const [playTimelapse, setPlayTimelapse] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const handleFilterChange = (filter: FilterMode) => {
    // TODO: Implement filtering by tier - for v1 just logs
    console.log('Filter changed to:', filter);
  };

  const handleShare = async () => {
    setIsShareModalOpen(true);
  };

  const handleExport = async () => {
    if (!shareCardRef.current || !optaScore) return;
    await saveAsImage(shareCardRef.current, optaScore);
  };

  const handlePlayTimelapse = () => {
    setPlayTimelapse(true);
    setTimeout(() => setPlayTimelapse(false), 5000);
  };

  if (loading) {
    return <ScoreLoadingSkeleton />;
  }

  if (error || !optaScore) {
    return <ScoreEmptyState onRefresh={refreshScore} />;
  }

  return (
    <div className="page max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
          <Award className="w-6 h-6 text-primary" strokeWidth={1.75} />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Your Opta Score
          </h1>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayTimelapse}
            className="gap-2 glass-subtle rounded-xl border-border/30"
          >
            <Play className="w-4 h-4" strokeWidth={1.75} />
            Replay Journey
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshScore}
            className="gap-2 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Main score card */}
      <div className="mb-6">
        <OptaScoreCard
          score={optaScore}
          onShare={handleShare}
          onExport={handleExport}
        />
      </div>

      {/* Timeline */}
      <div className="mb-6">
        <ScoreTimeline
          history={optaScore.history}
          currentScore={optaScore.overall}
          playAnimation={playTimelapse}
        />

        {/* Learn Mode Explanation for Timeline */}
        <LearnModeExplanation
          title="Score Timeline"
          description="Track your optimization journey over time. Each point represents a snapshot after you applied optimizations."
          details="Hit 'Replay Journey' to watch your progress animate. Score changes come from optimizing games, adjusting settings, and earning achievements."
          type="info"
          className="mt-4"
        />
      </div>

      {/* Stats summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-3 gap-4 mb-6"
      >
        <StatCard
          label="Games Optimized"
          value={optaScore.gamesOptimized}
        />
        <StatCard
          label="Last Updated"
          value={formatDate(optaScore.lastCalculated)}
        />
        <StatCard
          label="Hardware Tier"
          value={optaScore.hardwareTier.tier}
        />
      </motion.div>

      {/* Leaderboard and Milestones - two column layout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Leaderboard */}
        <div>
          <Leaderboard
            entries={leaderboard}
            userRank={leaderboard.findIndex(e => e.score === optaScore.overall) + 1 || undefined}
            userScore={optaScore.overall}
            hardwareTier={optaScore.hardwareTier}
            onFilterChange={handleFilterChange}
          />

          {/* Learn Mode Explanation for Leaderboard */}
          <LearnModeExplanation
            title="Fair Comparison"
            description="The leaderboard groups users by hardware tier so you compete with similar systems. Filter to see global or tier-specific rankings."
            type="tip"
            className="mt-2"
          />
        </div>

        {/* Milestones */}
        <div>
          <MilestoneBadges />

          {/* Learn Mode Explanation for Milestones */}
          <LearnModeExplanation
            title="Milestone Badges"
            description="Unlock badges as you reach optimization milestones. Each badge represents a significant achievement on your journey."
            type="tip"
            className="mt-2"
          />
        </div>
      </motion.div>

      {/* Share Modal */}
      <ShareModal
        score={optaScore}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Hidden ShareCard for export */}
      <div className="fixed -left-[9999px] -top-[9999px]">
        <ShareCard ref={shareCardRef} score={optaScore} />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <motion.div
      className="glass rounded-xl p-4 border border-border/30 text-center"
      whileHover={{ y: -2 }}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold capitalize">{value}</p>
    </motion.div>
  );
}

function ScoreLoadingSkeleton() {
  return (
    <div className="page max-w-4xl mx-auto">
      <div className="h-8 w-48 rounded-lg bg-muted/30 animate-shimmer mb-6" />
      <div className="h-96 rounded-2xl bg-muted/30 animate-shimmer mb-6" />
      <div className="h-32 rounded-xl bg-muted/30 animate-shimmer" />
    </div>
  );
}

interface ScoreEmptyStateProps {
  onRefresh: () => void;
}

function ScoreEmptyState({ onRefresh }: ScoreEmptyStateProps) {
  return (
    <div className="page max-w-4xl mx-auto">
      <motion.div
        className="flex flex-col items-center justify-center py-24 text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-20 h-20 flex items-center justify-center rounded-full glass border border-border/30 mb-6"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Award className="w-10 h-10 text-muted-foreground/40" strokeWidth={1.5} />
        </motion.div>
        <h2 className="text-xl font-medium mb-2">No Score Yet</h2>
        <p className="text-sm text-muted-foreground/70 max-w-sm mb-6">
          Optimize your first game to see your Opta Score and track your progress.
        </p>
        <Button onClick={onRefresh} className="gap-2 rounded-xl">
          <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
          Check Again
        </Button>
      </motion.div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleDateString();
}

export default Score;
