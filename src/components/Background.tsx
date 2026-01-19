import { motion, useReducedMotion } from 'framer-motion';
import { AtmosphericFog } from './AtmosphericFog';
import { useFogOptional } from '@/contexts/FogContext';
import { useAnimationVisibility } from '@/hooks/useAnimationVisibility';

/**
 * Background - The Living Void
 *
 * Creates the deep obsidian void that serves as the foundation of Opta's UI.
 * Integrates with the AtmosphericFog system for reactive atmosphere.
 *
 * Key principles:
 * - Deep purple-black void (NO grid pattern)
 * - Subtle depth through gradient layering
 * - Integration with reactive fog system
 * - Performance optimized with GPU acceleration
 *
 * @see DESIGN_SYSTEM.md - Part 2: Visual Identity
 */
export function Background() {
  const prefersReducedMotion = useReducedMotion();
  const fog = useFogOptional();
  const { ref, isVisible } = useAnimationVisibility({ rootMargin: '0px', initiallyVisible: true });

  // Use fog context if available, otherwise default to idle
  const fogIntensity = fog?.intensity ?? 'idle';
  const fogEnabled = fog?.enabled ?? true;

  return (
    <div ref={ref} className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* The Void - Base Layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'hsl(270 50% 3%)', // The deep void
        }}
      />

      {/* Subtle Depth Gradients */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        style={{
          background: `
            radial-gradient(ellipse 100% 100% at 50% 100%, hsl(265 40% 8% / 0.6) 0%, transparent 50%),
            radial-gradient(ellipse 80% 50% at 0% 50%, hsl(270 30% 6% / 0.4) 0%, transparent 40%),
            radial-gradient(ellipse 80% 50% at 100% 50%, hsl(270 30% 6% / 0.4) 0%, transparent 40%)
          `,
        }}
      />

      {/* Ambient Orbs - Very subtle, slow-moving depth enhancers (reduced intensity) */}
      {!prefersReducedMotion && (
        <>
          {/* Deep purple orb - bottom left */}
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(265 60% 12% / 0.1) 0%, transparent 60%)',
              filter: 'blur(100px)',
              left: '-10%',
              bottom: '-20%',
              willChange: 'transform',
            }}
            animate={isVisible ? {
              x: [0, 30, 0],
              y: [0, -20, 0],
            } : { x: 0, y: 0 }}
            transition={isVisible ? {
              duration: 30,
              repeat: Infinity,
              ease: 'easeInOut',
            } : { duration: 0.3 }}
          />

          {/* Deep violet orb - top right */}
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(270 50% 10% / 0.08) 0%, transparent 60%)',
              filter: 'blur(80px)',
              right: '-5%',
              top: '-10%',
              willChange: 'transform',
            }}
            animate={isVisible ? {
              x: [0, -20, 0],
              y: [0, 15, 0],
            } : { x: 0, y: 0 }}
            transition={isVisible ? {
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
            } : { duration: 0.3 }}
          />

          {/* Central subtle glow - reacts to activity (very subtle to avoid bright purple blob) */}
          <motion.div
            className="absolute w-[800px] h-[800px] rounded-full"
            style={{
              background: 'radial-gradient(circle, hsl(265 70% 12% / 0.05) 0%, transparent 50%)',
              filter: 'blur(120px)',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              willChange: 'opacity',
            }}
            animate={{
              opacity: fogIntensity === 'storm' ? 0.15 : fogIntensity === 'active' ? 0.1 : 0.05,
            }}
            transition={{
              duration: 1,
              ease: 'easeOut',
            }}
          />
        </>
      )}

      {/* Atmospheric Fog Layer */}
      <AtmosphericFog
        intensity={fogIntensity}
        enabled={fogEnabled}
        opacity={fog?.customOpacity ?? undefined}
      />

      {/* Vignette - Subtle darkening at edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, hsl(270 50% 2% / 0.6) 100%)',
        }}
      />

      {/* Noise texture for depth and anti-banding */}
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

/**
 * BackgroundSimple - Minimal version without fog integration
 *
 * Use this for pages/modals where fog would be distracting
 * or when fog context is not available.
 */
export function BackgroundSimple() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* The Void - Base Layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'hsl(270 50% 3%)',
        }}
      />

      {/* Subtle Depth Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 100% at 50% 100%, hsl(265 40% 8% / 0.4) 0%, transparent 50%)
          `,
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, hsl(270 50% 2% / 0.6) 100%)',
        }}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export default Background;
