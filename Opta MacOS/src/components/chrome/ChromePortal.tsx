/**
 * ChromePortal - Dynamic Content Support for Chrome System
 *
 * Enables modals, dialogs, and dynamically added content to have
 * their own GPU-rendered chrome effects with proper lifecycle handling.
 *
 * Features:
 * - Automatic panel registration on mount
 * - Smooth appear/disappear transitions
 * - Portal-aware rendering (z-index management)
 * - Animation presets for modals, toasts, dropdowns
 *
 * @see ChromePanel.tsx - Base panel wrapper
 * @see ChromeRegistry.ts - Panel registration system
 */

import {
  forwardRef,
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, type Variants, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useChromeOptional } from '@/contexts/ChromeContext';
import type { ChromeEnergyState, ChromePanelConfig } from './ChromeRegistry';

// =============================================================================
// TYPES
// =============================================================================

/** Animation preset types */
export type ChromeAnimationPreset = 'modal' | 'dropdown' | 'toast' | 'drawer' | 'fade' | 'scale' | 'none';

/** Lifecycle event callbacks */
export interface ChromeLifecycleCallbacks {
  /** Called after panel mounts and chrome renders */
  onMounted?: () => void;
  /** Called before panel unmounts */
  onUnmounting?: () => void;
  /** Called after panel fully removed */
  onUnmounted?: () => void;
  /** Called when chrome effect starts rendering */
  onChromeReady?: () => void;
}

export interface ChromePortalProps extends Omit<HTMLMotionProps<'div'>, 'id'> {
  /** Unique identifier for the panel (required) */
  id: string;
  /** Portal content */
  children: ReactNode;
  /** Whether portal is visible */
  open: boolean;
  /** Animation preset */
  animationPreset?: ChromeAnimationPreset;
  /** Custom animation variants */
  customVariants?: Variants;
  /** Animation duration in seconds */
  duration?: number;
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
  /** Lifecycle callbacks */
  lifecycle?: ChromeLifecycleCallbacks;
  /** Additional CSS classes */
  className?: string;
  /** Portal container z-index */
  zIndex?: number;
}

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

