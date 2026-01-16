/**
 * StealthMode component for one-click process termination.
 *
 * Provides a prominent button to terminate all safe-to-kill processes,
 * with confirmation dialog and results feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import type { ProcessInfo, StealthModeResult } from '../types/processes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Zap, CheckCircle, XCircle, Loader2, Sparkles } from 'lucide-react';
import { LearnModeExplanation } from './LearnModeExplanation';

type ModalState = 'closed' | 'confirm' | 'loading' | 'results';

interface StealthModeProps {
  /** Optional callback when stealth mode completes */
  onComplete?: (result: StealthModeResult) => void;
}

/**
 * StealthMode component with confirmation modal and results display.
 */
function StealthMode({ onComplete }: StealthModeProps) {
  const [modalState, setModalState] = useState<ModalState>('closed');
  const [safeToKillProcesses, setSafeToKillProcesses] = useState<ProcessInfo[]>([]);
  const [estimatedMemory, setEstimatedMemory] = useState<number>(0);
  const [result, setResult] = useState<StealthModeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch safe-to-kill processes when opening confirmation
  const fetchProcesses = useCallback(async () => {
    try {
      const processes = await invoke<ProcessInfo[]>('get_processes');
      const safeToKill = processes.filter(p => p.category === 'safe-to-kill');
      setSafeToKillProcesses(safeToKill);

      // Estimate memory based on process memory percentages
      // Assume 16GB (16384MB) as rough estimate for now
      const totalMemoryMb = 16384;
      const estimated = safeToKill.reduce(
        (sum, p) => sum + (p.memory_percent / 100) * totalMemoryMb,
        0
      );
      setEstimatedMemory(Math.round(estimated));
    } catch (err) {
      console.error('Failed to fetch processes:', err);
      setError(String(err));
    }
  }, []);

  // Open confirmation modal
  const handleButtonClick = async () => {
    setError(null);
    setResult(null);
    setModalState('confirm');
    await fetchProcesses();
  };

  // Execute stealth mode
  const handleActivate = async () => {
    setModalState('loading');
    try {
      const stealthResult = await invoke<StealthModeResult>('stealth_mode');
      setResult(stealthResult);
      setModalState('results');
      onComplete?.(stealthResult);
    } catch (err) {
      console.error('Stealth mode failed:', err);
      setError(String(err));
      setModalState('results');
    }
  };

  // Close modal
  const handleClose = () => {
    setModalState('closed');
    setResult(null);
    setError(null);
  };

  // Auto-dismiss results after 5 seconds
  useEffect(() => {
    if (modalState === 'results') {
      const timer = setTimeout(() => {
        handleClose();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [modalState]);

  const hasProcesses = safeToKillProcesses.length > 0;

  return (
    <>
      {/* Learn Mode Explanation */}
      <LearnModeExplanation
        title="What is Stealth Mode?"
        description="One-click termination of non-essential background processes to free up CPU and RAM for gaming."
        details="Uses a safe list to protect system-critical processes. Terminated processes will restart automatically after your gaming session ends. This typically frees 200-800MB of RAM and reduces CPU background load."
        type="how-it-works"
        className="mb-4"
      />

      {/* Main Stealth Mode Button - Hero Action */}
      <motion.button
        onClick={handleButtonClick}
        disabled={modalState !== 'closed'}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01, y: -3 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'relative w-full flex flex-col items-center justify-center',
          'py-8 px-8 rounded-2xl',
          'glass overflow-hidden group',
          'border-2 border-success/40',
          'transition-all duration-300 ease-out',
          'hover:border-success/60',
          'hover:shadow-[0_0_40px_-8px_hsl(var(--success)/0.4)]',
          'disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-success/10 via-success/5 to-transparent"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Sweep animation on hover */}
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-success/15 to-transparent" />

        {/* Icon */}
        <motion.div
          className={cn(
            'relative mb-3 p-4 rounded-full',
            'bg-success/15 border border-success/30',
            'shadow-[0_0_24px_-4px_hsl(var(--success)/0.5)]'
          )}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Zap className="w-8 h-8 text-success" strokeWidth={1.5} />
        </motion.div>

        {/* Text */}
        <motion.span
          className={cn(
            'relative text-xl font-bold tracking-[0.2em] uppercase',
            'bg-gradient-to-r from-success via-success-light to-success bg-clip-text text-transparent'
          )}
        >
          Stealth Mode
        </motion.span>
        <span className="relative text-sm text-muted-foreground/70 mt-1.5">
          Free up system resources instantly
        </span>

        {/* Floating particles effect */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-success/40"
              style={{
                left: `${20 + i * 30}%`,
                bottom: '20%',
              }}
              animate={{
                y: [0, -60, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.3,
                ease: 'easeOut',
              }}
            />
          ))}
        </div>
      </motion.button>

      {/* Confirmation / Loading / Results Dialog */}
      <Dialog open={modalState !== 'closed'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[480px] glass-strong border-border/30 shadow-[0_0_48px_-12px_hsl(var(--success)/0.3)]">
          <AnimatePresence mode="wait">
            {/* Confirmation State */}
            {modalState === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <DialogHeader>
                  <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5 text-success" strokeWidth={2} />
                    Activate Stealth Mode?
                  </DialogTitle>
                  <DialogDescription className="text-center text-muted-foreground/70">
                    This will terminate {safeToKillProcesses.length} background processes
                    to free up system resources.
                  </DialogDescription>
                </DialogHeader>

                {hasProcesses ? (
                  <>
                    <div className="glass-subtle rounded-xl border border-border/20 p-4 my-4">
                      <div className="flex justify-between items-center mb-3 text-xs text-muted-foreground">
                        <span>Processes to terminate:</span>
                        <span className="text-success font-semibold">~{estimatedMemory} MB</span>
                      </div>
                      <ScrollArea className="h-[180px]">
                        <ul className="space-y-1">
                          {safeToKillProcesses.slice(0, 8).map((p, i) => (
                            <motion.li
                              key={p.pid}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex justify-between py-1.5 border-b border-border/20 last:border-0 text-sm"
                            >
                              <span className="text-foreground truncate max-w-[70%]">{p.name}</span>
                              <span className="text-muted-foreground/60 tabular-nums">{p.memory_percent.toFixed(1)}%</span>
                            </motion.li>
                          ))}
                          {safeToKillProcesses.length > 8 && (
                            <li className="text-center text-muted-foreground/50 italic text-sm py-1.5">
                              +{safeToKillProcesses.length - 8} more...
                            </li>
                          )}
                        </ul>
                      </ScrollArea>
                    </div>

                    <DialogFooter className="gap-3 sm:gap-2">
                      <Button variant="ghost" onClick={handleClose} className="glass-subtle">
                        Cancel
                      </Button>
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                          onClick={handleActivate}
                          className={cn(
                            'gap-2 rounded-xl px-6',
                            'bg-gradient-to-r from-success to-success-light',
                            'shadow-[0_0_20px_-4px_hsl(var(--success)/0.5)]',
                            'hover:shadow-[0_0_28px_-4px_hsl(var(--success)/0.6)]'
                          )}
                        >
                          <Zap className="w-4 h-4" strokeWidth={2} />
                          Activate
                        </Button>
                      </motion.div>
                    </DialogFooter>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="flex flex-col items-center py-8"
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                    >
                      <div className={cn(
                        'w-16 h-16 flex items-center justify-center rounded-full mb-4',
                        'bg-success/15 border-2 border-success/30',
                        'shadow-[0_0_24px_-4px_hsl(var(--success)/0.5)]'
                      )}>
                        <Sparkles className="w-7 h-7 text-success" strokeWidth={1.5} />
                      </div>
                      <p className="text-success font-medium">
                        System is already optimized!
                      </p>
                      <p className="text-sm text-muted-foreground/60 mt-1">
                        No safe-to-kill processes found.
                      </p>
                    </motion.div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={handleClose} className="w-full sm:w-auto glass-subtle">
                        Close
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </motion.div>
            )}

            {/* Loading State */}
            {modalState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-12"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-12 h-12 text-success" strokeWidth={1.5} />
                </motion.div>
                <p className="mt-5 text-muted-foreground">Terminating processes...</p>
                <motion.div
                  className="mt-3 flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-2 h-2 rounded-full bg-success/50"
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* Results State */}
            {modalState === 'results' && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <DialogHeader>
                  <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
                    {error ? (
                      <>
                        <XCircle className="w-5 h-5 text-danger" strokeWidth={2} />
                        Stealth Mode Error
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5 text-success" strokeWidth={2} />
                        Stealth Mode Complete
                      </>
                    )}
                  </DialogTitle>
                </DialogHeader>

                {error ? (
                  <p className="text-center text-danger py-6">{error}</p>
                ) : result && (
                  <div className="py-6">
                    {/* Stats */}
                    <div className="flex justify-center gap-8 mb-6">
                      <motion.div
                        className="flex flex-col items-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.1 }}
                      >
                        <span className={cn(
                          'text-4xl font-bold text-success',
                          'drop-shadow-[0_0_12px_hsl(var(--success)/0.5)]'
                        )}>
                          {result.terminated.length}
                        </span>
                        <span className="text-xs text-muted-foreground/60 mt-1 uppercase tracking-wide">
                          Terminated
                        </span>
                      </motion.div>
                      {result.failed.length > 0 && (
                        <motion.div
                          className="flex flex-col items-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', delay: 0.2 }}
                        >
                          <span className="text-4xl font-bold text-danger">
                            {result.failed.length}
                          </span>
                          <span className="text-xs text-muted-foreground/60 mt-1 uppercase tracking-wide">
                            Failed
                          </span>
                        </motion.div>
                      )}
                      <motion.div
                        className="flex flex-col items-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 0.3 }}
                      >
                        <span className={cn(
                          'text-4xl font-bold text-primary',
                          'drop-shadow-[0_0_12px_hsl(var(--glow-primary)/0.5)]'
                        )}>
                          {result.freed_memory_mb.toFixed(0)}
                        </span>
                        <span className="text-xs text-muted-foreground/60 mt-1 uppercase tracking-wide">
                          MB Freed
                        </span>
                      </motion.div>
                    </div>

                    {/* Terminated list */}
                    {result.terminated.length > 0 && (
                      <div className="glass-subtle rounded-xl p-4 border border-border/20">
                        <p className="text-xs text-muted-foreground/60 mb-2 uppercase tracking-wide">
                          Terminated:
                        </p>
                        <ul className="space-y-1">
                          {result.terminated.slice(0, 5).map((t, i) => (
                            <motion.li
                              key={t.pid}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + i * 0.05 }}
                              className="text-sm text-foreground/80"
                            >
                              {t.name || `PID ${t.pid}`}
                            </motion.li>
                          ))}
                          {result.terminated.length > 5 && (
                            <li className="text-sm text-muted-foreground/50 italic">
                              +{result.terminated.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter className="flex-col items-center gap-4">
                  <Button variant="ghost" onClick={handleClose} className="glass-subtle">
                    Close
                  </Button>
                  <motion.p
                    className="text-[11px] text-muted-foreground/50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    Auto-closing in 5 seconds...
                  </motion.p>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StealthMode;
