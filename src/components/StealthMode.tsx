/**
 * StealthMode component for one-click process termination.
 *
 * Provides a prominent button to terminate all safe-to-kill processes,
 * with confirmation dialog and results feedback.
 */

import { useState, useEffect, useCallback } from 'react';
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
      {/* Main Stealth Mode Button - Hero Action */}
      <button
        onClick={handleButtonClick}
        disabled={modalState !== 'closed'}
        className={cn(
          "relative w-full flex flex-col items-center justify-center",
          "py-6 px-8 rounded-xl",
          "bg-gradient-to-br from-success/15 via-success/10 to-success/5",
          "border-2 border-success",
          "transition-all duration-300 ease-out",
          "overflow-hidden group",
          "hover:-translate-y-0.5 hover:glow-lg-success",
          "active:translate-y-0",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0",
          hasProcesses && "animate-pulse-glow-success"
        )}
      >
        {/* Sweep animation on hover */}
        <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-success/20 to-transparent" />

        {/* Icon */}
        <span className="text-success mb-2 drop-shadow-[0_0_8px_hsl(var(--success)/0.6)]">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </span>

        {/* Text */}
        <span className="text-lg font-bold text-success tracking-[0.15em] text-glow-success">
          STEALTH MODE
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          Free up system resources
        </span>
      </button>

      {/* Confirmation / Loading / Results Dialog */}
      <Dialog open={modalState !== 'closed'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[480px] bg-card border-border glow-sm-success">
          {/* Confirmation State */}
          {modalState === 'confirm' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  Activate Stealth Mode?
                </DialogTitle>
                <DialogDescription className="text-center">
                  This will terminate {safeToKillProcesses.length} background processes
                  to free up system resources.
                </DialogDescription>
              </DialogHeader>

              {hasProcesses ? (
                <>
                  <div className="bg-background/50 rounded-lg border border-border p-4 my-4">
                    <div className="flex justify-between items-center mb-3 text-xs text-muted-foreground">
                      <span>Processes to terminate:</span>
                      <span className="text-success font-semibold">~{estimatedMemory} MB</span>
                    </div>
                    <ScrollArea className="h-[180px]">
                      <ul className="space-y-1">
                        {safeToKillProcesses.slice(0, 8).map(p => (
                          <li
                            key={p.pid}
                            className="flex justify-between py-1.5 border-b border-border/30 last:border-0 text-sm"
                          >
                            <span className="text-foreground truncate max-w-[70%]">{p.name}</span>
                            <span className="text-muted-foreground">{p.memory_percent.toFixed(1)}%</span>
                          </li>
                        ))}
                        {safeToKillProcesses.length > 8 && (
                          <li className="text-center text-muted-foreground italic text-sm py-1.5">
                            +{safeToKillProcesses.length - 8} more...
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                  </div>

                  <DialogFooter className="gap-3 sm:gap-2">
                    <Button variant="outline" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      variant="success"
                      onClick={handleActivate}
                      className="glow-sm-success hover:glow-md-success"
                    >
                      Activate
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <p className="text-center text-success py-6">
                    No safe-to-kill processes found. System is already optimized!
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                      Close
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* Loading State */}
          {modalState === 'loading' && (
            <div className="flex flex-col items-center py-10">
              <div className="w-12 h-12 border-3 border-border border-t-success rounded-full animate-spin" />
              <p className="mt-4 text-muted-foreground">Terminating processes...</p>
            </div>
          )}

          {/* Results State */}
          {modalState === 'results' && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl">
                  {error ? 'Stealth Mode Error' : 'Stealth Mode Complete'}
                </DialogTitle>
              </DialogHeader>

              {error ? (
                <p className="text-center text-danger py-6">{error}</p>
              ) : result && (
                <div className="py-4">
                  {/* Stats */}
                  <div className="flex justify-center gap-8 mb-6">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl font-bold text-success text-glow-success">
                        {result.terminated.length}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">Terminated</span>
                    </div>
                    {result.failed.length > 0 && (
                      <div className="flex flex-col items-center">
                        <span className="text-4xl font-bold text-danger">
                          {result.failed.length}
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">Failed</span>
                      </div>
                    )}
                    <div className="flex flex-col items-center">
                      <span className="text-4xl font-bold text-primary">
                        {result.freed_memory_mb.toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground mt-1">MB Freed</span>
                    </div>
                  </div>

                  {/* Terminated list */}
                  {result.terminated.length > 0 && (
                    <div className="bg-background/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-2">Terminated:</p>
                      <ul className="space-y-1">
                        {result.terminated.slice(0, 5).map(t => (
                          <li key={t.pid} className="text-sm text-foreground">
                            {t.name || `PID ${t.pid}`}
                          </li>
                        ))}
                        {result.terminated.length > 5 && (
                          <li className="text-sm text-muted-foreground italic">
                            +{result.terminated.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="flex-col items-center gap-4">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <p className="text-[11px] text-muted-foreground/70">
                  Auto-closing in 5 seconds...
                </p>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default StealthMode;
