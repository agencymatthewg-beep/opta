/**
 * ProcessList - The Obsidian Process Monitor with Drag-Drop
 *
 * Shows a scrollable table of processes with resource usage and categorization.
 * Uses obsidian glass material with 0%->50% energy transitions.
 * Supports drag-and-drop to quarantine zone for process termination.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useProcesses } from '../hooks/useProcesses';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
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
import {
  DragDropContext,
  DraggableProcess,
  DroppableZone,
  DragInstructions,
} from '@/components/DragDrop';
import { cn } from '@/lib/utils';
import {
  Activity,
  AlertCircle,
  RefreshCw,
  Shield,
  User,
  Skull,
  XCircle,
} from 'lucide-react';
import { LearnModeExplanation } from './LearnModeExplanation';
import { OptaRingLoader } from './OptaRing';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ProcessRowProps {
  process: ProcessInfo;
  isSelected: boolean;
  onSelect: (pid: number) => void;
}

/**
 * Badge component for process category - Obsidian styled.
 * Memoized to prevent re-renders when category unchanged.
 */
const CategoryBadge = memo(function CategoryBadge({
  category,
}: {
  category: ProcessCategory;
}) {
  const config: Record<
    ProcessCategory,
    { icon: React.ReactNode; label: string; className: string }
  > = {
    system: {
      icon: <Shield className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'System',
      className: 'bg-white/[0.03] text-muted-foreground border-white/[0.08]',
    },
    user: {
      icon: <User className="w-2.5 h-2.5" strokeWidth={2} />,
      label: 'User',
      className:
        'bg-primary/10 text-primary border-primary/25 shadow-[0_0_8px_-2px_rgba(168,85,247,0.3)]',
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
const ProcessRow = memo(function ProcessRow({
  process,
  isSelected,
  onSelect,
}: ProcessRowProps) {
  const cpuColor =
    process.cpu_percent >= 50
      ? 'text-danger'
      : process.cpu_percent >= 25
        ? 'text-warning'
        : 'text-muted-foreground';
  const memColor =
    process.memory_percent >= 50
      ? 'text-danger'
      : process.memory_percent >= 25
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <tr
      className={cn(
        'cursor-pointer transition-all duration-200',
        'hover:bg-primary/[0.03]',
        isSelected &&
          'bg-primary/10 hover:bg-primary/15 shadow-[inset_0_0_15px_rgba(168,85,247,0.08)]'
      )}
      onClick={() => onSelect(process.pid)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(process.pid);
        }
      }}
      tabIndex={0}
      role="row"
      aria-selected={isSelected}
      data-state={isSelected ? 'selected' : undefined}
    >
      <TableCell
        className="font-medium text-foreground max-w-[200px] truncate"
        title={process.name}
      >
        {process.name}
      </TableCell>
      <TableCell
        className={cn(
          'text-right font-mono text-xs tabular-nums',
          cpuColor
        )}
      >
        {process.cpu_percent.toFixed(1)}%
      </TableCell>
      <TableCell
        className={cn(
          'text-right font-mono text-xs tabular-nums',
          memColor
        )}
      >
        {process.memory_percent.toFixed(1)}%
      </TableCell>
      <TableCell className="text-center">
        <CategoryBadge category={process.category} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground/50 tabular-nums">
        {process.pid}
      </TableCell>
    </tr>
  );
});

/**
 * Compact process preview for drag overlay
 */
const ProcessDragPreview = memo(function ProcessDragPreview({
  process,
}: {
  process: ProcessInfo;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-w-[200px]">
      <XCircle className="w-4 h-4 text-danger" strokeWidth={1.75} />
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
          {process.name}
        </p>
        <p className="text-xs text-muted-foreground">PID: {process.pid}</p>
      </div>
    </div>
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
        'glass',
        'border border-white/[0.06]'
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: smoothOut }}
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
 * Includes drag-and-drop support for terminating processes.
 */
function ProcessList() {
  const { processes, loading, error, refresh } = useProcesses(3000);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [draggingProcess, setDraggingProcess] = useState<ProcessInfo | null>(
    null
  );
  const [showQuarantine, setShowQuarantine] = useState(false);
  const { trigger: haptic } = useHapticFeedback();

  const handleSelect = (pid: number) => {
    setSelectedPid(selectedPid === pid ? null : pid);
  };

  /**
   * Handle drag start - show quarantine zone and trigger haptic
   */
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const processId = event.active.id as string;
      const process = processes?.find((p) => p.pid.toString() === processId);

      if (process) {
        setDraggingProcess(process);
        setShowQuarantine(true);
        haptic('pickup');
      }
    },
    [processes, haptic]
  );

  /**
   * Handle drag end - terminate if dropped on quarantine
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      setDraggingProcess(null);
      setShowQuarantine(false);

      // Check if dropped on quarantine zone
      if (over?.id === 'quarantine' && active.id) {
        const process = processes?.find(
          (p) => p.pid.toString() === active.id
        );

        if (process) {
          // Confirm termination for system processes
          if (process.category === 'system') {
            haptic('error');
            // In production, show confirmation modal
            console.warn(
              'Cannot terminate system process:',
              process.name
            );
            return;
          }

          // Trigger destructive haptic feedback
          haptic('destructive');

          // TODO: Integrate with actual process termination via Tauri
          // await invoke('kill_process', { pid: process.pid });
          console.log('Would terminate process:', process.name, process.pid);

          // Trigger success feedback after termination
          haptic('success');
        }
      } else {
        // Drag cancelled or dropped elsewhere
        haptic('drop');
      }
    },
    [processes, haptic]
  );

  /**
   * Render drag overlay content
   */
  const renderDragOverlay = useCallback(
    (activeId: string) => {
      const process = processes?.find((p) => p.pid.toString() === activeId);
      if (!process) return null;
      return <ProcessDragPreview process={process} />;
    },
    [processes]
  );

  if (loading && !processes) {
    return <ProcessListSkeleton />;
  }

  if (error) {
    return (
      <motion.div
        className={cn(
          'relative overflow-hidden rounded-xl',
          'glass',
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
            <AlertCircle
              className="w-6 h-6 text-danger"
              strokeWidth={1.75}
            />
          </motion.div>
          <p className="text-sm text-muted-foreground/70 text-center max-w-[250px]">
            {error}
          </p>
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
    <DragDropContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      renderOverlay={renderDragOverlay}
    >
      {/* Screen reader instructions */}
      <DragInstructions />

      <motion.div
        className={cn(
          'relative overflow-hidden rounded-xl group',
          // Obsidian glass material
          'glass',
          'border border-white/[0.06]',
          // Inner specular highlight
          'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
          'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
          'before:rounded-t-xl'
        )}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: smoothOut }}
        whileHover={{ y: -2 }}
      >
        {/* Hover glow overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
          style={{
            boxShadow:
              'inset 0 0 0 1px rgba(168, 85, 247, 0.15), 0 0 20px -5px rgba(168, 85, 247, 0.2)',
          }}
          transition={{ duration: 0.3 }}
        />

        {/* Header */}
        <div className="relative px-5 py-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-all duration-300"
              whileHover={{
                boxShadow: '0 0 15px -3px rgba(168, 85, 247, 0.5)',
              }}
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
        <div className="relative p-3 pl-10">
          <ScrollArea className="h-[360px] rounded-lg">
            <Table aria-label="Running processes">
              <caption className="sr-only">
                List of running processes showing name, CPU usage, memory usage, type, and process ID.
                Drag non-system processes to the quarantine zone to terminate them.
              </caption>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-b border-white/[0.05] glass-strong">
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
                {processes?.map((process) => (
                  <DraggableProcess
                    key={process.pid}
                    id={process.pid.toString()}
                    disabled={process.category === 'system'}
                    data={{ process }}
                  >
                    <ProcessRow
                      process={process}
                      isSelected={selectedPid === process.pid}
                      onSelect={handleSelect}
                    />
                  </DraggableProcess>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Quarantine Zone - Shows during drag */}
        <AnimatePresence>
          {showQuarantine && (
            <motion.div
              className="px-3 pb-3 overflow-hidden"
              initial={{ opacity: 0, maxHeight: 0 }}
              animate={{ opacity: 1, maxHeight: 200 }}
              exit={{ opacity: 0, maxHeight: 0 }}
              transition={{ duration: 0.2, ease: smoothOut }}
            >
              <DroppableZone
                id="quarantine"
                label={
                  draggingProcess
                    ? `Drop to terminate "${draggingProcess.name}"`
                    : 'Drop to terminate'
                }
                variant="destructive"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DragDropContext>
  );
}

export default ProcessList;
