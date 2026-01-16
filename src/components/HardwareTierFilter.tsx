import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Filter, Cpu, DollarSign, TrendingUp, Globe, LucideIcon } from 'lucide-react';

export type FilterMode = 'similar' | 'price' | 'performance' | 'global';

interface HardwareTierFilterProps {
  currentFilter: FilterMode;
  onFilterChange: (filter: FilterMode) => void;
  hardwareTier?: string;  // User's detected tier for display
}

const filterOptions: Array<{
  value: FilterMode;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: 'similar',
    label: 'Similar Hardware',
    description: 'RTX 4070 + Ryzen 7 tier',
    icon: Cpu
  },
  {
    value: 'price',
    label: 'Price Tier',
    description: 'Mid-range ($800-1200)',
    icon: DollarSign
  },
  {
    value: 'performance',
    label: 'Performance Tier',
    description: 'Based on benchmark scores',
    icon: TrendingUp
  },
  {
    value: 'global',
    label: 'Global',
    description: 'All Opta users',
    icon: Globe
  }
];

export function HardwareTierFilter({
  currentFilter,
  onFilterChange,
  hardwareTier
}: HardwareTierFilterProps) {
  return (
    <div className="glass rounded-xl p-4 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-primary" strokeWidth={1.75} />
        <span className="text-sm font-medium">Compare Against</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filterOptions.map((option) => {
          const Icon = option.icon;
          const isActive = currentFilter === option.value;

          return (
            <motion.button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                'p-3 rounded-lg text-left',
                'border',
                isActive
                  ? 'glass border-primary/50 shadow-[0_0_12px_-4px_hsl(var(--glow-primary)/0.3)]'
                  : 'glass-subtle border-border/20 hover:border-border/40'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn(
                  'w-4 h-4',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )} strokeWidth={1.75} />
                <span className={cn(
                  'text-sm font-medium',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/70">
                {option.value === 'similar' && hardwareTier
                  ? hardwareTier
                  : option.description}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
