/**
 * ChromePanel - GPU Glass Panel Wrapper
 *
 * A React component that wraps content and automatically registers
 * it with the Chrome system for GPU-rendered glass effects.
 *
 * Features:
 * - Automatic registration/unregistration
 * - Energy state management
 * - Hover/focus detection for active states
 * - Seamless fallback to CSS glass
 *
 * @example
 * ```tsx
 * <ChromePanel id="dashboard-card" glowBorders>
 *   <CardContent>Your content here</CardContent>
 * </ChromePanel>
 * ```
 *
 * @see ChromeContext.tsx - Context provider
 * @see ChromeCanvas.tsx - WebGL renderer
 */

import {
  forwardRef,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useChromeOptional } from '@/contexts/ChromeContext';
import type { ChromeEnergyState, ChromePanelConfig } from './ChromeRegistry';

// =============================================================================
// TYPES
// =============================================================================

export interface ChromePanelProps extends Omit<HTMLMotionProps<'div'>, 'id'> {
  /** Unique identifier for the panel (required) */
  id: string;
  /** Panel content */
  children: ReactNode;
  /** Whether borders should glow */
  glowBorders?: boolean;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Glass blur intensity (0-1) */
  blurIntensity?: number;
  /** Initial energy state */
  energyState?: ChromeEnergyState;
  /** Z-depth for parallax effects */
  depth?: number;
  /** Group ID for batch rendering */
  groupId?: string;
  /** Whether to auto-activate on hover */
  activateOnHover?: boolean;
  /** Whether to auto-activate on focus */
  activateOnFocus?: boolean;
  /** Callback when energy state changes */
  onEnergyChange?: (state: ChromeEnergyState) => void;
  /** Additional CSS classes */
  className?: string;
  /** Use as slot (no wrapper div) */
  asChild?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ChromePanel wraps content for GPU glass rendering.
 *
 * When Chrome system is enabled:
 * - Registers panel bounds with ChromeContext
 * - WebGL renders glass effect behind content
 * - HTML remains interactive on top
 *
 * When Chrome system is disabled (fallback):
 * - Renders with CSS glass classes
 * - No WebGL registration occurs
 */
export const ChromePanel = forwardRef<HTMLDivElement, ChromePanelProps>(
  (
    {
      id,
      children,
      glowBorders = false,
      borderRadius = 12,
      blurIntensity = 0.5,
      energyState: initialEnergyState,
      depth = 0,
      groupId,
      activateOnHover = true,
      activateOnFocus = true,
      onEnergyChange,
      className,
      asChild = false,
      ...motionProps
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const chromeContext = useChromeOptional();
    const [currentEnergy, setCurrentEnergy] = useState<ChromeEnergyState>(
      initialEnergyState || 'dormant'
    );

    // Merge refs
    const ref = (forwardedRef as React.RefObject<HTMLDivElement>) || internalRef;

    // Build config
    const config: ChromePanelConfig = {
      id,
      glowBorders,
      borderRadius,
      blurIntensity,
      energyState: initialEnergyState,
      depth,
      groupId,
    };

    // Register with chrome system
    useEffect(() => {
      const element = ref.current;
      if (!element || !chromeContext?.state.isEnabled) return;

      chromeContext.actions.registerPanel(element, config);

      return () => {
        chromeContext.actions.unregisterPanel(id);
      };
    }, [chromeContext, id, config, ref]);

    // Update energy state
    const setEnergy = useCallback(
      (state: ChromeEnergyState) => {
        setCurrentEnergy(state);
        onEnergyChange?.(state);

        if (chromeContext?.state.isEnabled) {
          chromeContext.actions.setPanelEnergy(id, state);
        }
      },
      [chromeContext, id, onEnergyChange]
    );

    // Hover handlers
    const handleMouseEnter = useCallback(() => {
      if (activateOnHover && currentEnergy === 'dormant') {
        setEnergy('active');
      }
    }, [activateOnHover, currentEnergy, setEnergy]);

    const handleMouseLeave = useCallback(() => {
      if (activateOnHover && currentEnergy === 'active') {
        setEnergy('dormant');
      }
    }, [activateOnHover, currentEnergy, setEnergy]);

    // Focus handlers
    const handleFocus = useCallback(() => {
      if (activateOnFocus) {
        setEnergy('active');
      }
    }, [activateOnFocus, setEnergy]);

    const handleBlur = useCallback(() => {
      if (activateOnFocus && currentEnergy === 'active') {
        setEnergy('dormant');
      }
    }, [activateOnFocus, currentEnergy, setEnergy]);

    // Determine if using WebGL or CSS fallback
    const useWebGL = chromeContext?.state.isEnabled ?? false;

    // CSS fallback classes
    const fallbackClasses = !useWebGL
      ? cn(
          // Base glass effect
          'glass',
          // Glow borders in CSS
          glowBorders && 'ring-1 ring-primary/20',
          // Energy state styling
          currentEnergy === 'active' && 'glass-strong',
          currentEnergy === 'pulse' && 'glass-strong animate-pulse',
          currentEnergy === 'storm' && 'glass-strong ring-2 ring-primary/40'
        )
      : '';

    // When using WebGL, make background transparent so WebGL shows through
    const webglClasses = useWebGL ? 'bg-transparent' : '';

    return (
      <motion.div
        ref={ref}
        data-chrome-panel={id}
        data-chrome-energy={currentEnergy}
        className={cn(
          'relative',
          webglClasses,
          fallbackClasses,
          className
        )}
        style={{
          borderRadius: `${borderRadius}px`,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...motionProps}
      >
        {children}
      </motion.div>
    );
  }
);

ChromePanel.displayName = 'ChromePanel';

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

/**
 * Simple wrapper that just registers with chrome system
 * Use when you want full control over styling
 */
export interface ChromeRegistrationProps {
  id: string;
  children: (ref: React.RefCallback<HTMLElement>) => ReactNode;
  config?: Partial<Omit<ChromePanelConfig, 'id'>>;
}

export function ChromeRegistration({ id, children, config = {} }: ChromeRegistrationProps) {
  const chromeContext = useChromeOptional();
  const elementRef = useRef<HTMLElement | null>(null);

  const fullConfig: ChromePanelConfig = {
    id,
    glowBorders: false,
    borderRadius: 12,
    blurIntensity: 0.5,
    depth: 0,
    ...config,
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !chromeContext?.state.isEnabled) return;

    chromeContext.actions.registerPanel(element, fullConfig);

    return () => {
      chromeContext.actions.unregisterPanel(id);
    };
  }, [chromeContext, id, fullConfig]);

  const setRef = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
  }, []);

  return <>{children(setRef)}</>;
}

export default ChromePanel;
