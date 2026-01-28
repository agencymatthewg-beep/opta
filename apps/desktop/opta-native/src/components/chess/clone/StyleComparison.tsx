/**
 * StyleComparison - Compare user's play style with famous players.
 *
 * Features:
 * - Radar chart showing style dimensions
 * - Most similar famous player match
 * - Top 3 similar players with similarity %
 * - Style archetype badge
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { motion } from 'framer-motion';
import {
  User,
  Crown,
  Target,
  Sword,
  Shield,
  Brain,
  Clock,
  BookOpen,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PlayStyleMetrics,
  PlayStyleAnalysis,
  FamousPlayerProfile,
  StyleArchetype,
} from '@/lib/chess/style/types';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface StyleComparisonProps {
  /** User's play style analysis */
  analysis: PlayStyleAnalysis | null;
  /** Most similar famous player */
  mostSimilarPlayer: { player: FamousPlayerProfile; similarity: number } | null;
  /** Top similar players */
  topSimilarPlayers: Array<{ player: FamousPlayerProfile; similarity: number }>;
  /** User's archetype */
  archetype: StyleArchetype | null;
  /** Compact mode for widget */
  compact?: boolean;
}

/**
 * Get icon and color for style archetype.
 */
function getArchetypeConfig(archetype: StyleArchetype) {
  const configs: Record<StyleArchetype, { icon: typeof Sword; color: string; label: string }> = {
    attacker: { icon: Sword, color: 'text-danger', label: 'Aggressive Attacker' },
    defender: { icon: Shield, color: 'text-primary', label: 'Solid Defender' },
    tactician: { icon: Target, color: 'text-warning', label: 'Sharp Tactician' },
    positional: { icon: Brain, color: 'text-accent', label: 'Positional Player' },
    universal: { icon: Crown, color: 'text-success', label: 'Universal Player' },
    'endgame-artist': { icon: TrendingUp, color: 'text-primary', label: 'Endgame Artist' },
    theoretician: { icon: BookOpen, color: 'text-muted-foreground', label: 'Opening Theorist' },
    practical: { icon: Clock, color: 'text-warning', label: 'Practical Player' },
  };
  return configs[archetype];
}

/**
 * Radar chart dimension labels and their metric keys.
 */
const RADAR_DIMENSIONS: Array<{
  key: keyof PlayStyleMetrics;
  label: string;
  shortLabel: string;
  angle: number;
}> = [
  { key: 'aggression', label: 'Aggression', shortLabel: 'AGG', angle: 0 },
  { key: 'tactical', label: 'Tactical', shortLabel: 'TAC', angle: 60 },
  { key: 'openingPreparation', label: 'Opening Prep', shortLabel: 'OPN', angle: 120 },
  { key: 'endgame', label: 'Endgame', shortLabel: 'END', angle: 180 },
  { key: 'positional', label: 'Positional', shortLabel: 'POS', angle: 240 },
  { key: 'timePressure', label: 'Time Pressure', shortLabel: 'TIM', angle: 300 },
];

/**
 * Calculate radar chart points from metrics.
 */
function calculateRadarPoints(
  metrics: PlayStyleMetrics,
  centerX: number,
  centerY: number,
  radius: number
): string {
  return RADAR_DIMENSIONS.map(({ key, angle }) => {
    const value = metrics[key] / 100; // Normalize to 0-1
    const rad = ((angle - 90) * Math.PI) / 180; // -90 to start from top
    const x = centerX + radius * value * Math.cos(rad);
    const y = centerY + radius * value * Math.sin(rad);
    return `${x},${y}`;
  }).join(' ');
}

/**
 * RadarChart component for visualizing style metrics.
 */
