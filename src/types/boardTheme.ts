/**
 * Board Theme Types - Premium Chess Board Visualization
 *
 * Defines theme types for premium board materials including:
 * - Wood (warm walnut and maple)
 * - Marble (cool elegant stone)
 * - Glass (modern translucent)
 * - Obsidian (Opta brand default)
 *
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 */

export type BoardThemeId = 'obsidian' | 'wood' | 'marble' | 'glass';

export interface BoardThemeColors {
  /** Light square background color */
  lightSquare: string;
  /** Dark square background color */
  darkSquare: string;
  /** Light square hover overlay */
  lightSquareHover: string;
  /** Dark square hover overlay */
  darkSquareHover: string;
  /** Board border color */
  border: string;
  /** Coordinate label color */
  coordinateColor: string;
  /** Coordinate label background (for readability) */
  coordinateBg: string;
}

export interface BoardThemeLighting {
  /** Specular highlight intensity (0-1) */
  specularIntensity: number;
  /** Specular highlight angle in degrees */
  specularAngle: number;
  /** Reflection opacity (0-1) */
  reflectionOpacity: number;
  /** Inner shadow for depth */
  innerShadow: string;
  /** Outer glow/shadow */
  outerShadow: string;
}

export interface BoardThemePieces {
  /** Shadow for light pieces */
  lightPieceShadow: string;
  /** Shadow for dark pieces */
  darkPieceShadow: string;
  /** Highlight/rim light for pieces */
  pieceHighlight: string;
  /** Glow on hover */
  hoverGlow: string;
}

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  description: string;
  colors: BoardThemeColors;
  lighting: BoardThemeLighting;
  pieces: BoardThemePieces;
  /** CSS gradient overlay for material effect */
  materialOverlay?: string;
  /** Whether this theme has animated effects */
  hasAnimatedEffects: boolean;
}

/**
 * Obsidian Theme - Opta Brand Default
 * Dark, mysterious, premium feel matching DESIGN_SYSTEM.md
 */
export const obsidianTheme: BoardTheme = {
  id: 'obsidian',
  name: 'Obsidian',
  description: 'Dark glass with purple energy accents',
  colors: {
    lightSquare: 'hsl(270, 20%, 18%)',
    darkSquare: 'hsl(270, 30%, 12%)',
    lightSquareHover: 'rgba(168, 85, 247, 0.15)',
    darkSquareHover: 'rgba(168, 85, 247, 0.2)',
    border: 'rgba(255, 255, 255, 0.08)',
    coordinateColor: 'rgba(255, 255, 255, 0.4)',
    coordinateBg: 'transparent',
  },
  lighting: {
    specularIntensity: 0.15,
    specularAngle: 135,
    reflectionOpacity: 0.05,
    innerShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
    outerShadow: '0 8px 32px -8px rgba(168, 85, 247, 0.3)',
  },
  pieces: {
    lightPieceShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
    darkPieceShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
    pieceHighlight: '0 -1px 0 rgba(255, 255, 255, 0.1)',
    hoverGlow: '0 0 12px rgba(168, 85, 247, 0.4)',
  },
  hasAnimatedEffects: true,
};

/**
 * Wood Theme - Classic Warm
 * Rich walnut and maple wood grain aesthetic
 */
export const woodTheme: BoardTheme = {
  id: 'wood',
  name: 'Walnut & Maple',
  description: 'Classic warm wood grain finish',
  colors: {
    lightSquare: 'hsl(35, 35%, 65%)',
    darkSquare: 'hsl(25, 45%, 30%)',
    lightSquareHover: 'rgba(255, 215, 150, 0.2)',
    darkSquareHover: 'rgba(255, 215, 150, 0.15)',
    border: 'hsl(25, 50%, 20%)',
    coordinateColor: 'hsl(25, 30%, 25%)',
    coordinateBg: 'transparent',
  },
  lighting: {
    specularIntensity: 0.2,
    specularAngle: 120,
    reflectionOpacity: 0.08,
    innerShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',
    outerShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  },
  pieces: {
    lightPieceShadow: '0 3px 10px rgba(0, 0, 0, 0.5)',
    darkPieceShadow: '0 3px 10px rgba(0, 0, 0, 0.7)',
    pieceHighlight: '0 -1px 0 rgba(255, 255, 255, 0.15)',
    hoverGlow: '0 0 8px rgba(255, 200, 100, 0.3)',
  },
  materialOverlay: `
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.03) 0%,
      transparent 50%,
      rgba(0, 0, 0, 0.05) 100%
    )
  `,
  hasAnimatedEffects: false,
};

