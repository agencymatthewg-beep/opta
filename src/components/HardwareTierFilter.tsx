/**
 * HardwareTierFilter - The Obsidian Filter Panel
 *
 * Hardware comparison filters with obsidian glass styling and energy selection.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Filter, Cpu, DollarSign, TrendingUp, Globe, LucideIcon } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
      className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={1.75} />
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
                'border transition-all duration-200',
                isActive
                  ? [
                      'bg-primary/10 border-primary/50',
                      'shadow-[inset_0_0_15px_rgba(168,85,247,0.1),0_0_12px_-4px_rgba(168,85,247,0.3)]'
                    ]
                  : [
                      'bg-white/[0.02] border-white/[0.06]',
                      'hover:bg-primary/[0.05] hover:border-primary/20'
                    ]
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
    </motion.div>
  );
}
