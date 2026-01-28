/**
 * ThemeSelector - Board Theme Picker Component
 *
 * Allows users to select from premium board themes:
 * - Obsidian (default)
 * - Wood
 * - Marble
 * - Glass
 *
 * Shows theme preview with visual feedback.
 *
 * @see DESIGN_SYSTEM.md - Glass effects, Framer Motion
 */

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type BoardThemeId,
  boardThemeIds,
  getBoardTheme,
} from '@/types/boardTheme';

export interface ThemeSelectorProps {
  /** Currently selected theme */
  selectedTheme: BoardThemeId;
  /** Callback when theme is selected */
  onSelectTheme: (themeId: BoardThemeId) => void;
  /** Compact mode (smaller previews) */
  compact?: boolean;
}

/**
 * Mini board preview for theme selection
 */
function ThemePreview({
  themeId,
  isSelected,
  onClick,
  compact,
}: {
  themeId: BoardThemeId;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const theme = getBoardTheme(themeId);
  const size = compact ? 48 : 64;
  const squareSize = size / 4;

  // Create 4x4 mini board preview
  const squares = [];
  for (let rank = 0; rank < 4; rank++) {
    for (let file = 0; file < 4; file++) {
      const isLight = (rank + file) % 2 === 1;
      squares.push(
        <div
          key={`${rank}-${file}`}
          style={{
            width: squareSize,
            height: squareSize,
            backgroundColor: isLight ? theme.colors.lightSquare : theme.colors.darkSquare,
          }}
        />
      );
    }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden',
        'border-2 transition-colors',
        isSelected ? 'border-primary' : 'border-transparent hover:border-white/20'
      )}
      style={{
        boxShadow: isSelected
          ? '0 0 12px rgba(168, 85, 247, 0.4)'
          : theme.lighting.outerShadow,
      }}
    >
      {/* Board preview */}
      <div
        className="grid grid-cols-4"
        style={{ width: size, height: size }}
      >
        {squares}
      </div>

      {/* Material overlay */}
      {theme.materialOverlay && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: theme.materialOverlay }}
        />
      )}

      {/* Glass blur for glass theme */}
      {themeId === 'glass' && (
        <div className="absolute inset-0 backdrop-blur-[1px] pointer-events-none" />
      )}

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            'absolute bottom-1 right-1',
            'w-4 h-4 rounded-full',
            'bg-primary flex items-center justify-center'
          )}
        >
          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
        </motion.div>
      )}
    </motion.button>
  );
}

/**
 * Theme selector component with previews
 */
export function ThemeSelector({
  selectedTheme,
  onSelectTheme,
  compact = false,
}: ThemeSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Board Theme
      </span>
      <div className="flex gap-2 flex-wrap">
        {boardThemeIds.map((themeId) => {
          const theme = getBoardTheme(themeId);
          return (
            <div key={themeId} className="flex flex-col items-center gap-1.5">
              <ThemePreview
                themeId={themeId}
                isSelected={selectedTheme === themeId}
                onClick={() => onSelectTheme(themeId)}
                compact={compact}
              />
              <span
                className={cn(
                  'text-[10px] font-medium',
                  selectedTheme === themeId ? 'text-primary' : 'text-muted-foreground/60'
                )}
              >
                {theme.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ThemeSelector;