/**
 * Marble Theme - Elegant Stone
 * Cool, sophisticated marble finish
 */
export const marbleTheme: BoardTheme = {
  id: 'marble',
  name: 'Carrara Marble',
  description: 'Elegant Italian marble finish',
  colors: {
    lightSquare: 'hsl(0, 0%, 92%)',
    darkSquare: 'hsl(210, 10%, 35%)',
    lightSquareHover: 'rgba(100, 150, 200, 0.15)',
    darkSquareHover: 'rgba(100, 150, 200, 0.2)',
    border: 'hsl(210, 5%, 25%)',
    coordinateColor: 'hsl(210, 10%, 40%)',
    coordinateBg: 'transparent',
  },
  lighting: {
    specularIntensity: 0.35,
    specularAngle: 150,
    reflectionOpacity: 0.12,
    innerShadow: 'inset 0 1px 2px rgba(255, 255, 255, 0.5)',
    outerShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
  },
  pieces: {
    lightPieceShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    darkPieceShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
    pieceHighlight: '0 -1px 0 rgba(255, 255, 255, 0.2)',
    hoverGlow: '0 0 10px rgba(100, 150, 200, 0.3)',
  },
  materialOverlay: `
    linear-gradient(
      45deg,
      rgba(255, 255, 255, 0.02) 0%,
      rgba(255, 255, 255, 0.05) 25%,
      transparent 50%,
      rgba(0, 0, 0, 0.02) 75%,
      rgba(0, 0, 0, 0.04) 100%
    )
  `,
  hasAnimatedEffects: false,
};

/**
 * Glass Theme - Modern Translucent
 * Frosted glass with depth blur
 */
export const glassTheme: BoardTheme = {
  id: 'glass',
  name: 'Frosted Glass',
  description: 'Modern translucent glass effect',
  colors: {
    lightSquare: 'rgba(255, 255, 255, 0.08)',
    darkSquare: 'rgba(0, 0, 0, 0.15)',
    lightSquareHover: 'rgba(255, 255, 255, 0.12)',
    darkSquareHover: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.15)',
    coordinateColor: 'rgba(255, 255, 255, 0.5)',
    coordinateBg: 'rgba(0, 0, 0, 0.2)',
  },
  lighting: {
    specularIntensity: 0.4,
    specularAngle: 135,
    reflectionOpacity: 0.15,
    innerShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.15)',
    outerShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  },
  pieces: {
    lightPieceShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
    darkPieceShadow: '0 4px 16px rgba(0, 0, 0, 0.7)',
    pieceHighlight: '0 -2px 0 rgba(255, 255, 255, 0.2)',
    hoverGlow: '0 0 16px rgba(255, 255, 255, 0.2)',
  },
  materialOverlay: `
    linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.1) 0%,
      transparent 40%,
      transparent 60%,
      rgba(255, 255, 255, 0.05) 100%
    )
  `,
  hasAnimatedEffects: true,
};

/**
 * All available board themes
 */
export const boardThemes: Record<BoardThemeId, BoardTheme> = {
  obsidian: obsidianTheme,
  wood: woodTheme,
  marble: marbleTheme,
  glass: glassTheme,
};

/**
 * Get a theme by ID with fallback to obsidian
 */
export function getBoardTheme(id: BoardThemeId): BoardTheme {
  return boardThemes[id] ?? obsidianTheme;
}

/**
 * List of all theme IDs for iteration
 */
export const boardThemeIds: BoardThemeId[] = ['obsidian', 'wood', 'marble', 'glass'];
