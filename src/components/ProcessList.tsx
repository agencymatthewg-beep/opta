/**
 * ProcessList - The Obsidian Process Monitor
 *
 * Shows a scrollable table of processes with resource usage and categorization.
 * Uses obsidian glass material with 0%→50% energy transitions.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProcesses } from '../hooks/useProcesses';
import type { ProcessInfo, ProcessCategory } from '../types/processes';
import { MotionButton } from '@/components/ui/button';
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
import { OptaRingLoader } from './OptaRing';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ProcessRowProps {
  process: ProcessInfo;
  isSelected: boolean;
  onSelect: (pid: number) => void;
  index: number;
}

/**
 * Badge component for process category - Obsidian styled.
 * Memoized to prevent re-renders when category unchanged.
 */
const CategoryBadge = memo(function CategoryBadge({ category }: { category: ProcessCategory }) {
  const config: Record<ProcessCategory, { icon: React.ReactNode; label: string; className: string }> = {
    system: {
      icon: <Shield className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'System',
      className: 'bg-white/[0.03] text-muted-foreground border-white/[0.08]',
    },
    user: {
      icon: <User className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'User',
      className: 'bg-primary/10 text-primary border-primary/25 shadow-[0_0_8px_-2px_rgba(168,85,247,0.3)]',
    },
    'safe-to-kill': {
      icon: <Skull className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'Safe',
      className: 'bg-warning/10 text-warning border-warning/25',
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
 * Single process row component with obsidian hover states.
 * Memoized to prevent re-renders for unchanged rows in the list.
 */
const ProcessRow = memo(function ProcessRow({ process, isSelected, onSelect, index }: ProcessRowProps) {
  const cpuColor = process.cpu_percent >= 50 ? 'text-danger' : process.cpu_percent >= 25 ? 'text-warning' : 'text-muted-foreground';
  const memColor = process.memory_percent >= 50 ? 'text-danger' : process.memory_percent >= 25 ? 'text-warning' : 'text-muted-foreground';

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10, filter: 'brightness(0.7)' }}
      animate={{ opacity: 1, x: 0, filter: 'brightness(1)' }}
      transition={{ delay: index * 0.02, duration: 0.25, ease: smoothOut }}
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:bg-primary/[0.03]',
        isSelected && 'bg-primary/10 hover:bg-primary/15 shadow-[inset_0_0_15px_rgba(168,85,247,0.08)]'
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
      <TableCell className="text-right font-mono text-xs text-muted-foreground/50 tabular-nums">
        {process.pid}
      </TableCell>
    </motion.tr>
  );
});

/**
 * Loading skeleton for process list - uses OptaRing.
 */
function ProcessListSkeleton() {
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-xl',
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]'
      )}
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ duration: 0.5, ease: smoothOut }}
    >
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <OptaRingLoader size="md" />
        <p className="text-sm text-muted-foreground/60">Loading processes...</p>
      </div>
    </motion.div>
  );
}

/**
 * ProcessList component showing running processes with obsidian styling.
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
        className={cn(
          'relative overflow-hidden rounded-xl',
          'bg-[#05030a]/80 backdrop-blur-xl',
          'border border-white/[0.06]'
        )}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ease: smoothOut }}
      >
        <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
          <motion.div
            className={cn(
              'w-14 h-14 flex items-center justify-center rounded-full',
              'bg-danger/10 border-2 border-danger/30',
              'shadow-[0_0_25px_-4px_rgba(239,68,68,0.5)]'
            )}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <AlertCircle className="w-6 h-6 text-danger" strokeWidth={1.75} />
          </motion.div>
          <p className="text-sm text-muted-foreground/70 text-center max-w-[250px]">{error}</p>
          <MotionButton
            onClick={refresh}
            size="sm"
            variant="energy"
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" strokeWidth={2} />
            Retry
          </MotionButton>
        </div>
      </motion.div>
    );
  }

  const processCount = processes?.length ?? 0;

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-xl group',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:rounded-t-xl'
      )}
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ duration: 0.5, ease: smoothOut }}
      whileHover={{ y: -2 }}
    >
      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(168, 85, 247, 0.15), 0 0 20px -5px rgba(168, 85, 247, 0.2)',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-all duration-300"
            whileHover={{ boxShadow: '0 0 15px -3px rgba(168, 85, 247, 0.5)' }}
          >
            <Activity
              className="w-4 h-4 text-primary group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.6)] transition-all duration-300"
              strokeWidth={1.75}
            />
          </motion.div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            Running Processes
          </h3>
          <span className="text-xs text-muted-foreground/50 font-medium">
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
      <div className="relative p-3">
        <ScrollArea className="h-[360px] rounded-lg">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-b border-white/[0.05] bg-[#05030a]/90 backdrop-blur-sm">
                <TableHead className="w-[40%] text-primary/70 text-[10px] uppercase tracking-widest font-semibold">
                  Name
                </TableHead>
                <TableHead className="w-[12%] text-right text-primary/70 text-[10px] uppercase tracking-widest font-semibold">
                  CPU
                </TableHead>
                <TableHead className="w-[12%] text-right text-primary/70 text-[10px] uppercase tracking-widest font-semibold">
                  Mem
                </TableHead>
                <TableHead className="w-[20%] text-center text-primary/70 text-[10px] uppercase tracking-widest font-semibold">
                  Type
                </TableHead>
                <TableHead className="w-[16%] text-right text-primary/70 text-[10px] uppercase tracking-widest font-semibold">
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
