/**
 * EditablePreferences - Panel for viewing and managing learned preferences.
 *
 * Allows users to enable/disable preferences, adjust priority values,
 * and delete preferences they no longer want Opta to use.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLearning, type LearnedPreference } from '../hooks/useLearning';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Trash2, ToggleLeft, ToggleRight, X, Brain, AlertTriangle } from 'lucide-react';

export interface EditablePreferencesProps {
  /** Additional CSS classes */
  className?: string;
}

/**
 * Individual preference card with edit controls.
 */
function PreferenceCard({
  preference,
  onToggle,
  onDelete,
  onValueChange,
}: {
  preference: LearnedPreference;
  onToggle: () => void;
  onDelete: () => void;
  onValueChange?: (value: number) => void;
}) {
  return (
    <motion.div
      className={cn(
        'glass-subtle rounded-lg p-4 border border-border/20',
        !preference.enabled && 'opacity-60'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{preference.name}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{preference.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
              preference.confidence >= 80
                ? 'bg-success/15 text-success border border-success/30'
                : preference.confidence >= 50
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-muted/30 text-muted-foreground border border-border/30'
            )}>
              {preference.confidence}% confident
            </span>
            <span className="text-[10px] text-muted-foreground/50">
              {preference.sampleCount} samples
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 rounded-lg"
              title={preference.enabled ? 'Disable preference' : 'Enable preference'}
            >
              {preference.enabled ? (
                <ToggleRight className="w-5 h-5 text-success" strokeWidth={1.75} />
              ) : (
                <ToggleLeft className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
              )}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-8 w-8 rounded-lg hover:text-danger"
              title="Delete preference"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Priority slider for priority-type preferences */}
      {preference.type === 'priority' && preference.enabled && preference.value !== undefined && (
        <motion.div
          className="mt-4 pt-3 border-t border-border/20"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground/70">
              Priority: {preference.value}%
            </label>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={preference.value}
            onChange={(e) => onValueChange?.(parseInt(e.target.value, 10))}
            className={cn(
              'w-full h-2 rounded-full appearance-none cursor-pointer',
              'bg-muted/30',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-primary',
              '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary-foreground',
              '[&::-webkit-slider-thumb]:cursor-pointer',
              '[&::-webkit-slider-thumb]:shadow-md',
              '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4',
              '[&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:bg-primary',
              '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary-foreground',
              '[&::-moz-range-thumb]:cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-primary/50'
            )}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Empty state when no preferences exist.
 */
function EmptyPreferencesState() {
  return (
    <motion.div
      className="py-8 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className={cn(
          'w-14 h-14 mx-auto flex items-center justify-center rounded-full mb-4',
          'glass border border-border/30'
        )}
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Brain className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
      </motion.div>
      <h4 className="text-sm font-medium text-foreground mb-2">
        No Preferences Yet
      </h4>
      <p className="text-xs text-muted-foreground/60 max-w-[280px] mx-auto">
        Opta will learn your preferences as you use the app.
      </p>
    </motion.div>
  );
}

/**
 * Confirmation dialog for clearing all preferences.
 */
function ClearConfirmation({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="glass-subtle rounded-lg p-4 border border-warning/30 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              'bg-warning/15 border border-warning/30'
            )}>
              <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.75} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Clear all preferences?</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                This will disable all learned preferences. Opta will stop using these patterns until it learns new ones.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancel}
                    className="glass-subtle rounded-lg border-border/30"
                  >
                    Cancel
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={onConfirm}
                    className="rounded-lg gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Clear All
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * EditablePreferences component.
 * Allows users to manage their learned preferences.
 */
export function EditablePreferences({ className }: EditablePreferencesProps) {
  const {
    learnedPreferences,
    loading,
    updatePreference,
    deletePreference,
    deleteAllPreferences,
  } = useLearning();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Filter to only show enabled preferences (deleted ones are hidden)
  const visiblePreferences = learnedPreferences.filter(p => p.enabled || true); // Show all for now

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded bg-muted/30 animate-shimmer" />
          <div className="h-8 w-24 rounded bg-muted/30 animate-shimmer" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-subtle rounded-lg p-4 animate-pulse border border-border/20">
              <div className="h-4 bg-muted/20 rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted/20 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Your Preferences</h3>
        {visiblePreferences.length > 0 && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="gap-1.5 glass-subtle rounded-lg border-border/30 hover:text-danger hover:border-danger/30"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Clear All
            </Button>
          </motion.div>
        )}
      </div>

      {/* Clear confirmation */}
      <ClearConfirmation
        visible={showClearConfirm}
        onConfirm={() => {
          deleteAllPreferences();
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Preferences list or empty state */}
      {visiblePreferences.length === 0 ? (
        <EmptyPreferencesState />
      ) : (
        <motion.div className="space-y-2" layout>
          <AnimatePresence mode="popLayout">
            {visiblePreferences.map(pref => (
              <PreferenceCard
                key={pref.id}
                preference={pref}
                onToggle={() => updatePreference(pref.id, { enabled: !pref.enabled })}
                onDelete={() => deletePreference(pref.id)}
                onValueChange={(value) => updatePreference(pref.id, { value })}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

export default EditablePreferences;
