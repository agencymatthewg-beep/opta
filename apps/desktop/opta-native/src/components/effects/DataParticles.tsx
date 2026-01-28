/**
 * DataParticles Component
 *
 * Particle effect for data flow visualization using tsParticles.
 * Creates ambient background particles representing data activity.
 *
 * Presets:
 * - upload: Green particles flowing up
 * - download: Blue particles flowing down
 * - processing: Purple particles moving radially
 * - idle: Very slow, sparse movement
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useCallback, useMemo, useState, useId, useEffect } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import { MoveDirection, OutMode } from '@tsparticles/engine';
import type { Container, ISourceOptions } from '@tsparticles/engine';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface DataParticlesProps {
  /** Flow direction */
  direction?: 'up' | 'down' | 'radial';
  /** Intensity 0-1, affects particle count and speed */
  intensity?: number;
  /** Design system color */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Preset configuration */
  preset?: 'upload' | 'download' | 'processing' | 'idle';
}

// Preset configurations
const presetConfigs: Record<string, { direction: 'up' | 'down' | 'radial'; color: string; intensity: number }> = {
  upload: { direction: 'up', color: '#10b981', intensity: 0.6 },    // Green
  download: { direction: 'down', color: '#3b82f6', intensity: 0.6 }, // Blue
  processing: { direction: 'radial', color: '#8b5cf6', intensity: 0.5 }, // Purple
  idle: { direction: 'radial', color: '#6b7280', intensity: 0.15 }, // Gray
};

// =============================================================================
// TSPARTICLES ENGINE INITIALIZATION
// =============================================================================

let engineInitialized = false;

// =============================================================================
// PARTICLE OPTIONS GENERATOR
// =============================================================================

function createParticleOptions(
  direction: 'up' | 'down' | 'radial',
  color: string,
  intensity: number,
  reducedMotion: boolean
): ISourceOptions {
  // Particle count scales with intensity (5-50 particles)
  const particleCount = Math.round(5 + intensity * 45);

  // Speed scales with intensity
  const baseSpeed = reducedMotion ? 0 : 0.5 + intensity * 2;

  // Determine move direction and out modes
  let moveDirection: MoveDirection = MoveDirection.none;
  let outModes: OutMode = OutMode.out;

  switch (direction) {
    case 'up':
      moveDirection = MoveDirection.top;
      outModes = OutMode.out;
      break;
    case 'down':
      moveDirection = MoveDirection.bottom;
      outModes = OutMode.out;
      break;
    case 'radial':
      moveDirection = MoveDirection.none;
      outModes = OutMode.bounce;
      break;
  }

  return {
    fullScreen: false,
    fpsLimit: 60,
    particles: {
      number: {
        value: particleCount,
        density: {
          enable: true,
          width: 800,
          height: 600,
        },
      },
      color: {
        value: color,
      },
      shape: {
        type: 'circle',
      },
      opacity: {
        value: {
          min: 0.2,
          max: 0.6,
        },
        animation: {
          enable: !reducedMotion,
          speed: 0.5,
          sync: false,
        },
      },
      size: {
        value: {
          min: 2,
          max: 4,
        },
        animation: {
          enable: !reducedMotion,
          speed: 1,
          sync: false,
        },
      },
      move: {
        enable: !reducedMotion,
        speed: baseSpeed,
        direction: moveDirection,
        random: direction === 'radial',
        straight: direction !== 'radial',
        outModes: outModes,
        attract: {
          enable: direction === 'radial',
          rotate: {
            x: 600,
            y: 1200,
          },
        },
      },
      shadow: {
        enable: true,
        color: color,
        blur: 8,
        offset: {
          x: 0,
          y: 0,
        },
      },
    },
    interactivity: {
      events: {
        // Disable interactivity - particles should be background effect
        onHover: {
          enable: false,
        },
        onClick: {
          enable: false,
        },
      },
    },
    detectRetina: true,
    background: {
      opacity: 0,
    },
  };
}

// =============================================================================
// STATIC PARTICLES FALLBACK (for reduced motion)
// =============================================================================

interface StaticParticlesProps {
  color: string;
  count: number;
}

function StaticParticles({ color, count }: StaticParticlesProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 2,
      opacity: 0.2 + Math.random() * 0.4,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DataParticles({
  direction: directionProp,
  intensity: intensityProp,
  color: colorProp,
  className,
  preset,
}: DataParticlesProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isEngineReady, setIsEngineReady] = useState(engineInitialized);
  const particlesId = useId();

  // Initialize tsParticles engine once
  useEffect(() => {
    if (engineInitialized) {
      setIsEngineReady(true);
      return;
    }

    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      engineInitialized = true;
      setIsEngineReady(true);
    });
  }, []);

  // Resolve preset or individual props
  const config = useMemo(() => {
    if (preset && presetConfigs[preset]) {
      return {
        direction: directionProp ?? presetConfigs[preset].direction,
        color: colorProp ?? presetConfigs[preset].color,
        intensity: intensityProp ?? presetConfigs[preset].intensity,
      };
    }
    return {
      direction: directionProp ?? 'radial',
      color: colorProp ?? '#8b5cf6',
      intensity: intensityProp ?? 0.3,
    };
  }, [preset, directionProp, colorProp, intensityProp]);

  // Handle container loaded
  const particlesLoaded = useCallback(async (_container?: Container) => {
    // Container is ready
  }, []);

  // Generate particle options
  const options = useMemo(() => {
    return createParticleOptions(
      config.direction,
      config.color,
      config.intensity,
      prefersReducedMotion
    );
  }, [config.direction, config.color, config.intensity, prefersReducedMotion]);

  // Calculate particle count for static fallback
  const staticParticleCount = Math.round(5 + config.intensity * 45);

  // For reduced motion, show static dots
  if (prefersReducedMotion) {
    return (
      <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
        <StaticParticles color={config.color} count={staticParticleCount} />
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        {isEngineReady && (
          <Particles
            id={particlesId}
            particlesLoaded={particlesLoaded}
            options={options}
            className="absolute inset-0"
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// PRESET COMPONENTS
// =============================================================================

/**
 * Upload particles (green, flowing up)
 */
export function UploadParticles(props: Omit<DataParticlesProps, 'preset'>) {
  return <DataParticles preset="upload" {...props} />;
}

/**
 * Download particles (blue, flowing down)
 */
export function DownloadParticles(props: Omit<DataParticlesProps, 'preset'>) {
  return <DataParticles preset="download" {...props} />;
}

/**
 * Processing particles (purple, radial)
 */
export function ProcessingParticles(props: Omit<DataParticlesProps, 'preset'>) {
  return <DataParticles preset="processing" {...props} />;
}

/**
 * Idle particles (gray, very subtle)
 */
export function IdleParticles(props: Omit<DataParticlesProps, 'preset'>) {
  return <DataParticles preset="idle" {...props} />;
}

export default DataParticles;
