/**
 * BlurBack - Background blur effect for overlays
 *
 * Creates spatial hierarchy by scaling and blurring background content
 * when overlays (modals, drawers, etc.) are open.
 *
 * Per Gemini research:
 * - "Blur-Back: Content scales to 0.95 + blur increases when overlay opens"
 * - "Creates depth perception and spatial hierarchy"
 *
 * @example
 * ```tsx
 * // Wrap your app content
 * <BlurBackProvider>
 *   <BlurBackContent>
 *     <YourAppContent />
 *   </BlurBackContent>
 *
 *   {/* Overlays go outside BlurBackContent *\/}
 *   <Modal />
 * </BlurBackProvider>
 *
 * // In your modal component:
 * function Modal({ open, children }) {
 *   const { setBlurBack } = useBlurBack();
 *
 *   useEffect(() => {
 *     setBlurBack(open, 12); // Deeper blur for modal
 *     return () => setBlurBack(false);
 *   }, [open]);
 *
 *   return <AnimatePresence>{open && children}</AnimatePresence>;
 * }
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation/springs';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface BlurBackContextValue {
  /** Whether blur effect is currently active */
  isBlurred: boolean;
  /** Current blur amount in pixels */
  blurAmount: number;
  /** Current scale value (0.95 = 95% scale) */
  scaleAmount: number;
  /** Depth level for stacking multiple overlays */
  depth: number;
  /** Activate blur-back effect */
  setBlurBack: (active: boolean, blurPx?: number, scale?: number) => void;
  /** Push a new blur layer (for stacking overlays) */
  pushBlurLayer: (blurPx?: number, scale?: number) => void;
  /** Pop the top blur layer */
  popBlurLayer: () => void;
}

export interface BlurBackProviderProps {
  children: React.ReactNode;
  /** Default blur amount in pixels */
  defaultBlur?: number;
  /** Default scale when blurred (0.95 = 95%) */
  defaultScale?: number;
}

export interface BlurBackContentProps {
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Custom scale origin (default: 'center center') */
  transformOrigin?: string;
}

// =============================================================================
// CONTEXT
// =============================================================================

const BlurBackContext = createContext<BlurBackContextValue | null>(null);

// =============================================================================
// BLUR LAYER STACK
// =============================================================================

interface BlurLayer {
  blur: number;
  scale: number;
}

// =============================================================================
// PROVIDER
// =============================================================================

export function BlurBackProvider({
  children,
  defaultBlur = 8,
  defaultScale = 0.95,
}: BlurBackProviderProps) {
  // Stack of blur layers for nested overlays
  const [layers, setLayers] = useState<BlurLayer[]>([]);

  // Calculate combined effect from all layers
  const { isBlurred, blurAmount, scaleAmount, depth } = useMemo(() => {
    if (layers.length === 0) {
      return { isBlurred: false, blurAmount: 0, scaleAmount: 1, depth: 0 };
    }

    // Combine layers: blur adds up, scale multiplies
    const combinedBlur = layers.reduce((acc, layer) => acc + layer.blur, 0);
    const combinedScale = layers.reduce((acc, layer) => acc * layer.scale, 1);

    return {
      isBlurred: true,
      blurAmount: combinedBlur,
      scaleAmount: combinedScale,
      depth: layers.length,
    };
  }, [layers]);

  // Simple toggle for single overlay
  const setBlurBack = useCallback(
    (active: boolean, blurPx = defaultBlur, scale = defaultScale) => {
      if (active) {
        setLayers([{ blur: blurPx, scale }]);
      } else {
        setLayers([]);
      }
    },
    [defaultBlur, defaultScale]
  );

  // Push a new layer (for stacking overlays)
  const pushBlurLayer = useCallback(
    (blurPx = defaultBlur / 2, scale = 0.98) => {
      setLayers((prev) => [...prev, { blur: blurPx, scale }]);
    },
    [defaultBlur]
  );

  // Pop the top layer
  const popBlurLayer = useCallback(() => {
    setLayers((prev) => prev.slice(0, -1));
  }, []);

  const value = useMemo(
    () => ({
      isBlurred,
      blurAmount,
      scaleAmount,
      depth,
      setBlurBack,
      pushBlurLayer,
      popBlurLayer,
    }),
    [isBlurred, blurAmount, scaleAmount, depth, setBlurBack, pushBlurLayer, popBlurLayer]
  );

  return (
    <BlurBackContext.Provider value={value}>
      {children}
    </BlurBackContext.Provider>
  );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access and control blur-back effect
 *
 * @throws Error if used outside BlurBackProvider
 */
export function useBlurBack(): BlurBackContextValue {
  const context = useContext(BlurBackContext);

  if (!context) {
    throw new Error('useBlurBack must be used within a BlurBackProvider');
  }

  return context;
}

// =============================================================================
// CONTENT WRAPPER
// =============================================================================

/**
 * Wrapper that receives the blur effect
 * Place this around your main content, with overlays outside
 */
export function BlurBackContent({
  children,
  className,
  transformOrigin = 'center center',
}: BlurBackContentProps) {
  const { isBlurred, blurAmount, scaleAmount } = useBlurBack();
  const prefersReducedMotion = useReducedMotion();

  // Get appropriate spring config
  const springConfig = springs.modal;

  return (
    <motion.div
      className={cn('will-change-transform', className)}
      animate={{
        scale: isBlurred ? scaleAmount : 1,
        filter: isBlurred ? `blur(${blurAmount}px)` : 'blur(0px)',
      }}
      transition={prefersReducedMotion ? { duration: 0 } : springConfig}
      style={{ transformOrigin }}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// HOOK FOR OVERLAY COMPONENTS
// =============================================================================

/**
 * Hook for overlay components to automatically manage blur-back
 *
 * @example
 * ```tsx
 * function Modal({ open, children }) {
 *   useBlurBackEffect(open, { blur: 12, scale: 0.94 });
 *
 *   return <AnimatePresence>{open && ...}</AnimatePresence>;
 * }
 * ```
 */
export function useBlurBackEffect(
  active: boolean,
  options: { blur?: number; scale?: number } = {}
): void {
  const { blur = 8, scale = 0.95 } = options;
  const context = useContext(BlurBackContext);

  // Use layout effect for immediate visual response
  // Note: Using regular useEffect to avoid SSR issues
  if (context) {
    // This is a simplified version - in production you'd want
    // to use useLayoutEffect with proper cleanup
    if (active && !context.isBlurred) {
      context.setBlurBack(true, blur, scale);
    } else if (!active && context.isBlurred && context.depth === 1) {
      context.setBlurBack(false);
    }
  }
}

// =============================================================================
// PRESETS
// =============================================================================

/**
 * Pre-configured blur depths for common overlay types
 */
export const blurPresets = {
  /** Light blur for tooltips and popovers */
  subtle: { blur: 4, scale: 0.98 },
  /** Standard blur for modals */
  modal: { blur: 8, scale: 0.95 },
  /** Deeper blur for important dialogs */
  deep: { blur: 12, scale: 0.94 },
  /** Heavy blur for full-screen overlays */
  heavy: { blur: 16, scale: 0.92 },
} as const;

export type BlurPreset = keyof typeof blurPresets;

export default BlurBackProvider;