const ANIMATION_PRESETS: Record<ChromeAnimationPreset, Variants> = {
  modal: {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  },
  dropdown: {
    initial: { opacity: 0, scale: 0.95, y: -8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -8 },
  },
  toast: {
    initial: { opacity: 0, x: 100, scale: 0.9 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 100, scale: 0.9 },
  },
  drawer: {
    initial: { opacity: 0, x: '100%' },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: '100%' },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ChromePortal - Portal with GPU chrome effects
 *
 * Wraps dynamic content (modals, dropdowns, etc.) with automatic
 * chrome registration and smooth animations.
 *
 * @example
 * ```tsx
 * <ChromePortal
 *   id="confirm-modal"
 *   open={isOpen}
 *   animationPreset="modal"
 *   glowBorders
 *   lifecycle={{
 *     onMounted: () => console.log('Modal visible'),
 *     onUnmounted: () => console.log('Modal removed'),
 *   }}
 * >
 *   <DialogContent>
 *     <DialogHeader>Confirm Action</DialogHeader>
 *   </DialogContent>
 * </ChromePortal>
 * ```
 */
export const ChromePortal = forwardRef<HTMLDivElement, ChromePortalProps>(
  (
    {
      id,
      children,
      open,
      animationPreset = 'modal',
      customVariants,
      duration = 0.2,
      glowBorders = true,
      borderRadius = 12,
      blurIntensity = 0.5,
      energyState: initialEnergyState,
      depth = 0.1, // Slight depth for modal separation
      groupId = 'portals',
      lifecycle,
      className,
      zIndex = 50,
      ...motionProps
    },
    forwardedRef
  ) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const chromeContext = useChromeOptional();
    const [isRegistered, setIsRegistered] = useState(false);
    const [currentEnergy, setCurrentEnergy] = useState<ChromeEnergyState>(
      initialEnergyState || 'active' // Portals default to active
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

    // Variants
    const variants = customVariants || ANIMATION_PRESETS[animationPreset];

    // Transition config
    const transition = {
      duration,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number], // Custom ease for smooth feel
    };

    // ==========================================================================
    // REGISTRATION
    // ==========================================================================

    // Register with chrome system when visible
    useEffect(() => {
      if (!open) return;

      const element = ref.current;
      if (!element || !chromeContext?.state.isEnabled) return;

      // Small delay to let element render first
      const timer = setTimeout(() => {
        chromeContext.actions.registerPanel(element, config);
        setIsRegistered(true);
        lifecycle?.onChromeReady?.();
      }, 50);

      return () => {
        clearTimeout(timer);
        chromeContext.actions.unregisterPanel(id);
        setIsRegistered(false);
      };
    }, [open, chromeContext, id, config, ref, lifecycle]);

    // ==========================================================================
    // LIFECYCLE CALLBACKS
    // ==========================================================================

    // On mount callback
    const handleAnimationComplete = useCallback(
      (definition: string) => {
        if (definition === 'animate') {
          lifecycle?.onMounted?.();
        }
      },
      [lifecycle]
    );

    // On exit start
    const handleExitStart = useCallback(() => {
      lifecycle?.onUnmounting?.();
    }, [lifecycle]);

    // On exit complete
    const handleExitComplete = useCallback(() => {
      lifecycle?.onUnmounted?.();
    }, [lifecycle]);

    // ==========================================================================
    // ENERGY STATE
    // ==========================================================================

    // Update energy state
    const setEnergy = useCallback(
      (state: ChromeEnergyState) => {
        setCurrentEnergy(state);
        if (chromeContext?.state.isEnabled && isRegistered) {
          chromeContext.actions.setPanelEnergy(id, state);
        }
      },
      [chromeContext, id, isRegistered]
    );

    // Pulse on open
    useEffect(() => {
      if (open && isRegistered) {
        setEnergy('pulse');
        const timer = setTimeout(() => {
          setEnergy('active');
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [open, isRegistered, setEnergy]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    // Determine if using WebGL or CSS fallback
    const useWebGL = chromeContext?.state.isEnabled ?? false;

    // CSS fallback classes
    const fallbackClasses = !useWebGL
      ? cn(
          'glass-strong',
          glowBorders && 'ring-1 ring-primary/30',
          currentEnergy === 'pulse' && 'animate-pulse'
        )
      : '';

    // When using WebGL, make background transparent so WebGL shows through
    const webglClasses = useWebGL ? 'bg-transparent' : '';

    return (
      <AnimatePresence onExitComplete={handleExitComplete}>
        {open && (
          <motion.div
            ref={ref}
            data-chrome-portal={id}
            data-chrome-energy={currentEnergy}
            className={cn(
              'relative',
              webglClasses,
              fallbackClasses,
              className
            )}
            style={{
              borderRadius: `${borderRadius}px`,
              zIndex,
            }}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transition}
            onAnimationComplete={handleAnimationComplete}
            onAnimationStart={(definition) => {
              if (definition === 'exit') {
                handleExitStart();
              }
            }}
            {...motionProps}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

ChromePortal.displayName = 'ChromePortal';

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook for portal chrome lifecycle management
 *
 * @example
 * ```tsx
 * function MyModal() {
 *   const { register, unregister, pulse, setEnergy } = useChromePortal('my-modal');
 *
 *   useEffect(() => {
 *     if (isOpen) {
 *       register(modalRef.current, { glowBorders: true });
 *       pulse();
 *     }
 *     return () => unregister();
 *   }, [isOpen]);
 * }
 * ```
 */
export function useChromePortal(panelId: string) {
  const chromeContext = useChromeOptional();
  const [isRegistered, setIsRegistered] = useState(false);

  const register = useCallback(
    (element: HTMLElement | null, config: Partial<ChromePanelConfig> = {}) => {
      if (!element || !chromeContext?.state.isEnabled) return;

      const fullConfig: ChromePanelConfig = {
        id: panelId,
        glowBorders: true,
        borderRadius: 12,
        blurIntensity: 0.5,
        depth: 0.1,
        groupId: 'portals',
        ...config,
      };

      chromeContext.actions.registerPanel(element, fullConfig);
      setIsRegistered(true);
    },
    [chromeContext, panelId]
  );

  const unregister = useCallback(() => {
    if (chromeContext?.state.isEnabled) {
      chromeContext.actions.unregisterPanel(panelId);
      setIsRegistered(false);
    }
  }, [chromeContext, panelId]);

  const setEnergy = useCallback(
    (state: ChromeEnergyState) => {
      if (chromeContext?.state.isEnabled && isRegistered) {
        chromeContext.actions.setPanelEnergy(panelId, state);
      }
    },
    [chromeContext, panelId, isRegistered]
  );

  const pulse = useCallback(() => {
    setEnergy('pulse');
    setTimeout(() => setEnergy('active'), 300);
  }, [setEnergy]);

  return {
    register,
    unregister,
    setEnergy,
    pulse,
    isRegistered,
    isChromeEnabled: chromeContext?.state.isEnabled ?? false,
  };
}

export default ChromePortal;
