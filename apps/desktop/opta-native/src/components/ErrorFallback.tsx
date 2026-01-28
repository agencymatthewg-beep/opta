/**
 * ErrorFallback - Display when an error boundary catches an error.
 *
 * Follows DESIGN_SYSTEM.md Obsidian Standard:
 * - Obsidian glass surfaces with danger energy glow
 * - Framer Motion with smoothOut easing
 * - Lucide icons
 */

// Smooth deceleration easing for premium feel
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

/**
 * ErrorFallback - Fallback UI for error states.
 */
function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyError = async () => {
    if (error) {
      const errorText = `${error.name}: ${error.message}\n\n${error.stack || 'No stack trace available'}`;
      await navigator.clipboard.writeText(errorText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        className={cn(
          'relative w-full max-w-lg p-8 rounded-2xl',
          'glass-strong',
          'border border-danger/30',
          'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
          'before:bg-gradient-to-r before:from-transparent before:via-danger/20 before:to-transparent',
          'shadow-[inset_0_0_20px_rgba(239,68,68,0.05),0_0_48px_-12px_rgba(239,68,68,0.3)]'
        )}
        initial={{ opacity: 0, scale: 0.95, y: 20, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'brightness(1)' }}
        transition={{ duration: 0.4, ease: smoothOut }}
      >
        {/* Error Icon */}
        <motion.div
          className="flex justify-center mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
        >
          <div
            className={cn(
              'w-16 h-16 flex items-center justify-center rounded-full',
              'bg-danger/15 border-2 border-danger/30'
            )}
          >
            <AlertTriangle className="w-8 h-8 text-danger" strokeWidth={1.75} />
          </div>
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-xl font-semibold text-center text-foreground mb-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Something went wrong
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-sm text-center text-muted-foreground/70 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Opta encountered an unexpected error. Try resetting or restarting the app.
        </motion.p>

        {/* Error Details */}
        {error && (
          <motion.div
            className="mb-6 rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="px-4 py-2 border-b border-white/[0.04] flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                Error Details
              </span>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyError}
                  className="h-7 px-2 text-xs gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-success" strokeWidth={2} />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" strokeWidth={2} />
                      Copy
                    </>
                  )}
                </Button>
              </motion.div>
            </div>
            <div className="p-4 max-h-40 overflow-auto">
              <p className="text-sm font-medium text-danger mb-1">
                {error.name}: {error.message}
              </p>
              {error.stack && (
                <pre className="text-xs text-muted-foreground/60 whitespace-pre-wrap font-mono leading-relaxed">
                  {error.stack.split('\n').slice(1, 6).join('\n')}
                </pre>
              )}
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          className="flex flex-col gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={onReset}
              className={cn(
                'w-full gap-2 rounded-xl',
                'bg-gradient-to-r from-primary to-accent',
                'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
              )}
            >
              <RefreshCw className="w-4 h-4" strokeWidth={2} />
              Try Again
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full gap-2 rounded-xl bg-white/[0.02] border-white/[0.06]"
            >
              Restart App
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default ErrorFallback;
