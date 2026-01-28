/**
 * ScoreTimeline - The Obsidian Score Journey
 *
 * Animated timeline with obsidian glass styling and energy chart.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { OptaScoreHistoryEntry } from '@/types/scoring';
import { TrendingUp, Clock } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ScoreTimelineProps {
  history: OptaScoreHistoryEntry[];
  currentScore: number;
  playAnimation?: boolean;  // Trigger time-lapse animation
}

/**
 * ScoreTimeline - Animated timeline showing score progression.
 * Implements the "Time-lapse improvement" visualization from MUST_HAVE.
 */
export function ScoreTimeline({ history, currentScore, playAnimation }: ScoreTimelineProps) {
  const [animationIndex, setAnimationIndex] = useState(playAnimation ? 0 : history.length);
  const [displayScore, setDisplayScore] = useState(history[0]?.score || currentScore);

  useEffect(() => {
    if (!playAnimation || history.length === 0) {
      setAnimationIndex(history.length);
      setDisplayScore(currentScore);
      return;
    }

    // Reset animation when playAnimation becomes true
    setAnimationIndex(0);
    setDisplayScore(history[0]?.score || 0);

    const interval = setInterval(() => {
      setAnimationIndex(prev => {
        if (prev >= history.length) {
          clearInterval(interval);
          return prev;
        }
        setDisplayScore(history[prev]?.score || currentScore);
        return prev + 1;
      });
    }, 150);  // Speed of time-lapse

    return () => clearInterval(interval);
  }, [playAnimation, history, currentScore]);

  // Handle empty history
  if (history.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
        transition={{ ease: smoothOut }}
        className={cn(
          "relative rounded-xl p-4 overflow-hidden",
          // Obsidian glass material
          "glass",
          "border border-white/[0.06]",
          // Inner specular highlight
          "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
          "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold">Score Journey</h3>
        </div>
        <p className="text-sm text-muted-foreground/70 text-center py-8">
          Your score history will appear here as you optimize games.
        </p>
      </motion.div>
    );
  }

  // Calculate chart points
  const maxScore = Math.max(...history.map(h => h.score), currentScore, 100);
  const visibleHistory = history.slice(0, animationIndex);
  const points = visibleHistory.map((entry, i) => ({
    x: history.length > 1 ? (i / (history.length - 1)) * 100 : 50,
    y: 100 - (entry.score / maxScore) * 100
  }));

  // Build path string
  const pathString = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = points.length > 0
    ? `M 0,100 L 0,${points[0]?.y || 100} ${points.map(p => `L ${p.x},${p.y}`).join(' ')} L ${points[points.length - 1]?.x || 0},100 Z`
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
      className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "glass",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={1.75} />
          <h3 className="text-sm font-semibold">Score Journey</h3>
        </div>
        <motion.div
          key={displayScore}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1"
        >
          <TrendingUp className="w-4 h-4 text-success" strokeWidth={1.75} />
          <span className="text-2xl font-bold text-primary">{Math.round(displayScore)}</span>
        </motion.div>
      </div>

      {/* SVG Chart */}
      <div className="h-32 relative">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <g className="text-border/20">
            {[25, 50, 75].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* Area fill */}
          {points.length > 0 && (
            <motion.path
              fill="url(#scoreGradient)"
              d={areaPath}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 0.5 }}
            />
          )}

          {/* Score line */}
          {points.length > 0 && (
            <motion.polyline
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pathString}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.5, ease: 'easeInOut' }}
            />
          )}

          {/* End point indicator */}
          {points.length > 0 && (
            <motion.circle
              cx={points[points.length - 1]?.x || 0}
              cy={points[points.length - 1]?.y || 0}
              r="3"
              fill="hsl(var(--primary))"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1.5 }}
            />
          )}
        </svg>
      </div>

      {/* Timeline markers */}
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>First optimization</span>
        <span>Today</span>
      </div>
    </motion.div>
  );
}

export default ScoreTimeline;
