/**
 * ChromeContext - GPU Chrome Layer State Provider
 *
 * Provides application-wide management of GPU-rendered UI chrome.
 * Chrome = glass panels, neon borders, glows rendered via WebGL.
 *
 * Usage:
 * 1. Wrap app with ChromeProvider (inside PerformanceProvider)
 * 2. Use useChromePanel() hook to register panels
 * 3. ChromeCanvas renders the WebGL chrome layer
 *
 * @see ChromeCanvas.tsx - The WebGL rendering component
 * @see ChromeRegistry.ts - Panel registration system
 * @see DESIGN_SYSTEM.md - Glass Effects Guidelines
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

import {
  ChromePanelRegistry,
  createChromePanelRegistry,
  type ChromePanelConfig,
  type ChromePanelRegistration,
  type ChromeRegistryState,
  type ChromeEnergyState,
} from '@/components/chrome/ChromeRegistry';

import { usePerformance } from '@/contexts/PerformanceContext';

// =============================================================================
// TYPES
// =============================================================================

export interface ChromeState {
  /** Whether chrome system is initialized */
  isReady: boolean;
  /** Whether WebGL chrome is enabled (based on performance tier) */
  isEnabled: boolean;
  /** Current global energy state */
  globalEnergyState: ChromeEnergyState;
  /** Number of registered panels */
  panelCount: number;
  /** Current viewport dimensions */
  viewport: { width: number; height: number };
  /** Whether in fallback mode (CSS-only) */
  isFallbackMode: boolean;
}

export interface ChromeActions {
  /** Register a panel for chrome rendering */
  registerPanel: (element: HTMLElement, config: ChromePanelConfig) => void;
  /** Unregister a panel */
  unregisterPanel: (id: string) => void;
  /** Update panel energy state */
  setPanelEnergy: (id: string, state: ChromeEnergyState) => void;
  /** Set global energy state */
  setGlobalEnergy: (state: ChromeEnergyState) => void;
  /** Force update all panel bounds */
  refreshBounds: () => void;
  /** Enable/disable chrome system */
  setEnabled: (enabled: boolean) => void;
}

export interface ChromeHelpers {
  /** Get all registered panels */
  getPanels: () => ChromePanelRegistration[];
  /** Get specific panel by ID */
  getPanel: (id: string) => ChromePanelRegistration | undefined;
  /** Check if panel is registered */
  hasPanel: (id: string) => boolean;
  /** Get registry instance (for ChromeCanvas) */
  getRegistry: () => ChromePanelRegistry;
}

