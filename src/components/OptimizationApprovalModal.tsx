/**
 * OptimizationApprovalModal - Human-in-the-loop approval before applying optimizations.
 *
 * Follows DESIGN_SYSTEM.md:
 * - Glass effects (glass-strong for modal)
 * - Framer Motion animations
 * - Lucide icons
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Shield,
  AlertTriangle,
  X,
  Check,
  ChevronDown,
  Monitor,
  Terminal,
  Cpu,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import type { GameOptimization } from '../types/games';

export interface OptimizationApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  optimization: GameOptimization;
  gameName: string;
  loading?: boolean;
}

interface SettingPreviewProps {
  type: 'graphics' | 'launch_options' | 'priority';
  settings: Record<string, string> | string;
}

function SettingPreview({ type, settings }: SettingPreviewProps) {
  const [expanded, setExpanded] = useState(true);

  const Icon = type === 'graphics' ? Monitor : type === 'launch_options' ? Terminal : Cpu;
  const title = type === 'graphics' ? 'Graphics Settings' : type === 'launch_options' ? 'Launch Options' : 'Process Priority';

  return (
    <div className="glass-subtle rounded-xl border border-border/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground/50 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              {typeof settings === 'string' ? (
                <code className="block px-3 py-2 rounded-lg bg-black/20 text-xs text-foreground/80 font-mono">
                  {settings}
                </code>
              ) : (
                Object.entries(settings).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20"
                  >
                    <span className="text-xs text-muted-foreground/70 capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <code className="text-xs font-medium text-foreground">{value}</code>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OptimizationApprovalModal({
  open,
  onClose,
  onApprove,
  optimization,
  gameName,
  loading = false,
}: OptimizationApprovalModalProps) {
  const [understood, setUnderstood] = useState(false);

  const settings = optimization.settings as Record<string, unknown> || {};
  const graphics = settings.graphics as Record<string, string> | undefined;
  const launchOptions = settings.launch_options as string | undefined;
  const priority = settings.priority as string | undefined;

  const settingsCount =
    (graphics ? Object.keys(graphics).length : 0) +
    (launchOptions ? 1 : 0) +
    (priority ? 1 : 0);

  // Reset state when modal opens
  const handleClose = () => {
    setUnderstood(false);
    onClose();
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
              className="w-full max-w-lg glass-strong rounded-2xl border border-warning/30 overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-warning/5 border-b border-warning/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-10 h-10 rounded-full bg-warning/15 flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.5, delay: 0.1 }}
                    >
                      <Shield className="w-5 h-5 text-warning" strokeWidth={2} />
                    </motion.div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Review Changes
                      </h2>
                      <p className="text-sm text-muted-foreground/70">{gameName}</p>
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
              <ScrollArea className="max-h-[50vh]">
                <div className="p-6 space-y-4">
                  {/* Warning Notice */}
                  <div className="flex items-start gap-3 p-4 glass-subtle rounded-xl border border-warning/20">
                    <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" strokeWidth={2} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Please review the following changes
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {settingsCount} optimization{settingsCount !== 1 ? 's' : ''} will be applied.
                        You can revert these changes at any time.
                      </p>
                    </div>
                  </div>

                  {/* Settings Preview */}
                  <div className="space-y-3">
                    {graphics && Object.keys(graphics).length > 0 && (
                      <SettingPreview type="graphics" settings={graphics} />
                    )}
                    {launchOptions && (
                      <SettingPreview type="launch_options" settings={launchOptions} />
                    )}
                    {priority && (
                      <SettingPreview type="priority" settings={priority} />
                    )}
                  </div>

                  {/* Source Indicator */}
                  <div className="flex items-center gap-2 p-3 glass-subtle rounded-xl border border-border/20">
                    <Info className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    <span className="text-xs text-muted-foreground/70">
                      Source:{' '}
                      <span className={cn(
                        'font-medium',
                        optimization.source === 'database' ? 'text-success' :
                        optimization.source === 'ai' ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        {optimization.source === 'database' ? 'Community Verified' :
                         optimization.source === 'ai' ? 'AI Generated' : 'Generic Tips'}
                      </span>
                      {optimization.confidence && (
                        <span className="text-muted-foreground/50">
                          {' '}({optimization.confidence} confidence)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Consent Checkbox */}
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <Checkbox
                      checked={understood}
                      onCheckedChange={(checked: boolean) => setUnderstood(checked)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-muted-foreground/70 group-hover:text-foreground transition-colors">
                      I understand these changes will modify my game settings and I can revert them if needed.
                    </span>
                  </label>
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/20 flex items-center justify-end gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={loading}
                    className="glass-subtle rounded-xl border-border/30"
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={() => {
                      onApprove();
                    }}
                    disabled={!understood || loading}
                    className={cn(
                      'gap-1.5 rounded-xl',
                      'bg-gradient-to-r from-success to-primary',
                      'shadow-[0_0_16px_-4px_hsl(var(--glow-success)/0.5)]',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {loading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" strokeWidth={2} />
                        Apply Optimizations
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

export default OptimizationApprovalModal;
