/**
 * PresetSelector - Optimization preset selection grid
 *
 * Displays built-in and custom presets with visual selection state.
 * Uses glass styling and Framer Motion animations per design system.
 */

import { motion } from 'framer-motion';
import { usePresets } from '@/hooks/usePresets';
import { cn } from '@/lib/utils';
import {
  Zap,
  Video,
  Volume2,
  Target,
  Sliders,
  Check,
  Trash2,
} from 'lucide-react';

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  Zap,
  Video,
  Volume2,
  Target,
  Sliders,
};

interface PresetSelectorProps {
  className?: string;
}

export function PresetSelector({ className }: PresetSelectorProps) {
  const { presets, activePresetId, applyPreset, deletePreset } = usePresets();

  const handleDelete = (e: React.MouseEvent, presetId: string) => {
    e.stopPropagation();
    deletePreset(presetId);
  };

  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {presets.map((preset, index) => {
        const Icon = ICON_MAP[preset.icon] || Sliders;
        const isActive = activePresetId === preset.id;

        return (
          <motion.button
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            className={cn(
              'glass-subtle rounded-xl p-4 text-left border relative group',
              isActive
                ? 'ring-2 ring-primary border-primary/30 shadow-[0_0_24px_-8px_hsl(var(--glow-primary)/0.4)]'
                : 'border-border/30 hover:border-border/50'
            )}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Active indicator */}
            {isActive && (
              <motion.div
                className="absolute top-2 right-2"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <Check className="w-3 h-3 text-primary" strokeWidth={2.5} />
                </div>
              </motion.div>
            )}

            {/* Delete button for custom presets */}
            {!preset.isBuiltIn && !isActive && (
              <motion.button
                onClick={(e) => handleDelete(e, preset.id)}
                className={cn(
                  'absolute top-2 right-2 w-6 h-6 rounded-lg',
                  'bg-danger/10 border border-danger/20',
                  'flex items-center justify-center',
                  'opacity-0 group-hover:opacity-100 transition-opacity',
                  'hover:bg-danger/20'
                )}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                aria-label={`Delete ${preset.name} preset`}
              >
                <Trash2 className="w-3.5 h-3.5 text-danger" strokeWidth={1.75} />
              </motion.button>
            )}

            {/* Icon */}
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center mb-3',
                isActive
                  ? 'bg-primary/20 border border-primary/30'
                  : 'bg-muted/50 border border-border/30'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                strokeWidth={1.75}
              />
            </div>

            {/* Text content */}
            <p
              className={cn(
                'font-medium text-sm',
                isActive ? 'text-foreground' : 'text-foreground/90'
              )}
            >
              {preset.name}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">
              {preset.description}
            </p>

            {/* Custom badge */}
            {!preset.isBuiltIn && (
              <span
                className={cn(
                  'inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium',
                  'bg-accent/15 text-accent border border-accent/30'
                )}
              >
                Custom
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export default PresetSelector;
