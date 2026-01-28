import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MotionButton } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScoreDimensions } from './ScoreDimensions';
import { WowFactorsDisplay } from './WowFactorsDisplay';
import { LearnModeExplanation } from './LearnModeExplanation';
import { OptaRing } from './OptaRing';
import type { OptaScore } from '@/types/scoring';
import { Share2, Download } from 'lucide-react';

/**
 * OptaScoreCard - The Living Artifact Score Display
 *
 * Features the OptaRing as the central score display, pulsing with energy
 * based on the optimization state. Uses obsidian glass material with
 * 0%→50% energy transitions.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 * @see DESIGN_SYSTEM.md - Part 7: The Opta Ring
 */

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface OptaScoreCardProps {
  score: OptaScore;
  onShare?: () => void;
  onExport?: () => void;
  showActions?: boolean;
  compact?: boolean;
}

export function OptaScoreCard({
  score,
  onShare: _onShare,
  onExport: _onExport,
  showActions = true,
  compact = false,
}: OptaScoreCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Determine ring state based on score
  const ringState = score.overall >= 80 ? 'active' : 'dormant';

  return (
    <motion.div
      ref={cardRef}
      // Ignition animation - emerges from darkness
      initial={{
        opacity: 0,
        scale: 0.95,
        filter: 'brightness(0.5) blur(4px)',
      }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: 'brightness(1) blur(0px)',
      }}
      transition={{
        duration: 0.7,
        ease: smoothOut,
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        // Obsidian glass material
        'glass-strong',
        'border border-white/[0.08]',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
        'before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent',
        'before:rounded-t-2xl',
        compact ? 'max-w-sm' : 'max-w-2xl'
      )}
      role="region"
      aria-label={`Opta Score: ${score.overall} out of 100`}
      aria-live="polite"
    >
      {/* Hover energy overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        animate={{
          boxShadow: isHovered
            ? 'inset 0 0 0 1px rgba(168, 85, 247, 0.25), 0 0 30px -5px rgba(168, 85, 247, 0.3)'
            : 'inset 0 0 0 1px transparent, 0 0 0px transparent',
        }}
        transition={{ duration: 0.4, ease: smoothOut }}
      />

      {/* Header with OptaRing and score */}
      <div className="relative p-8 text-center border-b border-white/[0.05]">
        {/* Ambient glow behind ring */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(168, 85, 247, 0.15) 0%, transparent 60%)',
          }}
          animate={{
            opacity: ringState === 'active' ? 1 : 0.5,
          }}
          transition={{ duration: 0.5 }}
        />

        <div className="relative">
          {/* OptaRing as the protagonist */}
          <div className="relative inline-flex items-center justify-center mb-4">
            <OptaRing
              state={isHovered ? 'active' : ringState}
              size={compact ? 'lg' : 'xl'}
              breathe={ringState === 'dormant'}
            />

            {/* Score overlay on ring */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: smoothOut }}
            >
              <span
                className={cn(
                  'font-bold bg-gradient-to-br bg-clip-text text-transparent',
                  'from-white via-white to-primary/70',
                  compact ? 'text-3xl' : 'text-4xl'
                )}
              >
                {score.overall}
              </span>
            </motion.div>
          </div>

          {/* Title with moonlight gradient */}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: smoothOut }}
            className="text-xl font-bold bg-gradient-to-br from-white via-white to-primary/50 bg-clip-text text-transparent"
          >
            Opta Score
          </motion.h2>

          {/* Hardware signature */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-sm text-muted-foreground/70 mt-1"
          >
            {score.hardwareTier.signature}
          </motion.p>
        </div>
      </div>

      {/* Dimensions */}
      <div className="p-4">
        <ScoreDimensions dimensions={score.dimensions} compact={compact} />

        {/* Learn Mode Explanation */}
        <LearnModeExplanation
          title="Understanding Your Score"
          description="Your Opta Score reflects your system's optimization level compared to users with similar hardware."
          details="Score is calculated from: Hardware Tier (matched with peers), Performance Efficiency (FPS vs settings), and Optimization Coverage (% of games optimized). Higher is better. Share to compare with friends!"
          type="how-it-works"
        />
      </div>

      {/* Wow Factors (not in compact mode) */}
      {!compact && (
        <div className="px-4 pb-4">
          <WowFactorsDisplay wowFactors={score.wowFactors} animate />

          {/* Learn Mode Explanation for Wow Factors */}
          <LearnModeExplanation
            title="Wow Factors"
            description="Bonus achievements that unlock as you optimize. These represent unique accomplishments like first optimization or reaching milestones."
            type="tip"
          />
        </div>
      )}

      {/* Actions - Obsidian styled buttons */}
      {showActions && (
        <div className="flex gap-3 p-4 border-t border-white/[0.05]">
          <Tooltip>
            <TooltipTrigger asChild>
              <MotionButton
                variant="obsidian"
                onClick={_onShare}
                className="flex-1 gap-2"
              >
                <Share2 className="w-4 h-4" strokeWidth={1.75} />
                Share
              </MotionButton>
            </TooltipTrigger>
            <TooltipContent>Share your score on social media</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <MotionButton
                variant="energy"
                onClick={_onExport}
                className="flex-1 gap-2"
              >
                <Download className="w-4 h-4" strokeWidth={1.75} />
                Export Card
              </MotionButton>
            </TooltipTrigger>
            <TooltipContent>Download score card as image</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Opta branding - Obsidian footer */}
      <div
        className={cn(
          'flex items-center justify-center gap-2 py-3',
          'glass-subtle border-t border-white/[0.03]'
        )}
      >
        <OptaRing state="dormant" size="xs" breathe={false} />
        <span className="text-xs text-muted-foreground/60 font-medium">
          Powered by Opta
        </span>
      </div>
    </motion.div>
  );
}

export default OptaScoreCard;
