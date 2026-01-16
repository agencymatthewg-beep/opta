/**
 * ProcessList component for displaying running processes.
 *
 * Shows a scrollable table of processes with resource usage and categorization.
 * Supports click-to-select for future Stealth Mode integration.
 */

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProcesses } from '../hooks/useProcesses';
import type { ProcessInfo, ProcessCategory } from '../types/processes';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Activity, AlertCircle, RefreshCw, Shield, User, Skull } from 'lucide-react';
import { LearnModeExplanation } from './LearnModeExplanation';

interface ProcessRowProps {
  process: ProcessInfo;
  isSelected: boolean;
  onSelect: (pid: number) => void;
  index: number;
}

/**
 * Badge component for process category.
 * Memoized to prevent re-renders when category unchanged.
 */
const CategoryBadge = memo(function CategoryBadge({ category }: { category: ProcessCategory }) {
  const config: Record<ProcessCategory, { icon: React.ReactNode; label: string; className: string }> = {
    system: {
      icon: <Shield className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'System',
      className: 'bg-muted/50 text-muted-foreground border-border/30',
    },
    user: {
      icon: <User className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'User',
      className: 'bg-primary/10 text-primary border-primary/20',
    },
    'safe-to-kill': {
      icon: <Skull className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'Safe',
      className: 'bg-warning/10 text-warning border-warning/20',
    },
  };

  const { icon, label, className } = config[category];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
        'border backdrop-blur-sm',
        className
      )}
    >
      {icon}
      {label}
    </span>
  );
});

/**
 * Single process row component.
 * Memoized to prevent re-renders for unchanged rows in the list.
 */
const ProcessRow = memo(function ProcessRow({ process, isSelected, onSelect, index }: ProcessRowProps) {
  const cpuColor = process.cpu_percent >= 50 ? 'text-danger' : process.cpu_percent >= 25 ? 'text-warning' : 'text-muted-foreground';
  const memColor = process.memory_percent >= 50 ? 'text-danger' : process.memory_percent >= 25 ? 'text-warning' : 'text-muted-foreground';

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02, duration: 0.2 }}
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:bg-white/5',
        isSelected && 'bg-primary/10 hover:bg-primary/15'
      )}
      onClick={() => onSelect(process.pid)}
      data-state={isSelected ? 'selected' : undefined}
    >
      <TableCell
        className="font-medium text-foreground max-w-[200px] truncate"
        title={process.name}
      >
        {process.name}
      </TableCell>
      <TableCell className={cn('text-right font-mono text-xs tabular-nums', cpuColor)}>
        {process.cpu_percent.toFixed(1)}%
      </TableCell>
      <TableCell className={cn('text-right font-mono text-xs tabular-nums', memColor)}>
        {process.memory_percent.toFixed(1)}%
      </TableCell>
      <TableCell className="text-center">
        <CategoryBadge category={process.category} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground/60 tabular-nums">
        {process.pid}
      </TableCell>
    </motion.tr>
  );
});

/**
 * Loading skeleton for process list.
 */
function ProcessListSkeleton() {
  return (
    <motion.div
      className="glass rounded-xl overflow-hidden"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-5 py-4 border-b border-border/20">
        <div className="h-5 w-40 rounded animate-shimmer" />
      </div>
      <div className="p-5 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="flex gap-3 py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="flex-[2] h-4 rounded animate-shimmer" />
            <div className="w-12 h-4 rounded animate-shimmer" />
            <div className="w-12 h-4 rounded animate-shimmer" />
            <div className="w-16 h-4 rounded animate-shimmer" />
            <div className="w-12 h-4 rounded animate-shimmer" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * ProcessList component showing running processes with resource usage.
 */
function ProcessList() {
  const { processes, loading, error, refresh } = useProcesses(3000);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const handleSelect = (pid: number) => {
    setSelectedPid(selectedPid === pid ? null : pid);
  };

  if (loading && !processes) {
    return <ProcessListSkeleton />;
  }

  if (error) {
    return (
      <motion.div
        className="glass rounded-xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
          <motion.div
            className={cn(
              'w-14 h-14 flex items-center justify-center rounded-full',
              'bg-danger/10 border-2 border-danger/30',
              'shadow-[0_0_20px_-4px_hsl(var(--danger)/0.4)]'
            )}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertCircle className="w-6 h-6 text-danger" strokeWidth={1.75} />
          </motion.div>
          <p className="text-sm text-muted-foreground/70 text-center max-w-[250px]">{error}</p>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={refresh}
              size="sm"
              className={cn(
                'gap-2 rounded-xl px-5',
                'bg-gradient-to-r from-primary to-accent',
                'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
              )}
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              Retry
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  const processCount = processes?.length ?? 0;

  return (
    <motion.div
      className={cn(
        'glass rounded-xl overflow-hidden group',
        'transition-all duration-300'
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
            <Activity className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wide">
            Running Processes
          </h3>
          <span className="text-xs text-muted-foreground/60 font-medium">
            ({processCount})
          </span>
        </div>

        {/* Learn Mode Explanation */}
        <LearnModeExplanation
          title="Process Categories"
          description="Processes are grouped by type. 'Safe' processes can be stopped for gaming without breaking your system."
          details="System processes are protected and essential for Windows/macOS. User processes include browsers and productivity apps. Safe-to-kill includes updaters, cloud sync services, and background apps that restart automatically."
          type="tip"
        />
      </div>

      {/* Table */}
      <div className="p-3">
        <ScrollArea className="h-[360px] rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-b border-border/20 bg-background/50 backdrop-blur-sm">
                <TableHead className="w-[40%] text-primary/80 text-[10px] uppercase tracking-widest font-semibold">
                  Name
                </TableHead>
                <TableHead className="w-[12%] text-right text-primary/80 text-[10px] uppercase tracking-widest font-semibold">
                  CPU
                </TableHead>
                <TableHead className="w-[12%] text-right text-primary/80 text-[10px] uppercase tracking-widest font-semibold">
                  Mem
                </TableHead>
                <TableHead className="w-[20%] text-center text-primary/80 text-[10px] uppercase tracking-widest font-semibold">
                  Type
                </TableHead>
                <TableHead className="w-[16%] text-right text-primary/80 text-[10px] uppercase tracking-widest font-semibold">
                  PID
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {processes?.map((process, index) => (
                  <ProcessRow
                    key={process.pid}
                    process={process}
                    isSelected={selectedPid === process.pid}
                    onSelect={handleSelect}
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

export default ProcessList;