export interface ChromeContextValue {
  state: ChromeState;
  actions: ChromeActions;
  helpers: ChromeHelpers;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ChromeContext = createContext<ChromeContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

export interface ChromeProviderProps {
  children: ReactNode;
  /** Force enable/disable (overrides performance tier) */
  forceEnabled?: boolean;
  /** Initial global energy state */
  initialEnergyState?: ChromeEnergyState;
}

export function ChromeProvider({
  children,
  forceEnabled,
  initialEnergyState = 'dormant',
}: ChromeProviderProps) {
  // Performance context for tier-based decisions
  const { state: perfState, helpers: perfHelpers } = usePerformance();

  // Registry instance (stable across renders)
  const registryRef = useRef<ChromePanelRegistry | null>(null);
  if (!registryRef.current) {
    registryRef.current = createChromePanelRegistry();
  }

  // State
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [globalEnergyState, setGlobalEnergyState] = useState<ChromeEnergyState>(initialEnergyState);
  const [panelCount, setPanelCount] = useState(0);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Determine if we should use WebGL chrome
  const shouldUseWebGL = useMemo(() => {
    if (forceEnabled !== undefined) return forceEnabled;
    if (!perfState.isReady) return false;
    return perfHelpers.shouldUseWebGL() && isEnabled;
  }, [forceEnabled, perfState.isReady, perfHelpers, isEnabled]);

  const isFallbackMode = !shouldUseWebGL;

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  useEffect(() => {
    const registry = registryRef.current;
    if (!registry) return;

    // Subscribe to registry changes
    const unsubscribe = registry.subscribe((state: ChromeRegistryState) => {
      setPanelCount(state.panels.size);
      setViewport(state.viewport);
    });

    // Set initial energy state
    registry.setGlobalEnergyState(initialEnergyState);

    // Handle viewport resize
    const handleResize = () => {
      registry.updateViewport(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    setIsReady(true);

    // Log in development
    if (import.meta.env.DEV) {
      console.log('[Chrome] Initialized:', {
        webglEnabled: shouldUseWebGL,
        tier: perfState.tier,
        fallbackMode: isFallbackMode,
      });
    }

    return () => {
      unsubscribe();
      window.removeEventListener('resize', handleResize);
    };
  }, [initialEnergyState, shouldUseWebGL, perfState.tier, isFallbackMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      registryRef.current?.dispose();
    };
  }, []);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const registerPanel = useCallback((element: HTMLElement, config: ChromePanelConfig) => {
    registryRef.current?.register(element, config);
  }, []);

  const unregisterPanel = useCallback((id: string) => {
    registryRef.current?.unregister(id);
  }, []);

  const setPanelEnergy = useCallback((id: string, state: ChromeEnergyState) => {
    registryRef.current?.updatePanelEnergy(id, state);
  }, []);

  const setGlobalEnergy = useCallback((state: ChromeEnergyState) => {
    setGlobalEnergyState(state);
    registryRef.current?.setGlobalEnergyState(state);
  }, []);

  const refreshBounds = useCallback(() => {
    registryRef.current?.getPanels().forEach((panel) => {
      registryRef.current?.updatePanelBounds(panel.config.id);
    });
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
  }, []);

  const actions: ChromeActions = useMemo(
    () => ({
      registerPanel,
      unregisterPanel,
      setPanelEnergy,
      setGlobalEnergy,
      refreshBounds,
      setEnabled,
    }),
    [registerPanel, unregisterPanel, setPanelEnergy, setGlobalEnergy, refreshBounds, setEnabled]
  );

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const helpers: ChromeHelpers = useMemo(
    () => ({
      getPanels: () => registryRef.current?.getPanels() || [],
      getPanel: (id: string) => registryRef.current?.getPanel(id),
      hasPanel: (id: string) => registryRef.current?.getPanel(id) !== undefined,
      getRegistry: () => registryRef.current!,
    }),
    []
  );

  // ==========================================================================
  // STATE
  // ==========================================================================

  const state: ChromeState = useMemo(
    () => ({
      isReady,
      isEnabled: shouldUseWebGL,
      globalEnergyState,
      panelCount,
      viewport,
      isFallbackMode,
    }),
    [isReady, shouldUseWebGL, globalEnergyState, panelCount, viewport, isFallbackMode]
  );

  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================

  const contextValue: ChromeContextValue = useMemo(
    () => ({ state, actions, helpers }),
    [state, actions, helpers]
  );

  return (
    <ChromeContext.Provider value={contextValue}>
      {children}
    </ChromeContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access chrome context
 *
 * @throws Error if used outside ChromeProvider
 */
export function useChrome(): ChromeContextValue {
  const context = useContext(ChromeContext);

  if (!context) {
    throw new Error(
      'useChrome must be used within a ChromeProvider. ' +
        'Wrap your app with <ChromeProvider>.'
    );
  }

  return context;
}

/**
 * Hook to register a panel for chrome rendering
 *
 * @example
 * ```tsx
 * function MyCard() {
 *   const ref = useChromePanel({
 *     id: 'my-card',
 *     glowBorders: true,
 *     borderRadius: 12,
 *   });
 *
 *   return <Card ref={ref}>Content</Card>;
 * }
 * ```
 */
export function useChromePanel(config: ChromePanelConfig) {
  const { actions, state } = useChrome();
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Only register if chrome is enabled
    if (state.isEnabled) {
      actions.registerPanel(element, config);
    }

    return () => {
      actions.unregisterPanel(config.id);
    };
  }, [actions, config, state.isEnabled]);

  // Return callback ref
  const setRef = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  return setRef;
}

/**
 * Hook to control panel energy state
 */
export function usePanelEnergy(panelId: string) {
  const { actions, helpers } = useChrome();

  const setEnergy = useCallback(
    (state: ChromeEnergyState) => {
      actions.setPanelEnergy(panelId, state);
    },
    [actions, panelId]
  );

  const pulse = useCallback(() => {
    actions.setPanelEnergy(panelId, 'pulse');
    // Auto-return to previous state after pulse
    setTimeout(() => {
      const panel = helpers.getPanel(panelId);
      if (panel) {
        actions.setPanelEnergy(panelId, 'active');
      }
    }, 300);
  }, [actions, helpers, panelId]);

  return { setEnergy, pulse };
}

/**
 * Hook for global energy state
 */
export function useGlobalEnergy() {
  const { state, actions } = useChrome();

  return {
    energyState: state.globalEnergyState,
    setEnergy: actions.setGlobalEnergy,
  };
}

/**
 * Optional hook that returns null if outside provider
 */
export function useChromeOptional(): ChromeContextValue | null {
  return useContext(ChromeContext);
}

export default ChromeContext;
