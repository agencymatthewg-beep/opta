import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  Settings,
  LayoutDashboard,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRadialNav } from '@/contexts/RadialNavContext';
import { useLearnMode } from '@/components/LearnModeContext';

/**
 * UtilityIsland - Quick access modal for frequently used utilities
 *
 * Triggered by pressing 'O' key (when not in input) or clicking Opta text.
 * Provides access to:
 * - Learn Mode toggle
 * - Settings quick navigation
 * - Dashboard quick navigation
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

// Animation variants
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const islandVariants = {
  hidden: {
    scale: 0.9,
    opacity: 0,
    y: 20,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 30,
    },
  },
  exit: {
    scale: 0.95,
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

const buttonVariants = {
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

export function UtilityIsland() {
  const { isUtilityIslandOpen, closeUtilityIsland, navigateTo } = useRadialNav();
  const { isLearnMode, toggleLearnMode } = useLearnMode();

  // Handle escape key to close
  useEffect(() => {
    if (!isUtilityIslandOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeUtilityIsland();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUtilityIslandOpen, closeUtilityIsland]);

  return (
    <AnimatePresence>
      {isUtilityIslandOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 glass-subtle"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeUtilityIsland}
          />

          {/* Island */}
          <motion.div
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
              'obsidian-strong rounded-2xl p-6 min-w-[300px]',
              'shadow-[0_0_60px_-10px_rgba(168,85,247,0.4)]',
              // Inner specular highlight
              'before:absolute before:inset-x-0 before:top-0 before:h-px',
              'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
              'before:rounded-t-2xl'
            )}
            variants={islandVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Quick access utilities"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <span className="text-sm text-muted-foreground">
                Press{' '}
                <kbd className="px-2 py-1 bg-primary/20 rounded-md text-primary text-xs font-semibold border border-primary/30">
                  O
                </kbd>
                {' '}or click Opta
              </span>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {/* Learn Mode Toggle */}
              <motion.button
                onClick={toggleLearnMode}
                className={cn(
                  'w-full flex items-center justify-between gap-3 p-4 rounded-xl',
                  'obsidian-interactive',
                  'text-left'
                )}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-primary" strokeWidth={1.75} />
                  <span className="font-medium">Learn Mode</span>
                </div>
                <div
                  className={cn(
                    'px-2 py-1 rounded-md text-xs font-semibold',
                    isLearnMode
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isLearnMode ? 'ON' : 'OFF'}
                </div>
              </motion.button>

              {/* Quick Settings */}
              <motion.button
                onClick={() => {
                  navigateTo('settings');
                  closeUtilityIsland();
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 p-4 rounded-xl',
                  'obsidian-interactive',
                  'text-left'
                )}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
                  <span className="font-medium">Settings</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </motion.button>

              {/* Quick Dashboard */}
              <motion.button
                onClick={() => {
                  navigateTo('dashboard');
                  closeUtilityIsland();
                }}
                className={cn(
                  'w-full flex items-center justify-between gap-3 p-4 rounded-xl',
                  'obsidian-interactive',
                  'text-left'
                )}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-5 h-5 text-warning" strokeWidth={1.75} />
                  <span className="font-medium">Dashboard</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * useRadialNavKeyboard - Global keyboard shortcuts for radial navigation
 *
 * Handles:
 * - 'O' key: Toggle utility island (unless in input field)
 * - Escape: Close utility island
 * - Number keys 1-6: Quick navigation to pages (when radial is expanded)
 *
 * Should be used in Layout or App component to enable global shortcuts.
 */
export function useRadialNavKeyboard() {
  const {
    toggleUtilityIsland,
    closeUtilityIsland,
    isUtilityIslandOpen,
    navigateTo,
    mode,
    expand,
  } = useRadialNav();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // 'O' key toggles utility island
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        toggleUtilityIsland();
        return;
      }

      // Escape closes utility island
      if (e.key === 'Escape') {
        if (isUtilityIslandOpen) {
          closeUtilityIsland();
        }
        return;
      }

      // Number keys 1-7 for quick navigation (when radial is visible)
      if (/^[1-7]$/.test(e.key) && mode === 'expanded') {
        const navItems = [
          'dashboard',
          'games',
          'chess',
          'optimize',
          'pinpoint',
          'score',
          'settings',
        ];
        const index = parseInt(e.key) - 1;
        navigateTo(navItems[index]);
        return;
      }

      // If in halo mode and any number key pressed, expand first
      if (/^[1-7]$/.test(e.key) && mode === 'halo') {
        expand();
        // Navigate after a short delay for visual feedback
        setTimeout(() => {
          const navItems = [
            'dashboard',
            'games',
            'chess',
            'optimize',
            'pinpoint',
            'score',
            'settings',
          ];
          const index = parseInt(e.key) - 1;
          navigateTo(navItems[index]);
        }, 150);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    toggleUtilityIsland,
    closeUtilityIsland,
    isUtilityIslandOpen,
    navigateTo,
    mode,
    expand,
  ]);
}

export default UtilityIsland;
