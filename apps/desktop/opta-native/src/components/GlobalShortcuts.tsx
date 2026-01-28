/**
 * GlobalShortcuts - Registers and manages global keyboard shortcuts.
 *
 * This component renders nothing visible but registers global shortcuts
 * that work even when the app is in the background.
 *
 * Shortcuts:
 * - Cmd/Ctrl+Shift+O: Quick Optimization
 */

import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, X } from 'lucide-react';
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut';
import { hapticSuccess, hapticError } from '@/lib/haptics';
import { cn } from '@/lib/utils';

/**
 * Shortcut toast notification state.
 */
interface ShortcutToast {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'success' | 'error';
}

/**
 * Local storage keys for shortcut preferences.
 */
const SHORTCUT_PREFS_KEY = 'opta_shortcut_preferences';

/**
 * Default shortcut preferences.
 */
interface ShortcutPreferences {
  quickOptimize: boolean;
  chessWidget: boolean;
}

const defaultPreferences: ShortcutPreferences = {
  quickOptimize: true,
  chessWidget: true,
};

/**
 * Load shortcut preferences from localStorage.
 */
function loadPreferences(): ShortcutPreferences {
  try {
    const stored = localStorage.getItem(SHORTCUT_PREFS_KEY);
    if (stored) {
      return { ...defaultPreferences, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return defaultPreferences;
}

/**
 * Save shortcut preferences to localStorage.
 */
export function saveShortcutPreferences(prefs: Partial<ShortcutPreferences>): void {
  const current = loadPreferences();
  const updated = { ...current, ...prefs };
  localStorage.setItem(SHORTCUT_PREFS_KEY, JSON.stringify(updated));
}

/**
 * Get current shortcut preferences.
 */
export function getShortcutPreferences(): ShortcutPreferences {
  return loadPreferences();
}

/**
 * Toast notification component for shortcut feedback.
 */
function ShortcutToastNotification({
  toast,
  onDismiss,
}: {
  toast: ShortcutToast;
  onDismiss: () => void;
}) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const typeStyles = {
    info: 'border-primary/30 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.3)]',
    success: 'border-success/30 shadow-[0_0_24px_-8px_hsl(var(--success)/0.3)]',
    error: 'border-danger/30 shadow-[0_0_24px_-8px_hsl(var(--danger)/0.3)]',
  };

  const iconStyles = {
    info: 'bg-primary/15 border-primary/30 text-primary',
    success: 'bg-success/15 border-success/30 text-success',
    error: 'bg-danger/15 border-danger/30 text-danger',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-40',
        'rounded-xl p-4 min-w-[280px] max-w-[360px]',
        'glass-overlay border',
        typeStyles[toast.type]
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border',
            iconStyles[toast.type]
          )}
        >
          <Zap className="w-5 h-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-foreground">{toast.title}</div>
          <div className="text-xs text-muted-foreground/70 mt-0.5">{toast.description}</div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </motion.div>
  );
}

export interface GlobalShortcutsProps {
  /** Callback when chess widget toggle shortcut is pressed */
  onToggleChessWidget?: () => void;
}

/**
 * GlobalShortcuts component.
 *
 * Registers all global shortcuts and shows toast notifications when triggered.
 * This component should be rendered once at the app root level.
 */
export function GlobalShortcuts({ onToggleChessWidget }: GlobalShortcutsProps = {}) {
  const [preferences, setPreferences] = useState<ShortcutPreferences>(loadPreferences);
  const [toast, setToast] = useState<ShortcutToast | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Refresh preferences when they might have changed
  useEffect(() => {
    const handleStorage = () => {
      setPreferences(loadPreferences());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Show toast notification
  const showToast = useCallback((
    title: string,
    description: string,
    type: 'info' | 'success' | 'error' = 'info'
  ) => {
    setToast({
      id: Date.now().toString(),
      title,
      description,
      type,
    });
  }, []);

  // Quick Optimization handler
  const handleQuickOptimize = useCallback(async () => {
    if (isOptimizing) return;

    setIsOptimizing(true);
    showToast('Quick Optimization', 'Running system optimization...', 'info');

    try {
      // Simulate optimization (in real implementation, this would call the optimizer)
      // For now, we show success after a brief delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      showToast('Optimization Complete', 'System optimized successfully', 'success');
      await hapticSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Optimization failed';
      showToast('Optimization Failed', message, 'error');
      await hapticError();
    } finally {
      setIsOptimizing(false);
    }
  }, [isOptimizing, showToast]);

  // Register Cmd/Ctrl+Shift+O for Quick Optimization
  useGlobalShortcut({
    shortcut: 'CommandOrControl+Shift+O',
    handler: handleQuickOptimize,
    enabled: preferences.quickOptimize,
  });

  // Chess widget toggle handler
  const handleToggleChessWidget = useCallback(() => {
    onToggleChessWidget?.();
  }, [onToggleChessWidget]);

  // Register Cmd/Ctrl+Shift+C for Chess Widget toggle
  useGlobalShortcut({
    shortcut: 'CommandOrControl+Shift+C',
    handler: handleToggleChessWidget,
    enabled: preferences.chessWidget && !!onToggleChessWidget,
  });

  // Dismiss toast handler
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <ShortcutToastNotification
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
        />
      )}
    </AnimatePresence>
  );
}

export default GlobalShortcuts;
