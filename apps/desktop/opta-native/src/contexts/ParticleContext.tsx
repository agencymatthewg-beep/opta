/**
 * ParticleContext - Global Particle Environment State
 *
 * Manages the particle environment system including:
 * - Ambient floating particles (dust motes)
 * - Energy sparks near active elements
 * - Data burst particles on telemetry changes
 * - Ring attraction during processing
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'ambient' | 'spark' | 'burst' | 'attracted';
}

export interface SparkConfig {
  x: number;
  y: number;
  count?: number;
  color?: string;
  spread?: number;
}

export interface BurstConfig {
  x: number;
  y: number;
  count?: number;
  color?: string;
  magnitude?: number;
}

export interface RingPosition {
  x: number;
  y: number;
}

interface ParticleState {
  /** Whether particle system is enabled */
  enabled: boolean;
  /** Current ambient particles */
  ambientParticles: Particle[];
  /** Current spark particles */
  sparkParticles: Particle[];
  /** Current burst particles */
  burstParticles: Particle[];
  /** Ring position for attraction */
  ringPosition: RingPosition | null;
  /** Whether ring attraction is active */
  isAttracting: boolean;
  /** Performance mode (reduces particle count) */
  performanceMode: boolean;
}

interface ParticleContextValue extends ParticleState {
  /** Enable/disable particle system */
  setEnabled: (enabled: boolean) => void;
  /** Trigger spark effect at position */
  triggerSparks: (config: SparkConfig) => void;
  /** Trigger burst effect at position */
  triggerBurst: (config: BurstConfig) => void;
  /** Update ring position for attraction */
  setRingPosition: (position: RingPosition | null) => void;
  /** Enable/disable ring attraction */
  setAttracting: (isAttracting: boolean) => void;
  /** Toggle performance mode */
  setPerformanceMode: (enabled: boolean) => void;
  /** Get all active particles */
  getAllParticles: () => Particle[];
  /** Clear all particles */
  clearAll: () => void;
  /** Update particles (called by animation loop) */
  updateParticles: (deltaTime: number) => void;
  /** Add a particle to ambient pool */
  addAmbientParticle: (particle: Omit<Particle, 'id' | 'type'>) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ParticleContext = createContext<ParticleContextValue | null>(null);

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_AMBIENT_PARTICLES = 100;
const MAX_SPARK_PARTICLES = 50;
const MAX_BURST_PARTICLES = 100;
const MAX_TOTAL_PARTICLES = 200;

// Default colors from design system
const DEFAULT_SPARK_COLOR = '#9333EA'; // Purple
const DEFAULT_BURST_COLOR = '#8b5cf6'; // Neon purple

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

let particleIdCounter = 0;

function generateParticleId(): string {
  return `particle-${++particleIdCounter}-${Date.now()}`;
}

function createSparkParticle(x: number, y: number, color: string, spread: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 4;
  const size = 2 + Math.random() * 2;

  return {
    id: generateParticleId(),
    x: x + (Math.random() - 0.5) * spread,
    y: y + (Math.random() - 0.5) * spread,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    opacity: 0.8 + Math.random() * 0.2,
    color,
    life: 0,
    maxLife: 300 + Math.random() * 200, // 300-500ms
    type: 'spark',
  };
}

function createBurstParticle(
  x: number,
  y: number,
  color: string,
  magnitude: number
): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = 1 + Math.random() * 3 * magnitude;
  const size = 2 + Math.random() * 3;

  return {
    id: generateParticleId(),
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size,
    opacity: 0.6 + Math.random() * 0.4,
    color,
    life: 0,
    maxLife: 400 + Math.random() * 300, // 400-700ms
    type: 'burst',
  };
}

// =============================================================================
// PROVIDER
// =============================================================================

export interface ParticleProviderProps {
  children: React.ReactNode;
  /** Initial enabled state */
  initialEnabled?: boolean;
}

