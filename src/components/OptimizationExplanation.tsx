/**
 * OptimizationExplanation - Shows what an optimization does and why.
 *
 * Integrates with the adaptive explanation system to show content
 * appropriate for the user's expertise level:
 * - simple: Plain language, essential info only
 * - standard: Balanced explanations with context
 * - power: Full technical details with expandable advanced section
 *
 * Follows DESIGN_SYSTEM.md:
 * - Glass effects with glass-subtle
 * - Framer Motion animations
 * - Lucide icons only
 * - Purple/violet palette
 */

import { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { useExpertise } from './ExpertiseContext';
import { useExpertiseTracking } from '@/hooks/useExpertise';
import { cn } from '@/lib/utils';
import { getOptimizationExplanation, getAllExplanationLevels } from '@/utils/explanations';
import type { DetectedGame } from '@/types/games';

import { Info, Zap, Monitor, Cpu, HardDrive, Gauge, ChevronDown, ChevronRight } from 'lucide-react';

export interface OptimizationExplanationProps {
  /** Setting key (e.g., "shadow_quality") */
  settingKey: string;
  /** Current value */
  currentValue: string | number;
  /** Recommended value */
  recommendedValue: string | number;
  /** Impact level */
  impact: 'high' | 'medium' | 'low';
  /** Optional game context for personalized messages */
  game?: DetectedGame;
}

// Icon mapping for setting types
const SETTING_ICONS: Record<string, React.ElementType> = {
  shadow_quality: Monitor,
  anti_aliasing: Monitor,
  texture_quality: HardDrive,
  resolution_scale: Monitor,
  resolution_reduction: Monitor,
  vsync: Gauge,
  launch_options: Cpu,
  priority: Cpu,
  fullscreen_mode: Monitor,
  effects_quality: Monitor,
  draw_distance: Monitor,
  ambient_occlusion: Monitor,
};

// Title mapping for setting types
const SETTING_TITLES: Record<string, string> = {
  shadow_quality: 'Shadow Quality',
  anti_aliasing: 'Anti-Aliasing',
  texture_quality: 'Texture Quality',
  resolution_scale: 'Resolution Scale',
  resolution_reduction: 'Resolution',
  vsync: 'V-Sync',
  launch_options: 'Launch Options',
  priority: 'Process Priority',
  fullscreen_mode: 'Fullscreen Mode',
  effects_quality: 'Effects Quality',
  draw_distance: 'Draw Distance',
  ambient_occlusion: 'Ambient Occlusion',
};

const IMPACT_COLORS = {
  high: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30' },
  medium: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30' },
  low: { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border/30' },
};

function OptimizationExplanation({
  settingKey,
  currentValue,
  recommendedValue,
  impact,
  game,
}: OptimizationExplanationProps) {
  const { level } = useExpertise();
  const { trackTechnicalExpand } = useExpertiseTracking();
  const [showTechnical, setShowTechnical] = useState(false);

  // Get adaptive explanation based on expertise level
  const explanation = getOptimizationExplanation(settingKey, game, level);
  const allLevels = getAllExplanationLevels(settingKey, game);

  // Get icon and title for this setting
  const Icon = SETTING_ICONS[settingKey] || Zap;
  const title = SETTING_TITLES[settingKey] || settingKey.replace(/_/g, ' ');
  const impactStyle = IMPACT_COLORS[impact];

  const handleToggleTechnical = () => {
    if (!showTechnical) {
      trackTechnicalExpand();
    }
    setShowTechnical(!showTechnical);
  };

  // Impact description varies by expertise level
  const impactDescription = {
    simple:
      impact === 'high'
        ? 'Big improvement!'
        : impact === 'medium'
          ? 'Good improvement'
          : 'Small improvement',
    standard:
      impact === 'high'
        ? 'High FPS gain expected'
        : impact === 'medium'
          ? 'Moderate performance improvement'
          : 'Minor performance gain',
    power:
      impact === 'high'
        ? 'Significant GPU/CPU load reduction'
        : impact === 'medium'
          ? 'Measurable frame time improvement'
          : 'Marginal performance delta',
  }[level];

  return (
    <motion.div
      className="glass-subtle rounded-xl border border-border/20 overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
            <h4 className="text-sm font-medium text-foreground capitalize">{title}</h4>
          </div>
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
              impactStyle.bg,
              impactStyle.text,
              'border',
              impactStyle.border
            )}
          >
            {impact} impact
          </span>
        </div>

        {/* Value Change */}
        <div className="flex items-center gap-2 text-sm">
          <code className="px-2 py-1 rounded-lg bg-danger/10 text-danger/80 border border-danger/20">
            {String(currentValue)}
          </code>
          <span className="text-muted-foreground/60">-&gt;</span>
          <code className="px-2 py-1 rounded-lg bg-success/10 text-success border border-success/20">
            {String(recommendedValue)}
          </code>
        </div>

        {/* Adaptive Explanation */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground/70 leading-relaxed">{explanation.text}</p>
          </div>
          <div className="flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground/70 leading-relaxed">{impactDescription}</p>
          </div>
        </div>

        {/* Technical Details for Power Users */}
        {level === 'power' && allLevels.technical && (
          <>
            <AnimatePresence initial={false}>
              {showTechnical && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="glass rounded-lg p-3 border border-primary/20">
                    <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                      <span className="text-primary font-semibold">Advanced: </span>
                      {allLevels.technical}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              onClick={handleToggleTechnical}
              className={cn(
                'flex items-center gap-1 text-xs text-primary',
                'hover:underline cursor-pointer',
                'transition-colors duration-150'
              )}
              whileTap={{ scale: 0.98 }}
            >
              {showTechnical ? (
                <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              {showTechnical ? 'Hide' : 'Show'} technical details
            </motion.button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default OptimizationExplanation;
