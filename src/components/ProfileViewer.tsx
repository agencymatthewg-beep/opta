/**
 * ProfileViewer - The Obsidian User Profile
 *
 * Displays user profile with obsidian glass styling and energy accents.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState } from 'react';

import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

import type {
  UserProfile,
  UserMode,
  OptimizationDepth,
  CommunicationStyle,
  OptimizationPattern,
} from '../types/profile';

import {
  User,
  Settings,
  Brain,
  Trash2,
  Edit2,
  Save,
  X,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ProfileViewerProps {
  profile: UserProfile | null;
  onUpdate: (updates: Partial<UserProfile>) => Promise<UserProfile | void>;
  onDelete: () => void;
  loading?: boolean;
}

/**
 * Helper to format timestamps into readable dates.
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Empty state when no profile exists yet.
 */
function EmptyProfileState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-12 text-center"
      initial={{ opacity: 0, scale: 0.95, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
    >
      <motion.div
        className={cn(
          "w-16 h-16 flex items-center justify-center rounded-full mb-6",
          "bg-[#05030a]/60 backdrop-blur-xl",
          "border border-white/[0.06]"
        )}
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <User className="w-7 h-7 text-muted-foreground/40" strokeWidth={1.5} />
      </motion.div>
      <h3 className="text-lg font-medium text-foreground mb-2">No Profile Yet</h3>
      <p className="text-sm text-muted-foreground/70 max-w-sm">
        Use Opta to optimize your games and your profile will be created automatically.
      </p>
    </motion.div>
  );
}

interface PreferenceRowProps {
  label: string;
  value: string;
  editing: boolean;
  options: string[];
  descriptions: Record<string, string>;
  onChange: (value: string) => void;
}

/**
 * A single row in the preferences section showing a label and value/dropdown.
 */
function PreferenceRow({
  label,
  value,
  editing,
  options,
  descriptions,
  onChange,
}: PreferenceRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {!editing && (
          <div className="text-xs text-muted-foreground/60 mt-0.5">
            {descriptions[value]}
          </div>
        )}
      </div>
      {editing ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'px-3 py-1.5 text-sm rounded-lg',
            // Obsidian subtle glass
            'bg-white/[0.02] border border-white/[0.06]',
            'text-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40',
            'focus:shadow-[0_0_12px_-4px_rgba(168,85,247,0.3)]',
            'transition-all duration-200',
            'cursor-pointer'
          )}
        >
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-card text-foreground">
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </option>
          ))}
        </select>
      ) : (
        <span
          className={cn(
            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
            'bg-primary/15 text-primary border border-primary/30'
          )}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      )}
    </div>
  );
}

interface PatternCardProps {
  pattern: OptimizationPattern;
}

/**
 * Card displaying a single learned pattern.
 */
