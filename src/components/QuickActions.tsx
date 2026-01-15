/**
 * QuickActions component - pre-built quick action buttons for common optimization queries.
 *
 * Provides a grid of buttons that trigger predefined prompts for the AI assistant,
 * making it immediately useful without requiring users to type.
 */

import { cn } from '@/lib/utils';

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

/** Icon components using Lucide-style SVG paths */
const Icons = {
  zap: (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  activity: (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  rocket: (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  cpu: (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  ),
  database: (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5V19A9 3 0 0 0 21 19V5" />
      <path d="M3 12A9 3 0 0 0 21 12" />
    </svg>
  ),
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
 * QuickActions component - Grid of quick action buttons for common optimization queries.
 */
function QuickActions({
  onAction,
  actions = QUICK_ACTIONS,
  className,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className={cn('w-full', className)}>
      <p className="text-xs text-muted-foreground mb-3">Quick actions</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.prompt, action.label)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 px-3 py-2',
              'bg-background/50 hover:bg-muted/80',
              'border border-border hover:border-primary/50',
              'rounded-lg transition-all duration-200',
              'text-sm text-muted-foreground hover:text-foreground',
              'focus:outline-none focus:ring-1 focus:ring-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-background/50 disabled:hover:border-border disabled:hover:text-muted-foreground',
              'hover:glow-sm'
            )}
          >
            <span className="text-primary">{Icons[action.icon]}</span>
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickActions;
