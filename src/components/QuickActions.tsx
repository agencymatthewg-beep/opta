/**
 * QuickActions - Obsidian Quick Action Grid
 *
 * Pre-built quick action buttons for common optimization queries.
 * Uses obsidian glass material with 0%→50% energy transitions.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Zap, Activity, Rocket, Cpu, Database, type LucideIcon } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Quick action definition */
export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
  icon: 'zap' | 'activity' | 'rocket' | 'cpu' | 'database';
}

/** Default quick actions matching QUICK_PROMPTS from Python backend */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'boost_fps',
    label: 'Boost FPS',
    prompt: 'What are the top 5 things I can do right now to boost my FPS in games?',
    icon: 'zap',
  },
  {
    id: 'reduce_stuttering',
    label: 'Fix Stuttering',
    prompt: 'My games are stuttering. What should I check and how do I fix it?',
    icon: 'activity',
  },
  {
    id: 'startup_cleanup',
    label: 'Faster Startup',
    prompt: 'How can I make my PC start up faster? What programs should I disable?',
    icon: 'rocket',
  },
  {
    id: 'gpu_optimize',
    label: 'GPU Settings',
    prompt: 'What GPU driver settings should I adjust for better gaming performance?',
    icon: 'cpu',
  },
  {
    id: 'memory_management',
    label: 'Free Up RAM',
    prompt: 'How can I free up RAM and reduce memory usage for gaming?',
    icon: 'database',
  },
];

/** Icon mapping using Lucide React components */
const IconComponents: Record<string, LucideIcon> = {
  zap: Zap,
  activity: Activity,
  rocket: Rocket,
  cpu: Cpu,
  database: Database,
};

interface QuickActionsProps {
  /** Callback when a quick action is clicked */
  onAction: (prompt: string, label: string) => void;
  /** Optional custom actions (defaults to QUICK_ACTIONS) */
  actions?: QuickAction[];
  /** Optional additional class name */
  className?: string;
  /** Whether actions are disabled */
  disabled?: boolean;
}

/**
 * QuickActions component - Grid of quick action buttons with obsidian styling.
 */
function QuickActions({
  onAction,
  actions = QUICK_ACTIONS,
  className,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className={cn('w-full', className)} role="group" aria-label="Quick actions">
      <p className="text-xs text-muted-foreground/60 mb-3 uppercase tracking-wider font-medium" id="quick-actions-label">
        Quick actions
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2" aria-labelledby="quick-actions-label">
        {actions.map((action, index) => {
          const Icon = IconComponents[action.icon];
          return (
            <motion.button
              key={action.id}
              onClick={() => onAction(action.prompt, action.label)}
              disabled={disabled}
              aria-label={`${action.label}: ${action.prompt.slice(0, 50)}...`}
              // Ignition animation
              initial={{
                opacity: 0,
                y: 8,
                filter: 'brightness(0.5)',
              }}
              animate={{
                opacity: 1,
                y: 0,
                filter: 'brightness(1)',
              }}
              transition={{
                delay: index * 0.05,
                duration: 0.4,
                ease: smoothOut,
              }}
              // Hover: 0% → 50% energy
              whileHover={{
                y: -2,
                transition: { duration: 0.2, ease: smoothOut },
              }}
              whileTap={{ scale: 0.97 }}
              className={cn(
                'group relative flex items-center gap-2 px-3 py-2.5 rounded-xl',
                // Obsidian glass material
                'bg-[#05030a]/60 backdrop-blur-lg',
                'border border-white/[0.06]',
                // Transition
                'transition-all duration-300',
                // Text
                'text-sm text-muted-foreground',
                // Focus state
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                // Disabled state
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              {/* Hover glow overlay */}
              <motion.div
                className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
                style={{
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                  boxShadow: 'inset 0 0 0 1px rgba(168, 85, 247, 0.2), 0 0 15px -5px rgba(168, 85, 247, 0.25)',
                }}
                transition={{ duration: 0.2 }}
              />

              {/* Icon */}
              <span className="relative text-primary group-hover:drop-shadow-[0_0_6px_rgba(168,85,247,0.5)] transition-all duration-300">
                <Icon className="w-4 h-4" strokeWidth={1.75} />
              </span>

              {/* Label */}
              <span className="relative truncate group-hover:text-foreground transition-colors duration-300">
                {action.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default QuickActions;