function PatternCard({ pattern }: PatternCardProps) {
  const confidencePercent = Math.round(pattern.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: smoothOut }}
      className={cn(
        "rounded-lg p-3",
        // Obsidian subtle glass
        "bg-white/[0.02] border border-white/[0.04]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            pattern.patternType === 'preference'
              ? 'bg-success/10 text-success'
              : pattern.patternType === 'aversion'
                ? 'bg-warning/10 text-warning'
                : 'bg-primary/10 text-primary'
          )}
        >
          {pattern.patternType === 'preference' ? (
            <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
          ) : pattern.patternType === 'aversion' ? (
            <X className="w-4 h-4" strokeWidth={1.75} />
          ) : (
            <Clock className="w-4 h-4" strokeWidth={1.75} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{pattern.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/60">
            <span>{confidencePercent}% confidence</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            <span>{pattern.sampleCount} samples</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
}

/**
 * A single statistic item.
 */
function StatItem({ label, value }: StatItemProps) {
  return (
    <div className={cn(
      "rounded-lg p-3 text-center",
      // Obsidian subtle glass
      "bg-white/[0.02] border border-white/[0.04]"
    )}>
      <div className="text-lg font-bold text-foreground tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">
        {label}
      </div>
    </div>
  );
}

/**
 * ProfileViewer displays all stored profile data with edit capability.
 */
export function ProfileViewer({
  profile,
  onUpdate,
  onDelete,
  loading,
}: ProfileViewerProps) {
  const [editing, setEditing] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return <EmptyProfileState />;
  }

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(pendingChanges);
      setPendingChanges({});
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPendingChanges({});
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Preferences Section */}
      <div className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={1.75} />
            <h3 className="text-sm font-medium">Your Preferences</h3>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => (editing ? handleCancel() : setEditing(true))}
              disabled={loading || saving}
            >
              {editing ? (
                <X className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <Edit2 className="w-4 h-4" strokeWidth={1.75} />
              )}
            </Button>
          </motion.div>
        </div>

        <div className="space-y-1 divide-y divide-white/[0.05]">
          <PreferenceRow
            label="User Mode"
            value={pendingChanges.userMode ?? profile.userMode}
            editing={editing}
            options={['simple', 'standard', 'power']}
            descriptions={{
              simple: 'Safer optimizations, plain language',
              standard: 'Balanced approach (recommended)',
              power: 'Full control, all options unlocked',
            }}
            onChange={(v) =>
              setPendingChanges((prev) => ({ ...prev, userMode: v as UserMode }))
            }
          />
          <PreferenceRow
            label="Optimization Depth"
            value={pendingChanges.optimizationDepth ?? profile.optimizationDepth}
            editing={editing}
            options={['efficient', 'thorough', 'optimised']}
            descriptions={{
              efficient: 'Quick, minimal questions',
              thorough: 'Balanced analysis',
              optimised: 'Maximum detail, best results',
            }}
            onChange={(v) =>
              setPendingChanges((prev) => ({
                ...prev,
                optimizationDepth: v as OptimizationDepth,
              }))
            }
          />
          <PreferenceRow
            label="Communication Style"
            value={pendingChanges.communicationStyle ?? profile.communicationStyle}
            editing={editing}
            options={['informative', 'concise']}
            descriptions={{
              informative: 'Explains the why behind changes',
              concise: 'Just the facts, faster interactions',
            }}
            onChange={(v) =>
              setPendingChanges((prev) => ({
                ...prev,
                communicationStyle: v as CommunicationStyle,
              }))
            }
          />
        </div>

        {editing && Object.keys(pendingChanges).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end gap-2 mt-4 pt-4 border-t border-white/[0.05]"
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button size="sm" onClick={handleSave} disabled={saving} className="rounded-lg">
                {saving ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" strokeWidth={1.75} />
                    Save Changes
                  </>
                )}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Learned Patterns Section */}
      <div className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={1.75} />
          <h3 className="text-sm font-medium">What Opta Has Learned</h3>
        </div>

        {profile.patterns.length === 0 ? (
          <div className="flex items-center gap-3 py-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/[0.04]">
              <Sparkles className="w-5 h-5 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <p className="text-sm text-muted-foreground/70">
              No patterns detected yet. Use Opta more to see personalized insights.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {profile.patterns.map((pattern, i) => (
              <PatternCard key={i} pattern={pattern} />
            ))}
          </div>
        )}
      </div>

      {/* Statistics Section */}
      <div className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        // Obsidian glass material
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]",
        // Inner specular highlight
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
      )}>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]" strokeWidth={1.75} />
          <h3 className="text-sm font-medium">Your Stats</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatItem label="Total Optimizations" value={profile.totalOptimizations} />
          <StatItem label="Games Optimized" value={profile.totalGamesOptimized} />
          <StatItem label="Accepted" value={profile.optimizationsAccepted} />
          <StatItem label="Reverted" value={profile.optimizationsReverted} />
        </div>
        <div className="mt-3">
          <StatItem label="Member Since" value={formatDate(profile.createdAt)} />
        </div>
      </div>

      {/* Delete Data Section */}
      <div className={cn(
        "relative rounded-xl p-4 overflow-hidden",
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-danger/30",
        "shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-danger">Delete All Data</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Remove all stored preferences, patterns, and history
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={loading}
              className="rounded-lg"
            >
              <Trash2 className="w-4 h-4 mr-1" strokeWidth={1.75} />
              Delete
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export default ProfileViewer;
