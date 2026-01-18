/**
 * ChessSettingsPanel - Board and Theme Customization Panel
 *
 * Provides comprehensive chess board customization:
 * - Board theme selection (obsidian, wood, marble, glass)
 * - Preset themes (Classic, Nature, Cosmos, Opta Dark)
 * - Visual display options (coordinates, lighting)
 *
 * Follows DESIGN_SYSTEM.md with glass effects and Framer Motion.
 *
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Palette, Sparkles, Eye, Check, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeSelector } from '../premium/ThemeSelector';
import type { BoardThemeId } from '@/types/boardTheme';
import type { ChessSettings, ChessSoundSettings } from '@/types/chess';

/**
 * Preset theme configuration
 * Each preset combines board theme with recommended display options
 */
export interface PresetTheme {
  id: string;
  name: string;
  description: string;
  boardTheme: BoardThemeId;
  showCoordinates: boolean;
  showLighting: boolean;
  /** Preview gradient for preset card */
  previewGradient: string;
  /** Accent color for selection state */
  accentColor: string;
}

/**
 * Available preset themes
 */
export const presetThemes: PresetTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional wood aesthetics',
    boardTheme: 'wood',
    showCoordinates: true,
    showLighting: false,
    previewGradient: 'linear-gradient(135deg, hsl(35, 35%, 65%) 0%, hsl(25, 45%, 30%) 100%)',
    accentColor: 'hsl(35, 50%, 50%)',
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Elegant marble serenity',
    boardTheme: 'marble',
    showCoordinates: true,
    showLighting: true,
    previewGradient: 'linear-gradient(135deg, hsl(0, 0%, 92%) 0%, hsl(210, 10%, 35%) 100%)',
    accentColor: 'hsl(210, 30%, 60%)',
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    description: 'Transparent glass depths',
    boardTheme: 'glass',
    showCoordinates: false,
    showLighting: true,
    previewGradient: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(100,150,200,0.2) 100%)',
    accentColor: 'hsl(200, 60%, 60%)',
  },
  {
    id: 'opta-dark',
    name: 'Opta Dark',
    description: 'Premium obsidian experience',
    boardTheme: 'obsidian',
    showCoordinates: true,
    showLighting: true,
    previewGradient: 'linear-gradient(135deg, hsl(270, 20%, 18%) 0%, hsl(270, 30%, 12%) 100%)',
    accentColor: 'hsl(270, 70%, 60%)',
  },
];

export interface ChessSettingsPanelProps {
  /** Current chess settings */
  settings: ChessSettings;
  /** Callback when settings change */
  onSettingsChange: (updates: Partial<ChessSettings>) => void;
  /** Compact mode for widget integration */
  compact?: boolean;
  /** Show only theme section */
  themeOnly?: boolean;
}

/**
 * Preset theme card with preview
 */
function PresetCard({
  preset,
  isSelected,
  onClick,
  compact,
}: {
  preset: PresetTheme;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative rounded-xl overflow-hidden text-left transition-all',
        'border',
        isSelected
          ? 'border-primary shadow-[0_0_16px_-4px_rgba(168,85,247,0.5)]'
          : 'border-white/[0.06] hover:border-white/15',
        compact ? 'p-2' : 'p-3'
      )}
    >
      {/* Preview gradient background */}
      <div
        className={cn(
          'absolute inset-0 opacity-30',
          isSelected && 'opacity-40'
        )}
        style={{ background: preset.previewGradient }}
      />

      {/* Glass overlay */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'font-medium',
              compact ? 'text-xs' : 'text-sm',
              isSelected ? 'text-primary' : 'text-foreground'
            )}
          >
            {preset.name}
          </span>

          {/* Selected indicator */}
          <AnimatePresence>
            {isSelected && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className={cn(
                  'flex items-center justify-center rounded-full',
                  'bg-primary',
                  compact ? 'w-4 h-4' : 'w-5 h-5'
                )}
              >
                <Check
                  className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}
                  strokeWidth={3}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!compact && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {preset.description}
          </p>
        )}
      </div>

      {/* Glow effect when selected */}
      {isSelected && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${preset.accentColor}15 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.button>
  );
}

/**
 * Section header component
 */
