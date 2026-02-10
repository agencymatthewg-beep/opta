/**
 * CloneSettings - Configure the personalized AI clone behavior.
 *
 * Features:
 * - Enable/disable clone mode
 * - Base skill level slider
 * - Style intensity (how much to mimic user)
 * - Humanization (randomness/imperfection)
 * - Opening repertoire preference
 * - Time management mimicking
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { motion } from 'framer-motion';
import {
  Cpu,
  User,
  Sliders,
  Sparkles,
  BookOpen,
  Clock,
  Power,
  Info,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CloneAISettings, PlayStyleMetrics, StyleArchetype } from '@/lib/chess/style/types';
import { DEFAULT_CLONE_SETTINGS } from '@/lib/chess/style/types';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface CloneSettingsProps {
  /** Current clone settings */
  settings: CloneAISettings;
  /** Update settings callback */
  onSettingsChange: (settings: CloneAISettings) => void;
  /** User's style metrics (for preview) */
  userMetrics?: PlayStyleMetrics | null;
  /** User's archetype */
  archetype?: StyleArchetype | null;
  /** Number of games analyzed */
  gamesAnalyzed?: number;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Skill level descriptions.
 */
const SKILL_DESCRIPTIONS: Record<number, { label: string; description: string }> = {
  0: { label: 'Beginner', description: 'Makes obvious mistakes' },
  5: { label: 'Casual', description: 'Club player level' },
  10: { label: 'Intermediate', description: 'Strong amateur' },
  15: { label: 'Advanced', description: 'Expert level play' },
  20: { label: 'Maximum', description: 'Near-perfect chess' },
};

/**
 * Get skill description for a level.
 */
function getSkillDescription(level: number): { label: string; description: string } {
  // Find nearest defined level
  const levels = Object.keys(SKILL_DESCRIPTIONS).map(Number);
  const nearest = levels.reduce((prev, curr) =>
    Math.abs(curr - level) < Math.abs(prev - level) ? curr : prev
  );
  return SKILL_DESCRIPTIONS[nearest];
}

/**
 * Slider component with label and value display.
 */
function SettingSlider({
  label,
  icon: Icon,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
  description,
  disabled = false,
}: {
  label: string;
  icon: typeof Sliders;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  description?: string;
  disabled?: boolean;
}) {
  const displayValue = formatValue ? formatValue(value) : value.toString();

  return (
    <div className={cn('space-y-2', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground/60" strokeWidth={1.75} />
          <span className="text-sm text-foreground">{label}</span>
        </div>
        <span className="text-sm font-medium text-primary tabular-nums">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn(
          'w-full h-1.5 rounded-full appearance-none cursor-pointer',
          'bg-white/10',
          '[&::-webkit-slider-thumb]:appearance-none',
          '[&::-webkit-slider-thumb]:w-4',
          '[&::-webkit-slider-thumb]:h-4',
          '[&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:bg-primary',
          '[&::-webkit-slider-thumb]:shadow-md',
          '[&::-webkit-slider-thumb]:cursor-pointer',
          '[&::-webkit-slider-thumb]:transition-transform',
          '[&::-webkit-slider-thumb]:hover:scale-110',
          '[&::-moz-range-thumb]:w-4',
          '[&::-moz-range-thumb]:h-4',
          '[&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:bg-primary',
          '[&::-moz-range-thumb]:border-none',
          '[&::-moz-range-thumb]:cursor-pointer'
        )}
      />
      {description && <p className="text-xs text-muted-foreground/50">{description}</p>}
    </div>
  );
}

/**
 * Toggle switch component.
 */
function SettingToggle({
  label,
  icon: Icon,
  checked,
  onChange,
  description,
  disabled = false,
}: {
  label: string;
  icon: typeof Sliders;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn('space-y-1', disabled && 'opacity-50 pointer-events-none')}>
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between p-3 rounded-lg',
          'transition-colors',
          checked ? 'bg-primary/10 border border-primary/20' : 'bg-white/5 border border-white/[0.06]'
        )}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={cn('w-4 h-4', checked ? 'text-primary' : 'text-muted-foreground/60')}
            strokeWidth={1.75}
          />
          <span className={cn('text-sm', checked ? 'text-foreground' : 'text-muted-foreground/70')}>
            {label}
          </span>
        </div>
        <div
          className={cn(
            'w-10 h-5 rounded-full p-0.5 transition-colors',
            checked ? 'bg-primary' : 'bg-white/20'
          )}
        >
          <motion.div
            animate={{ x: checked ? 20 : 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-4 h-4 rounded-full bg-white shadow-sm"
          />
        </div>
      </motion.button>
      {description && <p className="text-xs text-muted-foreground/50 px-1">{description}</p>}
    </div>
  );
}

/**
 * CloneSettings component.
 */
