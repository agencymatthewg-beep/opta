/**
 * LaunchConfirmationModal - Pre-launch confirmation with action checklist.
 *
 * Follows DESIGN_SYSTEM.md Obsidian Standard:
 * - Obsidian glass surfaces with volumetric glow
 * - 0%→50% energy transitions with ignition animations
 * - Framer Motion with smoothOut easing
 * - Lucide icons
 */

// Smooth deceleration easing for premium feel
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Play,
  Rocket,
  X,
  Zap,
  Shield,
  Activity,
  Loader2,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { DetectedGame } from '../types/games';
import type { LaunchConfig } from '../types/launcher';

export interface LaunchConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onLaunch: (config: LaunchConfig) => void;
  game: DetectedGame;
  pendingOptimizations: number;
  estimatedMemorySavingsMb: number;
  safeToKillCount: number;
  loading?: boolean;
  /** Initial config to use (from saved preferences) */
  initialConfig?: Partial<LaunchConfig>;
  /** Error message to display when launch fails */
  error?: string;
  /** Callback when user clicks retry after error */
  onRetry?: () => void;
}

interface PreLaunchActionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function PreLaunchAction({
  icon: Icon,
  title,
  description,
  detail,
  checked,
  onCheckedChange,
  disabled = false,
}: PreLaunchActionProps) {
  return (
    <label
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all',
        'bg-white/[0.02] border',
        checked
          ? 'border-primary/30 bg-primary/5 shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)]'
          : 'border-white/[0.04] hover:border-white/[0.08]',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(c: boolean) => !disabled && onCheckedChange(c)}
        disabled={disabled}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="ml-auto text-xs text-muted-foreground/70 tabular-nums">
            {detail}
          </span>
        </div>
        <p className="text-xs text-muted-foreground/70 pl-8">{description}</p>
      </div>
    </label>
  );
}

