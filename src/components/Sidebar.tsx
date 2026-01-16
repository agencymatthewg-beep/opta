import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useConflicts } from '../hooks/useConflicts';
import { useOptaRing } from '@/contexts/OptaRingContext';
import PlatformIndicator from './PlatformIndicator';
import { OptaRing } from './OptaRing';
import {
  LayoutDashboard,
  Gamepad2,
  Zap,
  Award,
  Settings,
  Target,
} from 'lucide-react';

/**
 * Sidebar - The Obsidian Navigation Spine
 *
 * Features the mini OptaRing as the brand protagonist.
 * Built with obsidian glass material that awakens on interaction.
 *
 * Key behaviors:
 * - Ring breathes gently in idle, ignites on hover
 * - Navigation items use 0%→50% energy on active/hover
 * - Synchronized with global fog context for transitions
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'games',
    label: 'Games',
    icon: Gamepad2,
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: Zap,
  },
  {
    id: 'pinpoint',
    label: 'Pinpoint',
    icon: Target,
  },
  {
    id: 'score',
    label: 'Score',
    icon: Award,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
];

// Easing curve for smooth transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { summary } = useConflicts();
  const ringContext = useOptaRing();

  const hasConflicts = summary && summary.total_count > 0;
  const highSeverityConflicts = summary && summary.high_count > 0;

  return (
    <motion.aside
      className={cn(
        'w-64 min-w-64 h-screen flex flex-col',
        // Obsidian glass material
        'bg-[#05030a]/90 backdrop-blur-2xl',
        'border-r border-white/[0.05]',
        // Inner specular highlight
        'shadow-[inset_1px_0_0_0_rgba(255,255,255,0.03)]'
      )}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: smoothOut }}
    >
      {/* Brand Header - OptaRing as Protagonist */}
      <motion.div
        className="px-6 py-8"
        initial={{ opacity: 0, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, filter: 'brightness(1)' }}
        transition={{ delay: 0.2, duration: 0.5, ease: smoothOut }}
      >
        <div className="flex items-center gap-4">
          {/* Mini OptaRing - The Protagonist */}
          <motion.div
            className="relative"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onHoverStart={() => ringContext.ignite()}
            onHoverEnd={() => ringContext.sleep()}
          >
            <OptaRing
              state={ringContext.state}
              size="sm"
              breathe={true}
            />
          </motion.div>

          {/* Brand Text */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="bg-gradient-to-br from-white via-white to-primary/50 bg-clip-text text-transparent">
                Opta
              </span>
            </h1>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em] font-medium">
              Optimizer
            </p>
          </div>
        </div>
      </motion.div>

      {/* Energy Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* Navigation - Obsidian Items */}
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20, filter: 'brightness(0.5)' }}
              animate={{ opacity: 1, x: 0, filter: 'brightness(1)' }}
              transition={{
                delay: 0.3 + index * 0.05,
                duration: 0.4,
                ease: smoothOut,
              }}
            >
              <motion.button
                className={cn(
                  'w-full flex items-center gap-3 h-12 px-4 rounded-xl',
                  'text-sm font-medium relative',
                  'transition-all duration-300',
                  // Base obsidian state
                  'bg-transparent',
                  'border border-transparent',
                  // Active state - 50% energy
                  isActive && [
                    'bg-primary/10',
                    'border-primary/30',
                    'text-primary',
                    'shadow-[inset_0_0_20px_rgba(168,85,247,0.1),0_0_15px_-5px_rgba(168,85,247,0.25)]',
                  ],
                  // Inactive state
                  !isActive && 'text-muted-foreground'
                )}
                onClick={() => onNavigate(item.id)}
                whileHover={{
                  backgroundColor: isActive
                    ? 'rgba(168, 85, 247, 0.15)'
                    : 'rgba(255, 255, 255, 0.03)',
                  borderColor: isActive
                    ? 'rgba(168, 85, 247, 0.4)'
                    : 'rgba(255, 255, 255, 0.08)',
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Active Energy Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="sidebarActiveIndicator"
                    className={cn(
                      'absolute left-0 top-1/2 -translate-y-1/2',
                      'w-1 h-8 rounded-r-full',
                      'bg-primary',
                      'shadow-[0_0_12px_2px_rgba(168,85,247,0.5)]'
                    )}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Icon with energy glow when active */}
                <motion.span
                  className="relative"
                  animate={
                    isActive
                      ? {
                          filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))',
                        }
                      : { filter: 'none' }
                  }
                  transition={{ duration: 0.3 }}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-colors duration-300',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                    strokeWidth={1.75}
                  />
                </motion.span>

                {/* Label */}
                <span
                  className={cn(
                    'transition-colors duration-300',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>

                {/* Conflict Indicator - Pulses with energy */}
                {item.id === 'settings' && hasConflicts && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'absolute right-4 w-2.5 h-2.5 rounded-full',
                      highSeverityConflicts
                        ? 'bg-danger shadow-[0_0_10px_2px_rgba(239,68,68,0.5)]'
                        : 'bg-warning shadow-[0_0_10px_2px_rgba(234,179,8,0.4)]'
                    )}
                    style={{
                      animation: highSeverityConflicts
                        ? 'pulse 2s ease-in-out infinite'
                        : undefined,
                    }}
                    title={`${summary?.total_count} conflict${summary?.total_count !== 1 ? 's' : ''} detected`}
                  />
                )}
              </motion.button>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer - Obsidian Glass */}
      <motion.div
        className="p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        {/* Energy Divider */}
        <div className="mb-4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

        {/* Quick Tip - Obsidian Card */}
        <motion.div
          className={cn(
            'rounded-xl p-3 mb-4',
            'bg-[#05030a]/60 backdrop-blur-lg',
            'border border-white/[0.05]',
            'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]'
          )}
          whileHover={{
            borderColor: 'rgba(168, 85, 247, 0.15)',
            boxShadow:
              'inset 0 0 15px rgba(168, 85, 247, 0.05), 0 0 10px -5px rgba(168, 85, 247, 0.15)',
          }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
            Press{' '}
            <kbd
              className={cn(
                'px-1.5 py-0.5 rounded-md',
                'bg-primary/15 text-primary/90',
                'text-[10px] font-semibold',
                'border border-primary/20'
              )}
            >
              O
            </kbd>{' '}
            to expand details throughout the app
          </p>
        </motion.div>

        {/* Platform Indicator */}
        <div className="mb-4">
          <PlatformIndicator />
        </div>

        {/* Version Info */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground/40 font-medium">
            v0.1.0
          </span>
          <span className="text-[10px] text-primary/40 font-medium">
            Phase 5.1
          </span>
        </div>
      </motion.div>
    </motion.aside>
  );
}

export default Sidebar;