function RadarChart({
  userMetrics,
  compareMetrics,
  size = 200,
}: {
  userMetrics: PlayStyleMetrics;
  compareMetrics?: PlayStyleMetrics;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;

  // Generate grid circles
  const gridCircles = [0.25, 0.5, 0.75, 1].map((scale) => ({
    r: radius * scale,
    label: `${Math.round(scale * 100)}`,
  }));

  // Calculate axis lines and labels
  const axes = RADAR_DIMENSIONS.map(({ shortLabel, angle }) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    const endX = cx + radius * 1.1 * Math.cos(rad);
    const endY = cy + radius * 1.1 * Math.sin(rad);
    const labelX = cx + radius * 1.25 * Math.cos(rad);
    const labelY = cy + radius * 1.25 * Math.sin(rad);
    return { endX, endY, labelX, labelY, label: shortLabel };
  });

  const userPoints = calculateRadarPoints(userMetrics, cx, cy, radius);
  const comparePoints = compareMetrics
    ? calculateRadarPoints(compareMetrics, cx, cy, radius)
    : null;

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Grid circles */}
      {gridCircles.map(({ r }, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {axes.map(({ endX, endY }, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={endX}
          y2={endY}
          stroke="currentColor"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
      ))}

      {/* Compare metrics polygon (if provided) */}
      {comparePoints && (
        <motion.polygon
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: smoothOut }}
          points={comparePoints}
          fill="hsl(var(--muted-foreground))"
          fillOpacity={0.15}
          stroke="hsl(var(--muted-foreground))"
          strokeOpacity={0.4}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      )}

      {/* User metrics polygon */}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: smoothOut, delay: 0.2 }}
        points={userPoints}
        fill="hsl(var(--primary))"
        fillOpacity={0.2}
        stroke="hsl(var(--primary))"
        strokeOpacity={0.8}
        strokeWidth={2}
      />

      {/* Axis labels */}
      {axes.map(({ labelX, labelY, label }, i) => (
        <text
          key={i}
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[10px] fill-muted-foreground/60 font-medium"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

/**
 * MetricBar component for individual style dimension.
 */
function MetricBar({
  label,
  value,
  compareValue,
  delay = 0,
}: {
  label: string;
  value: number;
  compareValue?: number;
  delay?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground/70">{label}</span>
        <span className="text-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        {compareValue !== undefined && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${compareValue}%` }}
            transition={{ duration: 0.5, ease: smoothOut, delay }}
            className="h-full bg-muted-foreground/30 rounded-full absolute"
          />
        )}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: smoothOut, delay: delay + 0.1 }}
          className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full relative"
        />
      </div>
    </div>
  );
}

/**
 * PlayerCard component for similar player display.
 */