export function ParticleProvider({
  children,
  initialEnabled = true,
}: ParticleProviderProps) {
  const [state, setState] = useState<ParticleState>({
    enabled: initialEnabled,
    ambientParticles: [],
    sparkParticles: [],
    burstParticles: [],
    ringPosition: null,
    isAttracting: false,
    performanceMode: false,
  });

  // Enable/disable system
  const setEnabled = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, enabled }));
  }, []);

  // Trigger spark effect
  const triggerSparks = useCallback((config: SparkConfig) => {
    const {
      x,
      y,
      count = 8,
      color = DEFAULT_SPARK_COLOR,
      spread = 10,
    } = config;

    setState((prev) => {
      if (!prev.enabled) return prev;

      const newSparks: Particle[] = [];
      const actualCount = prev.performanceMode ? Math.ceil(count / 2) : count;

      for (let i = 0; i < actualCount; i++) {
        newSparks.push(createSparkParticle(x, y, color, spread));
      }

      // Limit total sparks
      const combined = [...prev.sparkParticles, ...newSparks];
      const limited = combined.slice(-MAX_SPARK_PARTICLES);

      return { ...prev, sparkParticles: limited };
    });
  }, []);

  // Trigger burst effect
  const triggerBurst = useCallback((config: BurstConfig) => {
    const {
      x,
      y,
      count = 15,
      color = DEFAULT_BURST_COLOR,
      magnitude = 1,
    } = config;

    setState((prev) => {
      if (!prev.enabled) return prev;

      const newBursts: Particle[] = [];
      const actualCount = prev.performanceMode ? Math.ceil(count / 2) : count;

      for (let i = 0; i < actualCount; i++) {
        newBursts.push(createBurstParticle(x, y, color, magnitude));
      }

      // Limit total bursts
      const combined = [...prev.burstParticles, ...newBursts];
      const limited = combined.slice(-MAX_BURST_PARTICLES);

      return { ...prev, burstParticles: limited };
    });
  }, []);

  // Update ring position
  const setRingPosition = useCallback((position: RingPosition | null) => {
    setState((prev) => ({ ...prev, ringPosition: position }));
  }, []);

  // Set attraction state
  const setAttracting = useCallback((isAttracting: boolean) => {
    setState((prev) => ({ ...prev, isAttracting }));
  }, []);

  // Performance mode
  const setPerformanceMode = useCallback((performanceMode: boolean) => {
    setState((prev) => ({ ...prev, performanceMode }));
  }, []);

  // Get all particles
  const getAllParticles = useCallback((): Particle[] => {
    return [
      ...state.ambientParticles,
      ...state.sparkParticles,
      ...state.burstParticles,
    ];
  }, [state.ambientParticles, state.sparkParticles, state.burstParticles]);

  // Clear all particles
  const clearAll = useCallback(() => {
    setState((prev) => ({
      ...prev,
      ambientParticles: [],
      sparkParticles: [],
      burstParticles: [],
    }));
  }, []);

  // Add ambient particle
  const addAmbientParticle = useCallback(
    (particle: Omit<Particle, 'id' | 'type'>) => {
      setState((prev) => {
        if (!prev.enabled) return prev;
        if (prev.ambientParticles.length >= MAX_AMBIENT_PARTICLES) return prev;

        const newParticle: Particle = {
          ...particle,
          id: generateParticleId(),
          type: 'ambient',
        };

        return {
          ...prev,
          ambientParticles: [...prev.ambientParticles, newParticle],
        };
      });
    },
    []
  );

  // Update particles (physics + lifecycle)
  const updateParticles = useCallback((deltaTime: number) => {
    setState((prev) => {
      if (!prev.enabled) return prev;

      const dt = deltaTime / 16.67; // Normalize to 60fps

      // Update ambient particles
      const updatedAmbient = prev.ambientParticles
        .map((p) => {
          let { x, y, vx, vy, life, opacity } = p;

          // Apply attraction if active and ring position exists
          if (prev.isAttracting && prev.ringPosition) {
            const dx = prev.ringPosition.x - x;
            const dy = prev.ringPosition.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 10) {
              const attraction = 0.01; // Very subtle
              vx += (dx / dist) * attraction * dt;
              vy += (dy / dist) * attraction * dt;
            } else {
              // Particle absorbed by ring
              life = p.maxLife;
            }
          }

          // Update position
          x += vx * dt;
          y += vy * dt;

          // Update life
          life += deltaTime;

          // Fade as life progresses
          const lifeRatio = life / p.maxLife;
          opacity = p.opacity * (1 - lifeRatio * 0.5);

          return { ...p, x, y, vx, vy, life, opacity };
        })
        .filter((p) => p.life < p.maxLife);

      // Update spark particles
      const updatedSparks = prev.sparkParticles
        .map((p) => {
          let { x, y, vx, vy, life, opacity, size } = p;

          // Apply friction and gravity
          vx *= 0.95;
          vy *= 0.95;
          vy += 0.05 * dt; // Slight gravity

          // Update position
          x += vx * dt;
          y += vy * dt;

          // Update life
          life += deltaTime;

          // Fade out
          const lifeRatio = life / p.maxLife;
          opacity = (1 - lifeRatio) * 0.8;
          size = p.size * (1 - lifeRatio * 0.3);

          return { ...p, x, y, vx, vy, life, opacity, size };
        })
        .filter((p) => p.life < p.maxLife);

      // Update burst particles
      const updatedBursts = prev.burstParticles
        .map((p) => {
          let { x, y, vx, vy, life, opacity, size } = p;

          // Apply friction
          vx *= 0.98;
          vy *= 0.98;

          // Update position
          x += vx * dt;
          y += vy * dt;

          // Update life
          life += deltaTime;

          // Fade out
          const lifeRatio = life / p.maxLife;
          opacity = (1 - lifeRatio) * p.opacity;
          size = p.size * (1 - lifeRatio * 0.5);

          return { ...p, x, y, vx, vy, life, opacity, size };
        })
        .filter((p) => p.life < p.maxLife);

      // Check total particle count for performance
      const total =
        updatedAmbient.length + updatedSparks.length + updatedBursts.length;
      if (total > MAX_TOTAL_PARTICLES) {
        // Prioritize newer particles, remove oldest
        const excess = total - MAX_TOTAL_PARTICLES;
        updatedAmbient.splice(0, Math.min(excess, updatedAmbient.length));
      }

      return {
        ...prev,
        ambientParticles: updatedAmbient,
        sparkParticles: updatedSparks,
        burstParticles: updatedBursts,
      };
    });
  }, []);

  // Memoize context value
  const value = useMemo<ParticleContextValue>(
    () => ({
      ...state,
      setEnabled,
      triggerSparks,
      triggerBurst,
      setRingPosition,
      setAttracting,
      setPerformanceMode,
      getAllParticles,
      clearAll,
      updateParticles,
      addAmbientParticle,
    }),
    [
      state,
      setEnabled,
      triggerSparks,
      triggerBurst,
      setRingPosition,
      setAttracting,
      setPerformanceMode,
      getAllParticles,
      clearAll,
      updateParticles,
      addAmbientParticle,
    ]
  );

  return (
    <ParticleContext.Provider value={value}>
      {children}
    </ParticleContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to access particle context
 * @throws Error if used outside ParticleProvider
 */
export function useParticles(): ParticleContextValue {
  const context = useContext(ParticleContext);
  if (!context) {
    throw new Error('useParticles must be used within a ParticleProvider');
  }
  return context;
}

/**
 * Hook to access particle context with optional provider
 * Returns null if no provider is present
 */
export function useParticlesOptional(): ParticleContextValue | null {
  return useContext(ParticleContext);
}

export default ParticleContext;
