/**
 * ModalErrorBoundary - Error boundary for modal/dialog content.
 *
 * Provides a compact error fallback that fits within modal contexts,
 * allowing users to close the modal or retry without taking over the screen.
 *
 * @see DESIGN_SYSTEM.md - Error handling patterns
 */

import React, { Component, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Smooth deceleration easing
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface ModalErrorBoundaryProps {
  children: ReactNode;
  /** Callback when user clicks "Close" - typically closes the modal */
  onClose?: () => void;
  /** Custom fallback component */
  fallback?: ReactNode;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Compact error fallback for modal content
 */
function ModalErrorFallback({
  error,
  onReset,
  onClose,
}: {
  error: Error | null;
  onReset: () => void;
  onClose?: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center p-6 min-h-[200px]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: smoothOut }}
    >
      {/* Error Icon */}
      <div
        className={cn(
          'w-12 h-12 flex items-center justify-center rounded-full mb-4',
          'bg-danger/15 border border-danger/30'
        )}
      >
        <AlertTriangle className="w-6 h-6 text-danger" strokeWidth={1.75} />
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-foreground mb-1">
        Something went wrong
      </h3>

      {/* Error message */}
      <p className="text-sm text-muted-foreground/70 text-center mb-4 max-w-[280px]">
        {error?.message || 'An unexpected error occurred'}
      </p>

      {/* Actions */}
      <div className="flex gap-2">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onReset}
            size="sm"
            className="gap-1.5 rounded-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
            Retry
          </Button>
        </motion.div>
        {onClose && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-lg bg-white/[0.02] border-white/[0.06]"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
              Close
            </Button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * ModalErrorBoundary - Catches errors in modal content
 *
 * Usage:
 * ```tsx
 * <Dialog open={isOpen} onOpenChange={setIsOpen}>
 *   <DialogContent>
 *     <ModalErrorBoundary onClose={() => setIsOpen(false)}>
 *       <MyModalContent />
 *     </ModalErrorBoundary>
 *   </DialogContent>
 * </Dialog>
 * ```
 */
class ModalErrorBoundary extends Component<ModalErrorBoundaryProps, ModalErrorBoundaryState> {
  state: ModalErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ModalErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Modal error boundary caught:', error, info.componentStack);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { children, onClose, fallback } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      if (fallback) {
        return fallback;
      }
      return (
        <ModalErrorFallback
          error={error}
          onReset={this.handleReset}
          onClose={onClose}
        />
      );
    }

    return children;
  }
}

export { ModalErrorBoundary, ModalErrorFallback };
export default ModalErrorBoundary;
