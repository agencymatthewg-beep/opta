import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Zap, Timer, Thermometer, Battery } from 'lucide-react';

/**
 * Optimization goal type definition.
 */
export interface OptimizationGoal {
  id: 'max-fps' | 'min-latency' | 'reduce-heat' | 'battery-life';
  label: string;
  description: string;
  icon: typeof Zap;
}

/**
 * Available optimization goals.
 */
const OPTIMIZATION_GOALS: OptimizationGoal[] = [
  {
    id: 'max-fps',
    label: 'Maximize FPS',
    icon: Zap,
    description: 'Get the highest possible frame rate',
  },
  {
    id: 'min-latency',
    label: 'Minimize Input Lag',
    icon: Timer,
    description: 'Reduce delay between input and action',
  },
  {
    id: 'reduce-heat',
    label: 'Reduce Heat',
    icon: Thermometer,
    description: 'Keep your system cooler and quieter',
  },
  {
    id: 'battery-life',
    label: 'Extend Battery',
    icon: Battery,
    description: 'Optimize for longer play sessions',
  },
];

interface GoalSelectorProps {
  onSelect: (goal: OptimizationGoal) => void;
}

/**
 * GoalSelector - First step in the Pinpoint wizard.
 *
 * Displays optimization goals as clickable cards.
 * Each goal has an icon, label, and description.
 */
export function GoalSelector({ onSelect }: GoalSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      <h2 className="text-2xl font-bold mb-2">What do you want to optimize?</h2>
      <p className="text-muted-foreground mb-6">
        Choose your primary optimization goal for this session
      </p>

      <div className="grid grid-cols-2 gap-4">
        {OPTIMIZATION_GOALS.map((goal, index) => {
          const Icon = goal.icon;

          return (
            <motion.button
              key={goal.id}
              onClick={() => onSelect(goal)}
              className={cn(
                'glass rounded-xl p-6 text-left',
                'border border-border/30',
                'group relative overflow-hidden'
              )}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              whileHover={{
                scale: 1.02,
                y: -2,
                boxShadow: '0 0 24px -8px hsl(var(--glow-primary)/0.4)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Icon container */}
              <div
                className={cn(
                  'w-12 h-12 rounded-xl mb-4',
                  'bg-primary/15 border border-primary/30',
                  'flex items-center justify-center',
                  'group-hover:bg-primary/25 transition-colors duration-300'
                )}
              >
                <Icon
                  className="w-6 h-6 text-primary"
                  strokeWidth={1.75}
                />
              </div>

              {/* Label */}
              <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                {goal.label}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                {goal.description}
              </p>

              {/* Hover gradient overlay */}
              <div
                className={cn(
                  'absolute inset-0 opacity-0 group-hover:opacity-100',
                  'bg-gradient-to-br from-primary/5 to-transparent',
                  'transition-opacity duration-300 pointer-events-none'
                )}
              />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

export default GoalSelector;
