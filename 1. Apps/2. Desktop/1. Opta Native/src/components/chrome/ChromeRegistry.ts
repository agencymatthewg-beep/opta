/**
 * ChromeRegistry - Panel Registration System
 *
 * Manages registration, updates, and synchronization of chrome panels.
 * Panels are UI elements that get GPU-rendered glass effects.
 *
 * @see ChromeContext.tsx - Context that uses this registry
 * @see DESIGN_SYSTEM.md - Glass Effects Guidelines
 */

// Types for chrome panel registration - no three.js imports needed here

// =============================================================================
// TYPES
// =============================================================================

/**
 * Energy state for panel reactivity
 */
export type ChromeEnergyState = 'dormant' | 'active' | 'pulse' | 'storm';

/**
 * Panel configuration options
 */
export interface ChromePanelConfig {
  /** Unique identifier for the panel */
  id: string;
  /** Whether borders should glow */
  glowBorders?: boolean;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Glass blur intensity (0-1) */
  blurIntensity?: number;
  /** Energy state override */
  energyState?: ChromeEnergyState;
  /** Z-depth for parallax effects */
  depth?: number;
  /** Group ID for batch rendering */
  groupId?: string;
}

/**
 * Panel bounds in screen space
 */
export interface ChromePanelBounds {
  /** X position in pixels from left */
  x: number;
  /** Y position in pixels from top */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Normalized bounds for WebGL (0-1 range)
 */
export interface ChromePanelNormalizedBounds {
  /** X position (0-1, left to right) */
  x: number;
  /** Y position (0-1, bottom to top - WebGL convention) */
  y: number;
  /** Width (0-1) */
  width: number;
  /** Height (0-1) */
  height: number;
}

/**
 * Full panel registration data
 */
export interface ChromePanelRegistration {
  /** Panel configuration */
  config: ChromePanelConfig;
  /** Current DOM bounds */
  bounds: ChromePanelBounds;
  /** Normalized bounds for WebGL */
  normalizedBounds: ChromePanelNormalizedBounds;
  /** DOM element reference */
  element: HTMLElement;
  /** Registration timestamp */
  registeredAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Active energy state */
  energyState: ChromeEnergyState;
}

/**
 * Registry state snapshot
 */
export interface ChromeRegistryState {
  /** All registered panels */
  panels: Map<string, ChromePanelRegistration>;
  /** Global energy state (affects all panels without override) */
  globalEnergyState: ChromeEnergyState;
  /** Viewport dimensions */
  viewport: { width: number; height: number };
  /** Whether registry is ready */
  isReady: boolean;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert DOM bounds to normalized WebGL coordinates
 */
export function normalizeBounds(
  bounds: ChromePanelBounds,
  viewport: { width: number; height: number }
): ChromePanelNormalizedBounds {
  return {
    x: bounds.x / viewport.width,
    // Flip Y for WebGL coordinate system (origin at bottom-left)
    y: 1 - (bounds.y + bounds.height) / viewport.height,
    width: bounds.width / viewport.width,
    height: bounds.height / viewport.height,
  };
}

/**
 * Get bounds from a DOM element
 */
export function getBoundsFromElement(element: HTMLElement): ChromePanelBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Calculate panel center in normalized coordinates
 */
export function getPanelCenter(bounds: ChromePanelNormalizedBounds): { x: number; y: number } {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

/**
 * Check if a point is inside panel bounds
 */
export function isPointInPanel(
  point: { x: number; y: number },
  bounds: ChromePanelNormalizedBounds
): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

// =============================================================================
// REGISTRY CLASS
// =============================================================================

/**
 * Chrome panel registry
 *
 * Maintains state of all registered panels and provides
 * methods for registration, updates, and queries.
 */
export class ChromePanelRegistry {
  private panels: Map<string, ChromePanelRegistration> = new Map();
  private globalEnergyState: ChromeEnergyState = 'dormant';
  private viewport = { width: window.innerWidth, height: window.innerHeight };
  private observers: Map<string, ResizeObserver> = new Map();
  private listeners: Set<(state: ChromeRegistryState) => void> = new Set();

  /**
   * Register a new panel
   */
  register(element: HTMLElement, config: ChromePanelConfig): void {
    const bounds = getBoundsFromElement(element);
    const normalizedBounds = normalizeBounds(bounds, this.viewport);
    const now = Date.now();

    const registration: ChromePanelRegistration = {
      config,
      bounds,
      normalizedBounds,
      element,
      registeredAt: now,
      updatedAt: now,
      energyState: config.energyState || this.globalEnergyState,
    };

    this.panels.set(config.id, registration);

    // Set up ResizeObserver for this panel
    const observer = new ResizeObserver(() => {
      this.updatePanelBounds(config.id);
    });
    observer.observe(element);
    this.observers.set(config.id, observer);

    this.notifyListeners();
  }

  /**
   * Unregister a panel
   */
  unregister(id: string): void {
    const observer = this.observers.get(id);
    if (observer) {
      observer.disconnect();
      this.observers.delete(id);
    }

    this.panels.delete(id);
    this.notifyListeners();
  }

  /**
   * Update panel bounds
   */
  updatePanelBounds(id: string): void {
    const registration = this.panels.get(id);
    if (!registration) return;

    const bounds = getBoundsFromElement(registration.element);
    const normalizedBounds = normalizeBounds(bounds, this.viewport);

    this.panels.set(id, {
      ...registration,
      bounds,
      normalizedBounds,
      updatedAt: Date.now(),
    });

    this.notifyListeners();
  }

  /**
   * Update panel energy state
   */
  updatePanelEnergy(id: string, energyState: ChromeEnergyState): void {
    const registration = this.panels.get(id);
    if (!registration) return;

    this.panels.set(id, {
      ...registration,
      energyState,
      updatedAt: Date.now(),
    });

    this.notifyListeners();
  }

  /**
   * Update global energy state
   */
  setGlobalEnergyState(energyState: ChromeEnergyState): void {
    this.globalEnergyState = energyState;

    // Update panels without explicit override
    this.panels.forEach((registration, id) => {
      if (!registration.config.energyState) {
        this.panels.set(id, {
          ...registration,
          energyState,
          updatedAt: Date.now(),
        });
      }
    });

    this.notifyListeners();
  }

  /**
   * Update viewport dimensions
   */
  updateViewport(width: number, height: number): void {
    this.viewport = { width, height };

    // Recalculate all normalized bounds
    this.panels.forEach((registration, id) => {
      const normalizedBounds = normalizeBounds(registration.bounds, this.viewport);
      this.panels.set(id, {
        ...registration,
        normalizedBounds,
        updatedAt: Date.now(),
      });
    });

    this.notifyListeners();
  }

  /**
   * Get current state snapshot
   */
  getState(): ChromeRegistryState {
    return {
      panels: new Map(this.panels),
      globalEnergyState: this.globalEnergyState,
      viewport: { ...this.viewport },
      isReady: true,
    };
  }

  /**
   * Get all panels as array
   */
  getPanels(): ChromePanelRegistration[] {
    return Array.from(this.panels.values());
  }

  /**
   * Get panel by ID
   */
  getPanel(id: string): ChromePanelRegistration | undefined {
    return this.panels.get(id);
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: ChromeRegistryState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Dispose registry and cleanup
   */
  dispose(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
    this.panels.clear();
    this.listeners.clear();
  }
}

/**
 * Create a new chrome panel registry
 */
export function createChromePanelRegistry(): ChromePanelRegistry {
  return new ChromePanelRegistry();
}

export default ChromePanelRegistry;
