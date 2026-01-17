/**
 * useRingSize Hook - Phase 29: Persistent Ring
 *
 * Determines the appropriate ring size based on:
 * - Current route/page context
 * - User interaction state
 * - Screen size/breakpoints
 *
 * Size modes:
 * - `ambient`: 48x48px (default, corner position)
 * - `hero`: 128x128px (landing page, centered)
 * - `mini`: 32x32px (menu bar integration)
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOptaRingOptional } from '@/contexts/OptaRingContext';

// =============================================================================
// TYPES
// =============================================================================

export type RingSizeMode = 'mini' | 'ambient' | 'hero';

export interface RingSizeConfig {
  /** CSS width/height in pixels */
  size: number;
  /** CSS class for the size */
  className: string;
  /** OptaRing3D size prop */
  ringSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  /** Whether the ring should be centered */
  centered: boolean;
}

export interface UseRingSizeOptions {
  /** Current page/route identifier */
  currentPage?: string;
  /** Whether to respond to hover state */
  enableHoverScale?: boolean;
  /** Override size mode manually */
  overrideMode?: RingSizeMode;
  /** Custom pages that should show hero mode */
  heroPages?: string[];
}

export interface UseRingSizeReturn {
  /** Current size mode */
  mode: RingSizeMode;
  /** Size configuration for current mode */
  config: RingSizeConfig;
  /** Whether ring is in hover state */
  isHovered: boolean;
  /** Set hover state */
  setHovered: (hovered: boolean) => void;
  /** Manually change mode */
  setMode: (mode: RingSizeMode) => void;
  /** Reset to auto-determined mode */
  resetMode: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Size configurations for each mode */
const SIZE_CONFIGS: Record<RingSizeMode, RingSizeConfig> = {
  mini: {
    size: 32,
    className: 'w-8 h-8',
    ringSize: 'xs',
    centered: false,
  },
  ambient: {
    size: 48,
    className: 'w-12 h-12',
    ringSize: 'sm',
    centered: false,
  },
  hero: {
    size: 128,
    className: 'w-32 h-32',
    ringSize: 'xl',
    centered: true,
  },
};

/** Default pages that should show hero mode */
const DEFAULT_HERO_PAGES = ['landing', 'onboarding', 'welcome'];

/** Pages that should show mini mode (compact UI) */
const MINI_PAGES = ['settings', 'preferences'];

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useRingSize(options: UseRingSizeOptions = {}): UseRingSizeReturn {
  const {
    currentPage,
    enableHoverScale = true,
    overrideMode,
    heroPages = DEFAULT_HERO_PAGES,
  } = options;

  // Get ring context if available (for coordination with global state)
  const ringContext = useOptaRingOptional();

  // Local state
  const [isHovered, setIsHovered] = useState(false);
  const [manualMode, setManualMode] = useState<RingSizeMode | null>(null);

  /**
   * Determine auto mode based on page context
   */
  const autoMode = useMemo((): RingSizeMode => {
    // Check for hero pages
    if (currentPage && heroPages.includes(currentPage.toLowerCase())) {
      return 'hero';
    }

    // Check for mini pages
    if (currentPage && MINI_PAGES.includes(currentPage.toLowerCase())) {
      return 'mini';
    }

    // Default to ambient
    return 'ambient';
  }, [currentPage, heroPages]);

  /**
   * Final mode considering overrides
   */
  const mode = useMemo((): RingSizeMode => {
    // Manual override takes highest priority
    if (overrideMode) return overrideMode;

    // User-set mode takes second priority
    if (manualMode) return manualMode;

    // Auto mode based on context
    return autoMode;
  }, [overrideMode, manualMode, autoMode]);

  /**
   * Get config for current mode, with hover adjustments
   */
  const config = useMemo((): RingSizeConfig => {
    const baseConfig = SIZE_CONFIGS[mode];

    // Apply hover scale if enabled and in ambient mode
    if (enableHoverScale && isHovered && mode === 'ambient') {
      return {
        ...baseConfig,
        size: Math.round(baseConfig.size * 1.1), // 10% larger on hover
        className: 'w-[52px] h-[52px]', // Slightly larger
      };
    }

    return baseConfig;
  }, [mode, isHovered, enableHoverScale]);

  /**
   * Sync with global ring context size if available
   */
  useEffect(() => {
    if (ringContext && mode === 'hero') {
      ringContext.setSize('xl');
    } else if (ringContext && mode === 'mini') {
      ringContext.setSize('xs');
    } else if (ringContext) {
      ringContext.setSize('sm');
    }
  }, [mode, ringContext]);

  /**
   * Set hover state handler
   */
  const setHovered = useCallback((hovered: boolean) => {
    if (enableHoverScale) {
      setIsHovered(hovered);
    }
  }, [enableHoverScale]);

  /**
   * Manually set mode
   */
  const setMode = useCallback((newMode: RingSizeMode) => {
    setManualMode(newMode);
  }, []);

  /**
   * Reset to auto-determined mode
   */
  const resetMode = useCallback(() => {
    setManualMode(null);
  }, []);

  return {
    mode,
    config,
    isHovered,
    setHovered,
    setMode,
    resetMode,
  };
}

/**
 * Get static size config without hook (for server-side or one-off use)
 */
export function getRingSizeConfig(mode: RingSizeMode): RingSizeConfig {
  return SIZE_CONFIGS[mode];
}

export default useRingSize;
