/**
 * SwipeIndicator - Visual feedback for swipe navigation
 *
 * Shows edge indicators when swiping with Magic Mouse to go back/forward.
 * Follows Opta's Obsidian design system with glass styling and glow effects.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SwipeDirection } from '@/hooks/useSwipeNavigation';

interface SwipeIndicatorProps {
  /** Swipe progress from -1 (right/back) to 1 (left/forward) */
  progress: number;
  /** Current swipe direction */
  direction: SwipeDirection;
  /** Whether back navigation is available */
  canGoBack: boolean;
  /** Whether forward navigation is available */
  canGoForward: boolean;
}

/**
 * SwipeIndicator component showing edge arrows during swipe gestures.
 */
export function SwipeIndicator({
  progress,
  direction,
  canGoBack,
  canGoForward,
}: SwipeIndicatorProps) {
  // Only show when actively swiping
  const isActive = Math.abs(progress) > 0.05;
  const isNearThreshold = Math.abs(progress) > 0.7;

  // Determine which side to show
  const showLeft = direction === 'right' && canGoBack;
  const showRight = direction === 'left' && canGoForward;

  // Calculate opacity and scale based on progress
  const absProgress = Math.abs(progress);
  const opacity = Math.min(1, absProgress * 2);
  const scale = 0.8 + absProgress * 0.4;

  return (
    <AnimatePresence>
      {/* Left edge indicator (swipe right = go back) */}
      {isActive && showLeft && (
        <motion.div
          key="left-indicator"
          className={cn(
            'fixed left-0 top-1/2 -translate-y-1/2 z-50',
            'pointer-events-none'
          )}
          initial={{ x: -60, opacity: 0 }}
          animate={{
            x: Math.min(20, absProgress * 40),
            opacity,
            scale,
          }}
          exit={{ x: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div
            className={cn(
              'flex items-center justify-center',
              'w-12 h-12 rounded-full',
              // Obsidian glass material
              'bg-[#05030a]/90 backdrop-blur-xl',
              'border border-white/[0.1]',
              // Glow effect when near threshold
              isNearThreshold && [
                'border-primary/40',
                'shadow-[0_0_20px_-4px_rgba(168,85,247,0.6)]',
              ]
            )}
          >
            <motion.div
              animate={{
                x: isNearThreshold ? [-2, 2, -2] : 0,
              }}
              transition={{
                duration: 0.3,
                repeat: isNearThreshold ? Infinity : 0,
              }}
            >
              <ChevronLeft
                className={cn(
                  'w-6 h-6 transition-colors duration-200',
                  isNearThreshold ? 'text-primary' : 'text-muted-foreground'
                )}
                strokeWidth={2}
              />
            </motion.div>
          </div>
          {/* Label */}
          <motion.span
            className={cn(
              'absolute left-14 top-1/2 -translate-y-1/2',
              'text-xs font-medium whitespace-nowrap',
              'px-2 py-1 rounded-md',
              'bg-[#05030a]/80 backdrop-blur-lg',
              'border border-white/[0.06]',
              isNearThreshold ? 'text-primary' : 'text-muted-foreground'
            )}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isNearThreshold ? 1 : 0.7, x: 0 }}
          >
            Back
          </motion.span>
        </motion.div>
      )}

      {/* Right edge indicator (swipe left = go forward) */}
      {isActive && showRight && (
        <motion.div
          key="right-indicator"
          className={cn(
            'fixed right-0 top-1/2 -translate-y-1/2 z-50',
            'pointer-events-none'
          )}
          initial={{ x: 60, opacity: 0 }}
          animate={{
            x: -Math.min(20, absProgress * 40),
            opacity,
            scale,
          }}
          exit={{ x: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div
            className={cn(
              'flex items-center justify-center',
              'w-12 h-12 rounded-full',
              // Obsidian glass material
              'bg-[#05030a]/90 backdrop-blur-xl',
              'border border-white/[0.1]',
              // Glow effect when near threshold
              isNearThreshold && [
                'border-primary/40',
                'shadow-[0_0_20px_-4px_rgba(168,85,247,0.6)]',
              ]
            )}
          >
            <motion.div
              animate={{
                x: isNearThreshold ? [2, -2, 2] : 0,
              }}
              transition={{
                duration: 0.3,
                repeat: isNearThreshold ? Infinity : 0,
              }}
            >
              <ChevronRight
                className={cn(
                  'w-6 h-6 transition-colors duration-200',
                  isNearThreshold ? 'text-primary' : 'text-muted-foreground'
                )}
                strokeWidth={2}
              />
            </motion.div>
          </div>
          {/* Label */}
          <motion.span
            className={cn(
              'absolute right-14 top-1/2 -translate-y-1/2',
              'text-xs font-medium whitespace-nowrap',
              'px-2 py-1 rounded-md',
              'bg-[#05030a]/80 backdrop-blur-lg',
              'border border-white/[0.06]',
              isNearThreshold ? 'text-primary' : 'text-muted-foreground'
            )}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: isNearThreshold ? 1 : 0.7, x: 0 }}
          >
            Forward
          </motion.span>
        </motion.div>
      )}

      {/* Edge glow effect */}
      {isActive && (showLeft || showRight) && (
        <motion.div
          key="edge-glow"
          className={cn(
            'fixed top-0 bottom-0 w-32 z-40',
            'pointer-events-none',
            showLeft ? 'left-0' : 'right-0'
          )}
          style={{
            background: showLeft
              ? 'linear-gradient(to right, rgba(168, 85, 247, 0.1), transparent)'
              : 'linear-gradient(to left, rgba(168, 85, 247, 0.1), transparent)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isNearThreshold ? 0.8 : absProgress * 0.5 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </AnimatePresence>
  );
}

export default SwipeIndicator;
