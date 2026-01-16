import { Variants, Transition } from "framer-motion";

/**
 * Animation variants library for Opta
 *
 * Provides consistent, reusable animation patterns across the app.
 * Designed for the immersive glassmorphism aesthetic with smooth,
 * Apple Music-inspired transitions.
 */

// ============================================
// TRANSITION PRESETS
// ============================================

export const transitions = {
  /** Quick, snappy transition */
  fast: { duration: 0.15, ease: [0.4, 0, 0.2, 1] as const } as Transition,

  /** Standard smooth transition */
  smooth: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const } as Transition,

  /** Slower, more deliberate transition */
  slow: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } as Transition,

  /** Bouncy spring effect */
  spring: { type: "spring", stiffness: 400, damping: 30 } as Transition,

  /** Soft spring for larger movements */
  springGentle: { type: "spring", stiffness: 200, damping: 25 } as Transition,

  /** Very soft spring for page transitions */
  springPage: { type: "spring", stiffness: 100, damping: 20 } as Transition,
} as const;

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0, 0, 0.2, 1],
      staggerChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1],
    },
  },
};

// ============================================
// FADE VARIANTS
// ============================================

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

export const fadeInUpVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: transitions.fast,
  },
};

export const fadeInDownVariants: Variants = {
  initial: {
    opacity: 0,
    y: -8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: transitions.fast,
  },
};

// ============================================
// SCALE VARIANTS
// ============================================

export const scaleVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: transitions.fast,
  },
};

export const popVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.fast,
  },
};

// ============================================
// SLIDE VARIANTS
// ============================================

export const slideInRightVariants: Variants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
  exit: {
    opacity: 0,
    x: -10,
    transition: transitions.fast,
  },
};

export const slideInLeftVariants: Variants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: transitions.springGentle,
  },
  exit: {
    opacity: 0,
    x: 10,
    transition: transitions.fast,
  },
};

export const slideInBottomVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.springGentle,
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: transitions.fast,
  },
};

// ============================================
// STAGGER CHILDREN
// ============================================

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: transitions.fast,
  },
};

export const staggerFadeVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: transitions.smooth,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

// ============================================
// INTERACTIVE VARIANTS
// ============================================

export const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: transitions.spring,
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

export const cardHoverVariants: Variants = {
  initial: {
    y: 0,
    boxShadow: "0 0 0 0 transparent",
  },
  hover: {
    y: -4,
    boxShadow: "0 8px 32px -8px hsl(270 80% 60% / 0.25)",
    transition: transitions.smooth,
  },
};

export const glowHoverVariants: Variants = {
  initial: {
    boxShadow: "0 0 0 0 transparent",
  },
  hover: {
    boxShadow: "0 0 24px -4px hsl(270 80% 60% / 0.4)",
    transition: transitions.smooth,
  },
};

// ============================================
// DRAWER/PANEL VARIANTS
// ============================================

export const drawerVariants: Variants = {
  initial: {
    x: "100%",
    opacity: 0,
  },
  animate: {
    x: 0,
    opacity: 1,
    transition: transitions.springGentle,
  },
  exit: {
    x: "100%",
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// ============================================
// EXPAND/COLLAPSE VARIANTS
// ============================================

export const expandVariants: Variants = {
  initial: {
    height: 0,
    opacity: 0,
  },
  animate: {
    height: "auto",
    opacity: 1,
    transition: {
      height: transitions.springGentle,
      opacity: { duration: 0.2, delay: 0.1 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.1 },
    },
  },
};

// ============================================
// METER/PROGRESS VARIANTS
// ============================================

export const meterVariants: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: (value: number) => ({
    pathLength: value,
    opacity: 1,
    transition: {
      pathLength: { duration: 1, ease: [0.4, 0, 0.2, 1] },
      opacity: { duration: 0.3 },
    },
  }),
};

export const counterVariants = {
  from: { value: 0 },
  to: (value: number) => ({
    value,
    transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] },
  }),
};

// ============================================
// NOTIFICATION/TOAST VARIANTS
// ============================================

export const toastVariants: Variants = {
  initial: {
    opacity: 0,
    y: 50,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.95,
    transition: transitions.fast,
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Creates stagger delay for child elements
 */
export function getStaggerDelay(index: number, base = 0.06): number {
  return index * base;
}

/**
 * Creates a custom transition with delay
 */
export function withDelay(transition: Transition, delay: number): Transition {
  return { ...transition, delay };
}

// ============================================
// MICRO-INTERACTION VARIANTS
// ============================================

/** Subtle scale for button hover */
export const microHoverVariants: Variants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

/** Card lift effect on hover */
export const cardLiftVariants: Variants = {
  initial: { y: 0 },
  hover: {
    y: -2,
    transition: transitions.smooth,
  },
};

/** Check icon draw animation for success states */
export const checkDrawVariants: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.4, ease: "easeOut" },
      opacity: { duration: 0.15 },
    },
  },
};

// ============================================
// REDUCED MOTION SUPPORT
// ============================================

/**
 * Check if user prefers reduced motion
 * Should be called inside useEffect or useMemo for SSR safety
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get transition based on reduced motion preference
 * Returns instant transition if reduced motion is preferred
 */
export function getReducedMotionTransition(
  transition: Transition,
  reducedMotion: boolean
): Transition {
  if (reducedMotion) {
    return { duration: 0 };
  }
  return transition;
}

/**
 * Fade-only variant for reduced motion scenarios
 * Removes position/scale transforms
 */
export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
