/**
 * AtmosphericFogConnected - Pre-connected to OptaRingContext
 *
 * This component automatically syncs with the OptaRing state and
 * provides the atmospheric fog effect with proper energy level
 * and color transitions.
 *
 * Use this in Layout.tsx as the main atmospheric fog layer:
 *
 * ```tsx
 * <AtmosphericFogConnected />
 * ```
 *
 * @see Phase 30: Atmospheric Fog System
 */

import { useReducedMotion } from 'framer-motion';
import { AtmosphericFog, AtmosphericFogStatic } from './AtmosphericFog';
import { useAtmosphericFog } from '@/hooks/useAtmosphericFog';

export interface AtmosphericFogConnectedProps {
  /** Custom center X position (defaults to 50%) */
  centerX?: string;
  /** Custom center Y position (defaults to 50%) */
  centerY?: string;
  /** Additional CSS classes */
  className?: string;
}

export function AtmosphericFogConnected({
  centerX = '50%',
  centerY = '50%',
  className,
}: AtmosphericFogConnectedProps) {
  // Get fog state from hook (connected to OptaRingContext)
  const { ringState, energyLevel, enabled } = useAtmosphericFog();

  // Respect reduced motion preference
  const prefersReducedMotion = useReducedMotion();

  // Use static version for reduced motion
  const FogComponent = prefersReducedMotion ? AtmosphericFogStatic : AtmosphericFog;

  return (
    <FogComponent
      ringState={ringState}
      energyLevel={energyLevel}
      enabled={enabled}
      centerX={centerX}
      centerY={centerY}
      className={className}
    />
  );
}

export default AtmosphericFogConnected;