export function CloneSettings({
  settings,
  onSettingsChange,
  userMetrics,
  archetype,
  gamesAnalyzed = 0,
  compact = false,
}: CloneSettingsProps) {
  const skillInfo = getSkillDescription(settings.baseSkillLevel);
  const hasEnoughGames = gamesAnalyzed >= 5;

  /**
   * Update a single setting.
   */
  const updateSetting = <K extends keyof CloneAISettings>(key: K, value: CloneAISettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  /**
   * Reset to defaults.
   */
  const resetToDefaults = () => {
    onSettingsChange(DEFAULT_CLONE_SETTINGS);
  };

  if (compact) {
    // Compact mode for widget
    return (
      <div className="space-y-3">
        {/* Enable toggle */}
        <SettingToggle
          label="Clone Mode"
          icon={Cpu}
          checked={settings.enabled}
          onChange={(v) => updateSetting('enabled', v)}
          disabled={!hasEnoughGames}
        />

        {settings.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {/* Style intensity */}
            <SettingSlider
              label="Style Intensity"
              icon={User}
              value={settings.styleIntensity}
              min={0}
              max={100}
              onChange={(v) => updateSetting('styleIntensity', v)}
              formatValue={(v) => `${v}%`}
            />

            {/* Skill level */}
            <SettingSlider
              label="Skill Level"
              icon={Zap}
              value={settings.baseSkillLevel}
              min={0}
              max={20}
              onChange={(v) => updateSetting('baseSkillLevel', v)}
              formatValue={() => skillInfo.label}
            />
          </motion.div>
        )}

        {!hasEnoughGames && (
          <p className="text-xs text-warning/70 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" strokeWidth={1.75} />
            Import at least 5 games to enable
          </p>
        )}
      </div>
    );
  }

  // Full settings panel
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: smoothOut }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Cpu className="w-5 h-5 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-lg font-medium text-foreground">Personal AI Clone</h3>
            <p className="text-sm text-muted-foreground/60">
              Train an AI to play like you
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={resetToDefaults}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs',
            'text-muted-foreground/60 hover:text-muted-foreground',
            'bg-white/5 hover:bg-white/10 transition-colors'
          )}
        >
          Reset
        </motion.button>
      </div>

      {/* Not enough games warning */}
      {!hasEnoughGames && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20"
        >
          <Info className="w-5 h-5 text-warning mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="text-sm text-foreground">Need more games</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Import at least 5 games to enable the AI clone. Currently have {gamesAnalyzed}.
            </p>
          </div>
        </motion.div>
      )}

      {/* Main toggle */}
      <div className="glass rounded-xl p-4 border border-white/[0.06]">
        <SettingToggle
          label="Enable AI Clone"
          icon={Power}
          checked={settings.enabled}
          onChange={(v) => updateSetting('enabled', v)}
          description="Play against an AI that mimics your playing style"
          disabled={!hasEnoughGames}
        />
      </div>

      {/* Settings (disabled when clone is off) */}
      <motion.div
        animate={{ opacity: settings.enabled ? 1 : 0.5 }}
        className="space-y-4"
      >
        {/* Skill and Style */}
        <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-5">
          <h4 className="text-sm font-medium text-muted-foreground/70">AI Strength</h4>

          <SettingSlider
            label="Base Skill Level"
            icon={Zap}
            value={settings.baseSkillLevel}
            min={0}
            max={20}
            onChange={(v) => updateSetting('baseSkillLevel', v)}
            formatValue={() => skillInfo.label}
            description={skillInfo.description}
            disabled={!settings.enabled}
          />

          <SettingSlider
            label="Style Intensity"
            icon={User}
            value={settings.styleIntensity}
            min={0}
            max={100}
            step={5}
            onChange={(v) => updateSetting('styleIntensity', v)}
            formatValue={(v) => `${v}%`}
            description={
              settings.styleIntensity === 0
                ? 'Pure Stockfish play'
                : settings.styleIntensity === 100
                  ? 'Maximum style mimicking'
                  : 'Blend of optimal and style-weighted moves'
            }
            disabled={!settings.enabled}
          />

          <SettingSlider
            label="Humanization"
            icon={Sparkles}
            value={settings.humanization}
            min={0}
            max={100}
            step={5}
            onChange={(v) => updateSetting('humanization', v)}
            formatValue={(v) => `${v}%`}
            description="Add randomness for more human-like play"
            disabled={!settings.enabled}
          />
        </div>

        {/* Behavior toggles */}
        <div className="glass rounded-xl p-4 border border-white/[0.06] space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground/70">Behavior</h4>

          <SettingToggle
            label="Use My Opening Repertoire"
            icon={BookOpen}
            checked={settings.useOpeningRepertoire}
            onChange={(v) => updateSetting('useOpeningRepertoire', v)}
            description="Prefer openings you frequently play"
            disabled={!settings.enabled}
          />

          <SettingToggle
            label="Mimic Time Management"
            icon={Clock}
            checked={settings.mimicTimeManagement}
            onChange={(v) => updateSetting('mimicTimeManagement', v)}
            description="Match your time usage patterns"
            disabled={!settings.enabled}
          />
        </div>

        {/* Style preview */}
        {userMetrics && settings.enabled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4 border border-white/[0.06]"
          >
            <h4 className="text-sm font-medium text-muted-foreground/70 mb-3">Clone Profile</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground/50">Archetype</span>
                <p className="text-foreground font-medium capitalize">{archetype}</p>
              </div>
              <div>
                <span className="text-muted-foreground/50">Games Learned</span>
                <p className="text-foreground font-medium">{gamesAnalyzed}</p>
              </div>
              <div>
                <span className="text-muted-foreground/50">Aggression</span>
                <p className="text-foreground font-medium">{userMetrics.aggression}/100</p>
              </div>
              <div>
                <span className="text-muted-foreground/50">Tactical</span>
                <p className="text-foreground font-medium">{userMetrics.tactical}/100</p>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default CloneSettings;
