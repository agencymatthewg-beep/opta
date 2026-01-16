import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * RadialNavContext - Global state for the radial navigation system
 *
 * Controls radial navigation behavior across the app including:
 * - Mode transitions (expanded, collapsed, halo)
 * - Hover state tracking with semantic colors
 * - Utility island visibility
 * - Mobile detection and adaptation
 * - Content preview management
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

// ============================================================================
// Types
// ============================================================================

export type SemanticColor = 'neutral' | 'gaming' | 'energy' | 'precision' | 'success' | 'warmth';

export interface RadialNavState {
  /** Current navigation mode */
  mode: 'expanded' | 'collapsed' | 'halo';
  /** Currently hovered item ID */
  hoveredItemId: string | null;
  /** Semantic color of the currently hovered item */
  hoveredItemSemanticColor: SemanticColor | null;
  /** Currently active page ID */
  activePageId: string;
  /** Whether the utility island is open */
  isUtilityIslandOpen: boolean;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Content to preview in the center area */
  previewContent: React.ReactNode | null;
}

// ============================================================================
// Semantic Color Map
// ============================================================================

export const SEMANTIC_COLORS = {
  dashboard: { name: 'warmth' as SemanticColor, color: 'hsl(var(--warning))', glow: 'rgba(250,204,21,0.5)' },
  games: { name: 'gaming' as SemanticColor, color: 'hsl(210 90% 60%)', glow: 'rgba(59,130,246,0.5)' },
  optimize: { name: 'energy' as SemanticColor, color: 'hsl(var(--primary))', glow: 'rgba(168,85,247,0.5)' },
  pinpoint: { name: 'precision' as SemanticColor, color: 'hsl(185 80% 55%)', glow: 'rgba(34,211,238,0.5)' },
  score: { name: 'success' as SemanticColor, color: 'hsl(var(--success))', glow: 'rgba(74,222,128,0.5)' },
  settings: { name: 'neutral' as SemanticColor, color: 'hsl(var(--muted-foreground))', glow: 'rgba(120,120,130,0.4)' },
} as const;

export type SemanticColorKey = keyof typeof SEMANTIC_COLORS;

// ============================================================================
// Context Interface
// ============================================================================

interface RadialNavContextValue extends RadialNavState {
  // Navigation
  /** Navigate to a specific page */
  navigateTo: (pageId: string) => void;

  // Hover handlers
  /** Set the currently hovered item */
  setHoveredItem: (itemId: string | null) => void;

  // Mode transitions
  /** Expand the radial navigation */
  expand: () => void;
  /** Collapse the radial navigation */
  collapse: () => void;
  /** Transition to halo mode */
  toHalo: () => void;

  // Utility island
  /** Open the utility island */
  openUtilityIsland: () => void;
  /** Close the utility island */
  closeUtilityIsland: () => void;
  /** Toggle the utility island */
  toggleUtilityIsland: () => void;

  // Content preview
  /** Set preview content for the center area */
  setPreviewContent: (content: React.ReactNode | null) => void;

  // Helpers
  /** Get semantic color configuration for an item */
  getSemanticColor: (itemId: string) => typeof SEMANTIC_COLORS[SemanticColorKey] | null;
}

// ============================================================================
// Context Creation
// ============================================================================

const RadialNavContext = createContext<RadialNavContextValue | null>(null);

// ============================================================================
// Default State
// ============================================================================

const DEFAULT_STATE: RadialNavState = {
  mode: 'expanded',
  hoveredItemId: null,
  hoveredItemSemanticColor: null,
  activePageId: 'dashboard',
  isUtilityIslandOpen: false,
  isMobile: false,
  previewContent: null,
};

// Durations in ms
const HALO_COLLAPSE_DELAY = 300;

// ============================================================================
// Provider Implementation
// ============================================================================

export function RadialNavProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RadialNavState>(DEFAULT_STATE);

  // Detect mobile on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      setState((prev) => ({
        ...prev,
        isMobile,
      }));
    };

    // Initial check
    checkMobile();

    // Listen for changes
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    mediaQuery.addEventListener('change', checkMobile);

    return () => {
      mediaQuery.removeEventListener('change', checkMobile);
    };
  }, []);

  // Navigate to a page
  const navigateTo = useCallback((pageId: string) => {
    setState((prev) => ({
      ...prev,
      activePageId: pageId,
      hoveredItemId: null,
      hoveredItemSemanticColor: null,
    }));

    // Auto-collapse to halo after navigation with delay for animation
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        mode: 'halo',
      }));
    }, HALO_COLLAPSE_DELAY);
  }, []);

  // Set hovered item
  const setHoveredItem = useCallback((itemId: string | null) => {
    setState((prev) => {
      // Get semantic color for the hovered item
      let semanticColor: SemanticColor | null = null;
      if (itemId && itemId in SEMANTIC_COLORS) {
        semanticColor = SEMANTIC_COLORS[itemId as SemanticColorKey].name;
      }

      return {
        ...prev,
        hoveredItemId: itemId,
        hoveredItemSemanticColor: semanticColor,
      };
    });
  }, []);

  // Mode transitions
  const expand = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: 'expanded',
    }));
  }, []);

  const collapse = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: 'collapsed',
    }));
  }, []);

  const toHalo = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mode: 'halo',
    }));
  }, []);

  // Utility island
  const openUtilityIsland = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isUtilityIslandOpen: true,
    }));
  }, []);

  const closeUtilityIsland = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isUtilityIslandOpen: false,
    }));
  }, []);

  const toggleUtilityIsland = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isUtilityIslandOpen: !prev.isUtilityIslandOpen,
    }));
  }, []);

  // Content preview
  const setPreviewContent = useCallback((content: React.ReactNode | null) => {
    setState((prev) => ({
      ...prev,
      previewContent: content,
    }));
  }, []);

  // Get semantic color for an item
  const getSemanticColor = useCallback((itemId: string) => {
    if (itemId in SEMANTIC_COLORS) {
      return SEMANTIC_COLORS[itemId as SemanticColorKey];
    }
    return null;
  }, []);

  const value: RadialNavContextValue = {
    ...state,
    navigateTo,
    setHoveredItem,
    expand,
    collapse,
    toHalo,
    openUtilityIsland,
    closeUtilityIsland,
    toggleUtilityIsland,
    setPreviewContent,
    getSemanticColor,
  };

  return (
    <RadialNavContext.Provider value={value}>
      {children}
    </RadialNavContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access RadialNav context
 * @throws Error if used outside RadialNavProvider
 */
export function useRadialNav(): RadialNavContextValue {
  const context = useContext(RadialNavContext);
  if (!context) {
    throw new Error('useRadialNav must be used within a RadialNavProvider');
  }
  return context;
}

/**
 * Hook to access RadialNav context with optional provider
 * Returns null if no provider is present (useful for conditional usage)
 */
export function useRadialNavOptional(): RadialNavContextValue | null {
  return useContext(RadialNavContext);
}

/**
 * Hook to get the current semantic color based on hovered item
 * Useful for components that need to respond to hover state
 */
export function useRadialNavSemanticColor(): typeof SEMANTIC_COLORS[SemanticColorKey] | null {
  const context = useRadialNavOptional();
  if (!context || !context.hoveredItemId) return null;
  return context.getSemanticColor(context.hoveredItemId);
}

export default RadialNavContext;
