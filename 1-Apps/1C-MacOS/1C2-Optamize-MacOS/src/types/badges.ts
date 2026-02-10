/**
 * Milestone badge types from MUST_HAVE.md
 */

export type BadgeCategory =
  | 'performance'    // FPS gains, optimization wins
  | 'consistency'    // Long-term usage
  | 'ranking'        // Percentile achievements
  | 'exploration';   // Trying features, games

export type BadgeRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  icon: string;           // Lucide icon name
  requirement: string;    // Human-readable requirement
  progress: number;       // 0-100 current progress
  unlockedAt: number | null;  // Timestamp when earned
  isNew: boolean;         // Just unlocked, not yet seen
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  icon: string;
  requirement: string;
  checkProgress: (stats: UserStats) => number;  // Returns 0-100
}

export interface UserStats {
  totalFpsGained: number;
  totalOptimizations: number;
  gamesOptimized: number;
  daysActive: number;
  percentileRank: number;
  streakDays: number;  // Consecutive days optimizing
  hardwareTier: string;
}

// Badge definitions from MUST_HAVE.md
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Performance badges
  {
    id: 'first-10-fps',
    name: 'First Boost',
    description: 'Your first 10 FPS gained across all games',
    category: 'performance',
    rarity: 'common',
    icon: 'Zap',
    requirement: 'Gain 10 total FPS',
    checkProgress: (stats) => Math.min(100, (stats.totalFpsGained / 10) * 100)
  },
  {
    id: 'fps-50',
    name: 'Frame Hunter',
    description: 'Gained 50 FPS total across all games',
    category: 'performance',
    rarity: 'rare',
    icon: 'Flame',
    requirement: 'Gain 50 total FPS',
    checkProgress: (stats) => Math.min(100, (stats.totalFpsGained / 50) * 100)
  },
  {
    id: 'fps-100',
    name: 'Frame Master',
    description: 'Gained 100 FPS total - you are optimized',
    category: 'performance',
    rarity: 'epic',
    icon: 'Crown',
    requirement: 'Gain 100 total FPS',
    checkProgress: (stats) => Math.min(100, (stats.totalFpsGained / 100) * 100)
  },

  // Consistency badges
  {
    id: 'optimized-30-days',
    name: 'Steady State',
    description: 'System optimized for 30 days',
    category: 'consistency',
    rarity: 'rare',
    icon: 'Shield',
    requirement: 'Stay optimized for 30 days',
    checkProgress: (stats) => Math.min(100, (stats.daysActive / 30) * 100)
  },

  // Ranking badges
  {
    id: 'top-50-percent',
    name: 'Above Average',
    description: 'In the top 50% of your hardware tier',
    category: 'ranking',
    rarity: 'common',
    icon: 'TrendingUp',
    requirement: 'Reach top 50% in your tier',
    checkProgress: (stats) => stats.percentileRank >= 50 ? 100 : (stats.percentileRank / 50) * 100
  },
  {
    id: 'top-10-percent',
    name: 'Elite Optimizer',
    description: 'In the top 10% of your hardware tier',
    category: 'ranking',
    rarity: 'epic',
    icon: 'Award',
    requirement: 'Reach top 10% in your tier',
    checkProgress: (stats) => stats.percentileRank >= 90 ? 100 : (stats.percentileRank / 90) * 100
  },
  {
    id: 'top-1-percent',
    name: 'Legendary',
    description: 'In the top 1% globally',
    category: 'ranking',
    rarity: 'legendary',
    icon: 'Star',
    requirement: 'Reach top 1% globally',
    checkProgress: (stats) => stats.percentileRank >= 99 ? 100 : (stats.percentileRank / 99) * 100
  },

  // Exploration badges
  {
    id: 'games-5',
    name: 'Game Explorer',
    description: 'Optimized 5 different games',
    category: 'exploration',
    rarity: 'common',
    icon: 'Gamepad2',
    requirement: 'Optimize 5 games',
    checkProgress: (stats) => Math.min(100, (stats.gamesOptimized / 5) * 100)
  },
  {
    id: 'games-10',
    name: 'Library Master',
    description: 'Optimized 10 different games',
    category: 'exploration',
    rarity: 'rare',
    icon: 'Library',
    requirement: 'Optimize 10 games',
    checkProgress: (stats) => Math.min(100, (stats.gamesOptimized / 10) * 100)
  }
];

export interface BadgeResponse {
  badges: Badge[];
  newUnlocks: string[];  // Badge IDs just unlocked
  stats: UserStats;
}
