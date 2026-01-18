import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAnimationVisibility } from '@/hooks/useAnimationVisibility';

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
export type ColorTemperature = 'cool' | 'warm' | 'neutral';

interface AtmosphericFogProps {
  /** Fog intensity level */
  intensity?: FogIntensity;
  /** Custom opacity override (0-1) */
  opacity?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to enable the fog */
  enabled?: boolean;
  /** Ring energy level (0-1) for dynamic intensity coupling */
  ringEnergy?: number;
  /** Whether fog is billowing (activation animation) */
  isBillowing?: boolean;
  /** Color temperature for ring state coupling */
  colorTemperature?: ColorTemperature;
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

// Color temperature palettes (RGB values for fog gradients)
const colorTemperaturePalettes: Record<ColorTemperature, { primary: string; secondary: string; tertiary: string }> = {
  cool: {
    primary: 'rgba(124, 58, 237',    // Deep violet (dormant)
    secondary: 'rgba(99, 102, 241',  // Indigo tint
    tertiary: 'rgba(79, 70, 229',    // Blue-violet
  },
  warm: {
    primary: 'rgba(168, 85, 247',    // Electric violet (active)
    secondary: 'rgba(192, 132, 252', // Plasma purple
    tertiary: 'rgba(139, 92, 246',   // Warm violet
  },
  neutral: {
    primary: 'rgba(168, 85, 247',    // Default violet
    secondary: 'rgba(139, 92, 246',  // Mid violet
    tertiary: 'rgba(124, 58, 237',   // Deep violet
  },
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
  ringEnergy = 0,
  isBillowing = false,
  colorTemperature = 'neutral',
}: AtmosphericFogProps) {
  const prefersReducedMotion = useReducedMotion();
  const { ref, isVisible } = useAnimationVisibility({ rootMargin: '200px' });

  if (!enabled) return null;

  // Calculate dynamic opacity based on ring energy
  // Ring energy 0 = minimal fog (0.1), energy 1 = dense fog (0.55)
  const energyOpacity = 0.1 + ringEnergy * 0.45;
  const baseOpacity = customOpacity ?? Math.max(intensityOpacity[intensity], energyOpacity);
  const baseDuration = intensityDuration[intensity];
  const colorPalette = colorTemperaturePalettes[colorTemperature];

  return (
    <div
      ref={ref}
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
          isVisible={isVisible}
          isBillowing={isBillowing}
          colorPalette={colorPalette}
        />
      ))}

      {/* Central glow that intensifies with activity - paused when not visible */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
        }}
        animate={isVisible ? {
          opacity: intensity === 'storm' ? [0.4, 0.7, 0.4] : intensity === 'active' ? [0.2, 0.4, 0.2] : 0.1,
          scale: intensity === 'storm' ? [1, 1.2, 1] : 1,
        } : { opacity: 0.1, scale: 1 }}
        transition={isVisible ? {
          duration: intensity === 'storm' ? 2 : 4,
          repeat: Infinity,
          ease: 'easeInOut',
        } : { duration: 0.3 }}
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
  isVisible: boolean;
  isBillowing: boolean;
  colorPalette: { primary: string; secondary: string; tertiary: string };
}

function FogLayer({
  layer,
  intensity,
  baseOpacity,
  baseDuration,
  reducedMotion,
  isVisible,
  isBillowing,
  colorPalette,
}: FogLayerProps) {
  const duration = baseDuration * layer.durationMultiplier;
  const opacity = baseOpacity * layer.baseOpacity;

  // Movement patterns based on intensity - returns static position when not visible
  const getMovementPattern = () => {
    if (reducedMotion || !isVisible) {
      return { x: 0, y: 0 };
    }

    // Billowing adds extra turbulent movement
    const billowMultiplier = isBillowing ? 1.8 : 1;
    const baseMovement = (intensity === 'storm' ? 60 : intensity === 'active' ? 40 : 20) * billowMultiplier;

    return {
      x: [0, baseMovement, -baseMovement / 2, baseMovement / 3, 0],
      y: [0, -baseMovement / 2, baseMovement, -baseMovement / 3, 0],
    };
  };

  // Billowing scale animation
  const billowScale = isBillowing ? 1.15 : 1;

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        zIndex: layer.zIndex,
        willChange: 'transform, opacity',
      }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: isBillowing ? opacity * 1.3 : opacity,
        scale: billowScale,
        ...getMovementPattern(),
      }}
      transition={isVisible ? {
        opacity: { duration: isBillowing ? 0.3 : 1 },
        scale: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
        x: { duration: isBillowing ? duration * 0.5 : duration, repeat: Infinity, ease: 'easeInOut' },
        y: { duration: isBillowing ? duration * 0.4 : duration * 0.8, repeat: Infinity, ease: 'easeInOut' },
      } : { opacity: { duration: 0.3 } }}
    >
      {/* Fog gradient - uses color palette */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 60% at 30% 40%,
              ${colorPalette.primary}, ${opacity * 0.8}) 0%,
              transparent 60%
            ),
            radial-gradient(
              ellipse 60% 80% at 70% 60%,
              ${colorPalette.secondary}, ${opacity * 0.6}) 0%,
              transparent 50%
            ),
            radial-gradient(
              ellipse 100% 100% at 50% 50%,
              ${colorPalette.tertiary}, ${opacity * 0.4}) 0%,
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
