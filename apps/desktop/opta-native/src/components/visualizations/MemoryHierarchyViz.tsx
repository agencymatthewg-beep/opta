/**
 * MemoryHierarchyViz - Visualization of memory hierarchy and why RAM matters.
 *
 * Shows CPU cache, RAM, and disk storage pyramid with speed/size tradeoffs,
 * helping users understand memory optimization benefits.
 * Only renders when Learn Mode is active.
 */

import { motion } from 'framer-motion';

import { useLearnMode } from '@/components/LearnModeContext';
import { cn } from '@/lib/utils';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';

interface MemoryHierarchyVizProps {
  currentRamUsage: number;  // percentage
  recommendedHeadroom: number;  // percentage
}

export function MemoryHierarchyViz({ currentRamUsage, recommendedHeadroom }: MemoryHierarchyVizProps) {
  const { isLearnMode } = useLearnMode();

  if (!isLearnMode) return null;

  const layers = [
    { name: 'CPU Cache', speed: '~100GB/s', size: '64MB', Icon: Cpu, color: 'bg-success' },
    { name: 'RAM', speed: '~50GB/s', size: '16-64GB', Icon: MemoryStick, color: 'bg-primary' },
    { name: 'SSD/HDD', speed: '0.5-5GB/s', size: '500GB+', Icon: HardDrive, color: 'bg-warning' },
  ];

  const isAtRisk = currentRamUsage > recommendedHeadroom;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl p-4 my-4 bg-white/[0.02] border border-white/[0.04]"
    >
      <h4 className="text-sm font-semibold mb-3">Memory Hierarchy</h4>

      {/* Pyramid visualization */}
      <div className="flex flex-col items-center gap-1 mb-4">
        {layers.map((layer, i) => (
          <motion.div
            key={layer.name}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2",
              layer.color,
              "text-white"
            )}
            style={{ width: `${60 + i * 20}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.15 }}
          >
            <layer.Icon className="w-4 h-4" strokeWidth={1.75} />
            <span className="text-xs font-medium">{layer.name}</span>
            <span className="text-xs opacity-75">{layer.speed}</span>
          </motion.div>
        ))}
      </div>

      {/* Current state indicator */}
      <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-card/50">
        <div className={cn(
          "w-2 h-2 rounded-full",
          isAtRisk ? "bg-warning animate-pulse" : "bg-success"
        )} />
        <span className="text-xs">
          {isAtRisk
            ? `RAM at ${currentRamUsage}% - may use slow disk swap`
            : `RAM at ${currentRamUsage}% - good headroom for gaming`
          }
        </span>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Faster memory = faster data access. When RAM fills up, Windows uses your
        SSD/HDD as "virtual memory" which is 10-100x slower, causing stutters.
      </p>
    </motion.div>
  );
}
