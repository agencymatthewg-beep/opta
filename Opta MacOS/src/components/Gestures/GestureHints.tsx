/**
 * GestureHints - Educational tooltip for available gestures
 *
 * Shows users what trackpad gestures are available in Opta.
 * Can be displayed on first use or from settings.
 * Includes a dismiss option that persists to localStorage.
 *
 * @example
 * ```tsx
 * <GestureHints
 *   hints={['pinch', 'swipe']}
 *   onDismiss={() => setShowHints(false)}
 * />
 * ```
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Maximize2, ArrowLeftRight, Hand, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Storage key for dismissed state */
const HINTS_DISMISSED_KEY = 'opta-gesture-hints-dismissed';

/** Available gesture hint types */
export type GestureHintType = 'pinch' | 'swipe' | 'drag';

/** Gesture hint configuration */
const gestureHintConfig: Record<GestureHintType, { icon: LucideIcon; title: string; description: string }> = {
  pinch: {
    icon: Maximize2,
    title: 'Pinch to Zoom',
    description: 'Use two fingers on trackpad to zoom charts',
  },
  swipe: {
    icon: ArrowLeftRight,
    title: 'Swipe to Navigate',
    description: 'Swipe left/right to go back or forward',
  },
  drag: {
    icon: Hand,
    title: 'Drag to Pan',
    description: 'When zoomed in, drag to pan around',
  },
};

export interface GestureHintsProps {
  /** Which hints to show (default: all) */
  hints?: GestureHintType[];
  /** Custom class name */
  className?: string;
  /** Callback when hints are dismissed */
  onDismiss?: () => void;
  /** Show dismiss permanently option (default: true) */
  showDismissPermanently?: boolean;
  /** Force show even if previously dismissed (default: false) */
  forceShow?: boolean;
  /** Position of the hints panel */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
}

/**
 * GestureHints - Displays available trackpad gestures.
 */
export function GestureHints({
  hints = ['pinch', 'swipe', 'drag'],
  className,
  onDismiss,
  showDismissPermanently = true,
  forceShow = false,
  position = 'bottom-right',
}: GestureHintsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedPermanently, setIsDismissedPermanently] = useState(false);

  // Check if hints were previously dismissed
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    const dismissed = localStorage.getItem(HINTS_DISMISSED_KEY);
    if (dismissed === 'true') {
      setIsDismissedPermanently(true);
      setIsVisible(false);
    } else {
      // Show after a brief delay for better UX
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  /**
   * Dismiss hints temporarily.
   */
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  /**
   * Dismiss hints permanently.
   */
  const handleDismissPermanently = useCallback(() => {
    localStorage.setItem(HINTS_DISMISSED_KEY, 'true');
    setIsDismissedPermanently(true);
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  // Position classes
  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-6 right-6',
    'top-left': 'top-6 left-6',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  // Don't render if dismissed permanently and not forced
  if (isDismissedPermanently && !forceShow) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={cn(
            'fixed z-50',
            positionClasses[position],
            'w-72 p-4 rounded-xl',
            // Obsidian glass styling
            'glass-strong',
            'border border-white/10',
            'shadow-[0_0_40px_-10px_rgba(168,85,247,0.3)]',
            className
          )}
          role="tooltip"
          aria-label="Gesture hints"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">Trackpad Gestures</h3>
            <button
              onClick={handleDismiss}
              className={cn(
                'p-1 rounded-md transition-colors',
                'hover:bg-white/10 active:bg-white/20'
              )}
              aria-label="Close hints"
            >
              <X className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            </button>
          </div>

          {/* Hints list */}
          <div className="space-y-3">
            {hints.map((hintType) => {
              const hint = gestureHintConfig[hintType];
              const Icon = hint.icon;

              return (
                <motion.div
                  key={hintType}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: hints.indexOf(hintType) * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className={cn(
                    'p-1.5 rounded-lg shrink-0',
                    'bg-primary/10'
                  )}>
                    <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{hint.title}</p>
                    <p className="text-xs text-muted-foreground">{hint.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Dismiss permanently option */}
          {showDismissPermanently && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={handleDismissPermanently}
              className={cn(
                'mt-4 w-full py-2 rounded-lg text-xs',
                'text-muted-foreground hover:text-foreground',
                'bg-white/5 hover:bg-white/10',
                'transition-colors'
              )}
            >
              Don&apos;t show again
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Reset the gesture hints dismissed state.
 * Useful for settings page or testing.
 */
export function resetGestureHintsDismissed(): void {
  localStorage.removeItem(HINTS_DISMISSED_KEY);
}

export default GestureHints;
