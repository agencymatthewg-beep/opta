/**
 * Preset Chess Themes
 *
 * Separated from ChessSettingsPanel.tsx to avoid HMR issues.
 * React Fast Refresh doesn't handle mixed component/data exports well.
 */

import type { BoardThemeId } from '@/types/boardTheme';

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