function PlayerCard({
  player,
  similarity,
  isTop = false,
  index = 0,
}: {
  player: FamousPlayerProfile;
  similarity: number;
  isTop?: boolean;
  index?: number;
}) {
  const archetypeConfig = getArchetypeConfig(player.archetype);
  const ArchetypeIcon = archetypeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: smoothOut, delay: index * 0.1 }}
      className={cn(
        'p-3 rounded-lg',
        isTop ? 'glass border border-primary/20' : 'bg-white/[0.03] border border-white/[0.06]'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Similarity badge */}
        <div
          className={cn(
            'flex flex-col items-center justify-center w-12 h-12 rounded-lg',
            isTop ? 'bg-primary/15 border border-primary/30' : 'bg-white/5'
          )}
        >
          <span className={cn('text-lg font-bold', isTop ? 'text-primary' : 'text-foreground')}>
            {similarity}%
          </span>
          {isTop && <Sparkles className="w-3 h-3 text-primary/70" strokeWidth={1.75} />}
        </div>

        {/* Player info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground truncate">{player.name}</span>
            {isTop && <Crown className="w-4 h-4 text-warning" strokeWidth={1.75} />}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{player.era}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <ArchetypeIcon className={cn('w-3.5 h-3.5', archetypeConfig.color)} strokeWidth={1.75} />
            <span className="text-[10px] text-muted-foreground/50">{archetypeConfig.label}</span>
          </div>
        </div>
      </div>

      {/* Signature openings (for top match only) */}
      {isTop && player.signatureOpenings.length > 0 && (
        <div className="mt-3 pt-2 border-t border-white/[0.06]">
          <p className="text-[10px] text-muted-foreground/40 mb-1">Signature openings</p>
          <div className="flex flex-wrap gap-1">
            {player.signatureOpenings.slice(0, 3).map((opening) => (
              <span
                key={opening}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground/70"
              >
                {opening}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * StyleComparison component.
 */
export function StyleComparison({
  analysis,
  mostSimilarPlayer,
  topSimilarPlayers,
  archetype,
  compact = false,
}: StyleComparisonProps) {
  // Get archetype config
  const archetypeConfig = archetype ? getArchetypeConfig(archetype) : null;
  const ArchetypeIcon = archetypeConfig?.icon ?? User;

  if (!analysis) {
    return (
      <div className="glass rounded-xl p-6 border border-white/[0.06] text-center">
        <User className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1.5} />
        <p className="text-muted-foreground/70">No style analysis available</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          Import games to analyze your play style
        </p>
      </div>
    );
  }

  if (compact) {
    // Compact mode for widget
    return (
      <div className="space-y-3">
        {/* Archetype badge */}
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg bg-white/5')}>
            <ArchetypeIcon className={cn('w-4 h-4', archetypeConfig?.color)} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">{archetypeConfig?.label}</p>
            <p className="text-[10px] text-muted-foreground/50">
              {analysis.gamesAnalyzed} games analyzed
            </p>
          </div>
        </div>

        {/* Mini radar */}
        <div className="flex justify-center">
          <RadarChart
            userMetrics={analysis.metrics}
            compareMetrics={mostSimilarPlayer?.player.metrics}
            size={140}
          />
        </div>

        {/* Top match */}
        {mostSimilarPlayer && (
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground/50">You play like</p>
            <p className="text-sm font-medium text-primary">{mostSimilarPlayer.player.name}</p>
            <p className="text-xs text-muted-foreground/60">{mostSimilarPlayer.similarity}% match</p>
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="space-y-6">
      {/* Header with archetype */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: smoothOut }}
        className="flex items-center gap-4"
      >
        <div
          className={cn(
            'flex items-center justify-center w-14 h-14 rounded-xl',
            'bg-white/5 border border-white/[0.08]'
          )}
        >
          <ArchetypeIcon className={cn('w-7 h-7', archetypeConfig?.color)} strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-lg font-medium text-foreground">{archetypeConfig?.label}</h3>
          <p className="text-sm text-muted-foreground/60">
            Based on {analysis.gamesAnalyzed} games · {analysis.confidence} confidence
          </p>
        </div>
      </motion.div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Radar chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: smoothOut, delay: 0.1 }}
          className="glass rounded-xl p-4 border border-white/[0.06]"
        >
          <h4 className="text-sm font-medium text-muted-foreground/70 mb-4">Style Profile</h4>
          <div className="flex justify-center">
            <RadarChart
              userMetrics={analysis.metrics}
              compareMetrics={mostSimilarPlayer?.player.metrics}
              size={220}
            />
          </div>
          <div className="flex justify-center gap-4 mt-4 text-xs text-muted-foreground/50">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-primary rounded-full" />
              You
            </span>
            {mostSimilarPlayer && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-muted-foreground/40 rounded-full border-dashed" />
                {mostSimilarPlayer.player.name}
              </span>
            )}
          </div>
        </motion.div>

        {/* Metric bars */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: smoothOut, delay: 0.2 }}
          className="glass rounded-xl p-4 border border-white/[0.06]"
        >
          <h4 className="text-sm font-medium text-muted-foreground/70 mb-4">Style Dimensions</h4>
          <div className="space-y-4">
            {RADAR_DIMENSIONS.map(({ key, label }, i) => (
              <MetricBar
                key={key}
                label={label}
                value={analysis.metrics[key]}
                compareValue={mostSimilarPlayer?.player.metrics[key]}
                delay={i * 0.05}
              />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Similar players */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: smoothOut, delay: 0.3 }}
        className="glass rounded-xl p-4 border border-white/[0.06]"
      >
        <h4 className="text-sm font-medium text-muted-foreground/70 mb-4">
          Players With Similar Style
        </h4>
        <div className="grid sm:grid-cols-3 gap-3">
          {topSimilarPlayers.map(({ player, similarity }, index) => (
            <PlayerCard
              key={player.name}
              player={player}
              similarity={similarity}
              isTop={index === 0}
              index={index}
            />
          ))}
        </div>
      </motion.div>

      {/* Opening repertoire summary */}
      {(analysis.topOpeningsWhite.length > 0 || analysis.topOpeningsBlack.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: smoothOut, delay: 0.4 }}
          className="glass rounded-xl p-4 border border-white/[0.06]"
        >
          <h4 className="text-sm font-medium text-muted-foreground/70 mb-4">Opening Repertoire</h4>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* White openings */}
            {analysis.topOpeningsWhite.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground/50 mb-2">As White</p>
                <div className="space-y-1.5">
                  {analysis.topOpeningsWhite.slice(0, 3).map((opening) => (
                    <div
                      key={opening.eco}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <span className="text-muted-foreground/70 truncate">{opening.name}</span>
                      <span className="text-muted-foreground/40 ml-2">
                        {opening.winRate}% W ({opening.games})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Black openings */}
            {analysis.topOpeningsBlack.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground/50 mb-2">As Black</p>
                <div className="space-y-1.5">
                  {analysis.topOpeningsBlack.slice(0, 3).map((opening) => (
                    <div
                      key={opening.eco}
                      className="flex items-center justify-between text-xs py-1"
                    >
                      <span className="text-muted-foreground/70 truncate">{opening.name}</span>
                      <span className="text-muted-foreground/40 ml-2">
                        {opening.winRate}% W ({opening.games})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default StyleComparison;