function LaunchConfirmationModal({
  open,
  onClose,
  onLaunch,
  game,
  pendingOptimizations,
  estimatedMemorySavingsMb,
  safeToKillCount,
  loading = false,
  initialConfig,
  error,
  onRetry,
}: LaunchConfirmationModalProps) {
  const [config, setConfig] = useState<LaunchConfig>({
    applyOptimizations: initialConfig?.applyOptimizations ?? (pendingOptimizations > 0),
    runStealthMode: initialConfig?.runStealthMode ?? true,
    trackSession: initialConfig?.trackSession ?? false,
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Get launcher display name
  const launcherName =
    game.launcher === 'steam'
      ? 'Steam'
      : game.launcher === 'epic'
      ? 'Epic Games'
      : game.launcher === 'gog'
      ? 'GOG Galaxy'
      : game.launcher;

  const handleClose = () => {
    // If loading, show cancel confirmation
    if (loading) {
      setShowCancelConfirm(true);
      return;
    }
    // Reset to saved preferences
    setConfig({
      applyOptimizations: initialConfig?.applyOptimizations ?? (pendingOptimizations > 0),
      runStealthMode: initialConfig?.runStealthMode ?? true,
      trackSession: initialConfig?.trackSession ?? false,
    });
    setShowCancelConfirm(false);
    onClose();
  };

  const handleConfirmCancel = () => {
    // Force close even during loading
    setConfig({
      applyOptimizations: initialConfig?.applyOptimizations ?? (pendingOptimizations > 0),
      runStealthMode: initialConfig?.runStealthMode ?? true,
      trackSession: initialConfig?.trackSession ?? false,
    });
    setShowCancelConfirm(false);
    onClose();
  };

  const handleLaunch = () => {
    onLaunch(config);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={cn(
                "relative w-full max-w-lg rounded-2xl overflow-hidden",
                "glass-strong",
                "border border-primary/30",
                "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
                "before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent",
                "shadow-[0_0_40px_-10px_rgba(168,85,247,0.4)]"
              )}
              initial={{ scale: 0.95, y: 20, filter: 'brightness(0.5)' }}
              animate={{ scale: 1, y: 0, filter: 'brightness(1)' }}
              exit={{ scale: 0.95, y: 20, filter: 'brightness(0.5)' }}
              transition={{ duration: 0.4, ease: smoothOut }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-white/[0.02] border-b border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.5, delay: 0.1 }}
                    >
                      <Rocket className="w-5 h-5 text-primary" strokeWidth={2} />
                    </motion.div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Launch via Opta
                      </h2>
                      <p className="text-sm text-muted-foreground/70">{game.name}</p>
                    </div>
                  </div>
                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleClose}
                      className="rounded-xl"
                      disabled={loading}
                    >
                      <X className="w-5 h-5" strokeWidth={1.75} />
                    </Button>
                  </motion.div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Pre-launch actions */}
                <div className="space-y-1">
                  <h3 className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider px-1">
                    Pre-Launch Actions
                  </h3>
                  <div className="space-y-2">
                    <PreLaunchAction
                      icon={Zap}
                      title="Apply Optimizations"
                      description={
                        pendingOptimizations > 0
                          ? `Apply ${pendingOptimizations} optimization${pendingOptimizations !== 1 ? 's' : ''} for better performance`
                          : 'No optimizations available for this game'
                      }
                      detail={
                        pendingOptimizations > 0
                          ? `${pendingOptimizations} change${pendingOptimizations !== 1 ? 's' : ''}`
                          : 'None'
                      }
                      checked={config.applyOptimizations}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, applyOptimizations: checked }))
                      }
                      disabled={pendingOptimizations === 0}
                    />

                    <PreLaunchAction
                      icon={Shield}
                      title="Run Stealth Mode"
                      description={`Kill ${safeToKillCount} background process${safeToKillCount !== 1 ? 'es' : ''} to free resources`}
                      detail={`~${Math.round(estimatedMemorySavingsMb)} MB`}
                      checked={config.runStealthMode}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, runStealthMode: checked }))
                      }
                      disabled={safeToKillCount === 0}
                    />

                    <PreLaunchAction
                      icon={Activity}
                      title="Track Session Metrics"
                      description="Monitor CPU, GPU, and RAM usage during gameplay"
                      detail="Optional"
                      checked={config.trackSession}
                      onCheckedChange={(checked) =>
                        setConfig((prev) => ({ ...prev, trackSession: checked }))
                      }
                    />
                  </div>
                </div>

                {/* Launch info */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      game.launcher === 'steam' && 'bg-primary',
                      game.launcher === 'epic' && 'bg-muted-foreground',
                      game.launcher === 'gog' && 'bg-accent'
                    )}
                  />
                  <span className="text-xs text-muted-foreground/70">
                    Launching via <span className="font-medium text-foreground">{launcherName}</span>
                  </span>
                </div>
              </div>

              {/* Error display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    className="px-6 pb-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div
                      className={cn(
                        'p-3 rounded-xl flex items-start gap-3',
                        'bg-danger/10 border border-danger/30'
                      )}
                    >
                      <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" strokeWidth={2} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-danger font-medium">Launch Failed</p>
                        <p className="text-xs text-danger/70 mt-0.5">{error}</p>
                      </div>
                      {onRetry && (
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRetry}
                            className="h-7 px-2 text-xs gap-1.5 text-danger hover:text-danger hover:bg-danger/10"
                          >
                            <RefreshCw className="w-3 h-3" strokeWidth={2} />
                            Retry
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cancel confirmation during loading */}
              <AnimatePresence>
                {showCancelConfirm && (
                  <motion.div
                    className="px-6 pb-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div
                      className={cn(
                        'p-3 rounded-xl flex items-center justify-between gap-3',
                        'bg-warning/10 border border-warning/30'
                      )}
                    >
                      <p className="text-sm text-warning">
                        Are you sure? This will stop the launch.
                      </p>
                      <div className="flex items-center gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCancelConfirm(false)}
                            className="h-7 px-2 text-xs"
                          >
                            No, continue
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleConfirmCancel}
                            className="h-7 px-2 text-xs text-warning hover:text-warning hover:bg-warning/10"
                          >
                            Yes, cancel
                          </Button>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/20 flex items-center justify-end gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="rounded-xl bg-white/[0.02] border-white/[0.06]"
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleLaunch}
                    disabled={loading}
                    className={cn(
                      'gap-1.5 rounded-xl',
                      'bg-gradient-to-r from-primary to-accent',
                      'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Launching...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" strokeWidth={2} />
                        Launch via Opta
                      </>
                    )}
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default LaunchConfirmationModal;