function SectionHeader({
  icon: Icon,
  title,
  compact,
}: {
  icon: typeof Settings;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className={cn(
          'rounded-lg bg-primary/10 flex items-center justify-center',
          compact ? 'p-1' : 'p-1.5'
        )}
      >
        <Icon
          className={cn('text-primary', compact ? 'w-3 h-3' : 'w-3.5 h-3.5')}
          strokeWidth={1.75}
        />
      </div>
      <span
        className={cn(
          'font-medium text-muted-foreground',
          compact ? 'text-[10px]' : 'text-xs',
          'uppercase tracking-wider'
        )}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * Toggle option component
 */
function ToggleOption({
  label,
  description,
  enabled,
  onChange,
  compact,
}: {
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  compact?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onChange(!enabled)}
      className={cn(
        'w-full flex items-center justify-between gap-3 rounded-lg',
        'transition-colors',
        compact ? 'p-2' : 'p-3',
        'hover:bg-white/[0.03]'
      )}
    >
      <div className="text-left">
        <span
          className={cn(
            'block font-medium',
            compact ? 'text-xs' : 'text-sm',
            'text-foreground/90'
          )}
        >
          {label}
        </span>
        {description && !compact && (
          <span className="text-[10px] text-muted-foreground/60">
            {description}
          </span>
        )}
      </div>

      {/* Toggle indicator */}
      <div
        className={cn(
          'relative rounded-full transition-colors',
          compact ? 'w-8 h-4' : 'w-10 h-5',
          enabled ? 'bg-primary' : 'bg-white/10'
        )}
      >
        <motion.div
          className={cn(
            'absolute top-0.5 rounded-full bg-white shadow-sm',
            compact ? 'w-3 h-3' : 'w-4 h-4'
          )}
          animate={{
            left: enabled ? (compact ? '1rem' : '1.25rem') : '0.125rem',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </div>
    </motion.button>
  );
}

/**
 * Volume slider component
 */
function VolumeSlider({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', compact ? 'px-2' : 'px-3')}>
      <VolumeX
        className={cn(
          'shrink-0',
          compact ? 'w-3 h-3' : 'w-4 h-4',
          disabled ? 'text-muted-foreground/30' : 'text-muted-foreground/60'
        )}
        strokeWidth={1.75}
      />
      <div className="relative flex-1 h-6 flex items-center">
        <div
          className={cn(
            'absolute inset-y-0 left-0 right-0 my-auto h-1 rounded-full',
            disabled ? 'bg-white/5' : 'bg-white/10'
          )}
        />
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 my-auto h-1 rounded-full',
            disabled ? 'bg-primary/30' : 'bg-primary'
          )}
          style={{ width: `${value * 100}%` }}
          animate={{ width: `${value * 100}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={cn(
            'absolute inset-0 w-full h-full opacity-0 cursor-pointer',
            disabled && 'cursor-not-allowed'
          )}
        />
        <motion.div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full shadow-md',
            compact ? 'w-3 h-3' : 'w-4 h-4',
            disabled ? 'bg-white/50' : 'bg-white'
          )}
          style={{ left: `calc(${value * 100}% - ${compact ? 6 : 8}px)` }}
          animate={{ left: `calc(${value * 100}% - ${compact ? 6 : 8}px)` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>
      <Volume2
        className={cn(
          'shrink-0',
          compact ? 'w-3 h-3' : 'w-4 h-4',
          disabled ? 'text-muted-foreground/30' : 'text-muted-foreground/60'
        )}
        strokeWidth={1.75}
      />
    </div>
  );
}

/**
 * Sound settings section component
 */
function SoundSettings({
  sound,
  onChange,
  compact,
}: {
  sound: ChessSoundSettings;
  onChange: (updates: Partial<ChessSoundSettings>) => void;
  compact?: boolean;
}) {
  const handleMasterToggle = useCallback(
    (enabled: boolean) => {
      onChange({ enabled });
    },
    [onChange]
  );

  const handleVolumeChange = useCallback(
    (volume: number) => {
      onChange({ volume });
    },
    [onChange]
  );

  const handleSoundToggle = useCallback(
    (key: keyof ChessSoundSettings, value: boolean) => {
      onChange({ [key]: value });
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {/* Master toggle */}
      <ToggleOption
        label="Sound Effects"
        description="Enable all chess sounds"
        enabled={sound.enabled}
        onChange={handleMasterToggle}
        compact={compact}
      />

      {/* Volume slider */}
      <motion.div
        initial={false}
        animate={{
          opacity: sound.enabled ? 1 : 0.4,
          height: 'auto',
        }}
        className={cn('py-2', !sound.enabled && 'pointer-events-none')}
      >
        <VolumeSlider
          value={sound.volume}
          onChange={handleVolumeChange}
          disabled={!sound.enabled}
          compact={compact}
        />
      </motion.div>

      {/* Divider */}
      <div className="h-px bg-white/[0.04]" />

      {/* Individual sound toggles */}
      <motion.div
        initial={false}
        animate={{ opacity: sound.enabled ? 1 : 0.4 }}
        className={cn(!sound.enabled && 'pointer-events-none')}
      >
        <ToggleOption
          label="Move Sounds"
          description="Play sound on piece movement"
          enabled={sound.moveSound}
          onChange={(v) => handleSoundToggle('moveSound', v)}
          compact={compact}
        />
        <div className="h-px bg-white/[0.04]" />
        <ToggleOption
          label="Capture Sounds"
          description="Play sound when capturing pieces"
          enabled={sound.captureSound}
          onChange={(v) => handleSoundToggle('captureSound', v)}
          compact={compact}
        />
        <div className="h-px bg-white/[0.04]" />
        <ToggleOption
          label="Check Sounds"
          description="Alert sound when king is in check"
          enabled={sound.checkSound}
          onChange={(v) => handleSoundToggle('checkSound', v)}
          compact={compact}
        />
        <div className="h-px bg-white/[0.04]" />
        <ToggleOption
          label="Game Over Sounds"
          description="Sound on checkmate, stalemate, or draw"
          enabled={sound.gameOverSound}
          onChange={(v) => handleSoundToggle('gameOverSound', v)}
          compact={compact}
        />
      </motion.div>
    </div>
  );
}

/**
 * Chess Settings Panel - Main Component
 *
 * Provides board theme selection, preset themes, and display options.
 * Integrates with ChessSettings for persistence.
 */
export function ChessSettingsPanel({
  settings,
  onSettingsChange,
  compact = false,
  themeOnly = false,
}: ChessSettingsPanelProps) {
  // Find current preset (if any matches current settings)
  const getCurrentPresetId = useCallback(() => {
    return presetThemes.find(
      (p) =>
        p.boardTheme === settings.boardTheme &&
        p.showCoordinates === settings.showCoordinates &&
        p.showLighting === settings.showLighting
    )?.id;
  }, [settings.boardTheme, settings.showCoordinates, settings.showLighting]);

  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>(
    getCurrentPresetId()
  );

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (preset: PresetTheme) => {
      setSelectedPresetId(preset.id);
      onSettingsChange({
        boardTheme: preset.boardTheme,
        showCoordinates: preset.showCoordinates,
        showLighting: preset.showLighting,
      });
    },
    [onSettingsChange]
  );

  // Handle individual theme selection (clears preset)
  const handleThemeSelect = useCallback(
    (themeId: BoardThemeId) => {
      setSelectedPresetId(undefined);
      onSettingsChange({ boardTheme: themeId });
    },
    [onSettingsChange]
  );

  // Handle toggle changes (clears preset)
  const handleToggleChange = useCallback(
    (key: 'showCoordinates' | 'showLighting', value: boolean) => {
      setSelectedPresetId(undefined);
      onSettingsChange({ [key]: value });
    },
    [onSettingsChange]
  );

  // Handle sound settings changes
  const handleSoundChange = useCallback(
    (updates: Partial<ChessSoundSettings>) => {
      onSettingsChange({
        sound: { ...settings.sound, ...updates },
      });
    },
    [onSettingsChange, settings.sound]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'flex flex-col',
        compact ? 'gap-4' : 'gap-6'
      )}
    >
      {/* Preset Themes Section */}
      <div>
        <SectionHeader icon={Sparkles} title="Preset Themes" compact={compact} />
        <div
          className={cn(
            'grid gap-2',
            compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
          )}
        >
          {presetThemes.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isSelected={selectedPresetId === preset.id}
              onClick={() => handlePresetSelect(preset)}
              compact={compact}
            />
          ))}
        </div>
      </div>

      {/* Board Theme Section */}
      <div>
        <SectionHeader icon={Palette} title="Board Theme" compact={compact} />
        <div
          className={cn(
            'p-3 rounded-xl',
            'glass',
            'border border-white/[0.06]'
          )}
        >
          <ThemeSelector
            selectedTheme={settings.boardTheme}
            onSelectTheme={handleThemeSelect}
            compact={compact}
          />
        </div>
      </div>

      {/* Display Options Section (unless themeOnly) */}
      {!themeOnly && (
        <div>
          <SectionHeader icon={Eye} title="Display Options" compact={compact} />
          <div
            className={cn(
              'rounded-xl overflow-hidden',
              'glass',
              'border border-white/[0.06]'
            )}
          >
            <ToggleOption
              label="Show Coordinates"
              description="Display rank and file labels"
              enabled={settings.showCoordinates}
              onChange={(v) => handleToggleChange('showCoordinates', v)}
              compact={compact}
            />
            <div className="h-px bg-white/[0.04]" />
            <ToggleOption
              label="Board Lighting"
              description="Enhanced specular and reflection effects"
              enabled={settings.showLighting}
              onChange={(v) => handleToggleChange('showLighting', v)}
              compact={compact}
            />
          </div>
        </div>
      )}

      {/* Sound Settings Section (unless themeOnly) */}
      {!themeOnly && (
        <div>
          <SectionHeader icon={Volume2} title="Sound Settings" compact={compact} />
          <div
            className={cn(
              'rounded-xl overflow-hidden',
              'glass',
              'border border-white/[0.06]'
            )}
          >
            <SoundSettings
              sound={settings.sound}
              onChange={handleSoundChange}
              compact={compact}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default ChessSettingsPanel;
