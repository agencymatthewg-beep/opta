import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * AtmosphericFog - The reactive fog layer of the Living Artifact
 *
 * The fog is ALWAYS present but reactive to activity. It creates depth
 * and mystery, clearing as things become understood.
 *
 * Intensity levels:
 * - idle: Gentle drift, ~15% opacity, slow movement
 * - active: Intensified, ~40% opacity, faster movement
 * - storm: Dramatic fog storm, ~60% opacity, intense glow
 *
 * @see DESIGN_SYSTEM.md - Part 2: Visual Identity
 */

export type FogIntensity = 'idle' | 'active' | 'storm';

interface AtmosphericFogProps {
  /** Fog intensity level */
  intensity?: FogIntensity;
  /** Custom opacity override (0-1) */
  opacity?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable the fog */
  enabled?: boolean;
}

// Intensity to opacity mapping
const intensityOpacity: Record<FogIntensity, number> = {
  idle: 0.15,
  active: 0.35,
  storm: 0.55,
};

// Animation durations based on intensity
const intensityDuration: Record<FogIntensity, number> = {
  idle: 30,
  active: 15,
  storm: 8,
};

// Fog layer configurations
const fogLayers = [
  {
    id: 'deep',
    baseOpacity: 0.4,
    blur: '120px',
    scale: 1.5,
    zIndex: 0,
    durationMultiplier: 1.5,
  },
  {
    id: 'mid',
    baseOpacity: 0.3,
    blur: '80px',
    scale: 1.2,
    zIndex: 1,
    durationMultiplier: 1,
  },
  {
    id: 'near',
    baseOpacity: 0.2,
    blur: '40px',
    scale: 1,
    zIndex: 2,
    durationMultiplier: 0.7,
  },
];

export function AtmosphericFog({
  intensity = 'idle',
  opacity: customOpacity,
  className,
  enabled = true,
}: AtmosphericFogProps) {
  const prefersReducedMotion = useReducedMotion();

  if (!enabled) return null;

  const baseOpacity = customOpacity ?? intensityOpacity[intensity];
  const baseDuration = intensityDuration[intensity];

  return (
    <div
      className={cn(
        'fixed inset-0 pointer-events-none overflow-hidden',
        className
      )}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {fogLayers.map((layer) => (
        <FogLayer
          key={layer.id}
          layer={layer}
          intensity={intensity}
          baseOpacity={baseOpacity}
          baseDuration={baseDuration}
          reducedMotion={prefersReducedMotion ?? false}
        />
      ))}

      {/* Central glow that intensifies with activity */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
        }}
        animate={{
          opacity: intensity === 'storm' ? [0.4, 0.7, 0.4] : intensity === 'active' ? [0.2, 0.4, 0.2] : 0.1,
          scale: intensity === 'storm' ? [1, 1.2, 1] : 1,
        }}
        transition={{
          duration: intensity === 'storm' ? 2 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

interface FogLayerProps {
  layer: (typeof fogLayers)[number];
  intensity: FogIntensity;
  baseOpacity: number;
  baseDuration: number;
  reducedMotion: boolean;
}

function FogLayer({
  layer,
  intensity,
  baseOpacity,
  baseDuration,
  reducedMotion,
}: FogLayerProps) {
  const duration = baseDuration * layer.durationMultiplier;
  const opacity = baseOpacity * layer.baseOpacity;

  // Movement patterns based on intensity
  const getMovementPattern = () => {
    if (reducedMotion) {
      return { x: 0, y: 0 };
    }

    const baseMovement = intensity === 'storm' ? 60 : intensity === 'active' ? 40 : 20;

    return {
      x: [0, baseMovement, -baseMovement / 2, baseMovement / 3, 0],
      y: [0, -baseMovement / 2, baseMovement, -baseMovement / 3, 0],
    };
  };

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        zIndex: layer.zIndex,
        willChange: 'transform, opacity',
      }}
      initial={{ opacity: 0 }}
      animate={{
        opacity,
        ...getMovementPattern(),
      }}
      transition={{
        opacity: { duration: 1 },
        x: { duration, repeat: Infinity, ease: 'easeInOut' },
        y: { duration: duration * 0.8, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {/* Fog gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 60% at 30% 40%,
              rgba(168, 85, 247, ${opacity * 0.8}) 0%,
              transparent 60%
            ),
            radial-gradient(
              ellipse 60% 80% at 70% 60%,
              rgba(139, 92, 246, ${opacity * 0.6}) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse 100% 100% at 50% 50%,
              rgba(124, 58, 237, ${opacity * 0.4}) 0%,
              transparent 70%
            )
          `,
          filter: `blur(${layer.blur})`,
          transform: `scale(${layer.scale})`,
        }}
      />

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </motion.div>
  );
}

/**
 * FogPulse - Trigger a brief fog intensity spike
 *
 * Use this for click/interaction feedback.
 */
export function FogPulse({
  active,
  children,
  className,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      {children}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-inherit"
        style={{
          background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={
          active
            ? { opacity: [0, 0.6, 0], scale: [0.8, 1.2, 1] }
            : { opacity: 0, scale: 0.8 }
        }
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

export default AtmosphericFog;
