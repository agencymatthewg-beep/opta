import { Variants, Transition, domAnimation, domMax } from "framer-motion";

/**
 * Animation Library - The Obsidian Standard
 *
 * Provides consistent, reusable animation patterns across the app.
 * Designed for the Living Artifact aesthetic with obsidian glass
 * and 0% → 50% energy transitions.
 *
 * @see DESIGN_SYSTEM.md - Part 6: Animation Standards
 */

/**
 * Re-export LazyMotion feature sets for tree-shaking optimization.
 */
export { domAnimation, domMax };

// =============================================================================
// EASING CURVES - The Obsidian Standard
// =============================================================================

/** Smooth deceleration - default for most UI */
export const smoothOut = [0.22, 1, 0.36, 1] as const;

/** Heavy/weighty feel - for ring movements */
export const heavy = [0.16, 1, 0.3, 1] as const;

/** Snappy response - for hover states */
export const snappy = [0.34, 1.56, 0.64, 1] as const;

/** Cinematic entrance - for page transitions */
export const cinematic = [0.77, 0, 0.175, 1] as const;

/** Circle out - standard deceleration */
export const circOut = [0, 0.55, 0.45, 1] as const;

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

export const transitions = {
  /** Quick, snappy transition */
  fast: { duration: 0.15, ease: smoothOut } as Transition,

  /** Standard smooth transition */
  smooth: { duration: 0.25, ease: smoothOut } as Transition,

  /** Slower, more deliberate transition */
  slow: { duration: 0.4, ease: smoothOut } as Transition,

  /** Ignition transition */
  ignition: { duration: 0.8, ease: smoothOut } as Transition,

  /** Bouncy spring effect */
  spring: { type: "spring", stiffness: 400, damping: 30 } as Transition,

  /** Soft spring for larger movements */
  springGentle: { type: "spring", stiffness: 200, damping: 25 } as Transition,

  /** Very soft spring for page transitions */
  springPage: { type: "spring", stiffness: 100, damping: 20 } as Transition,

  /** Heavy spring for ring movements */
  springHeavy: { type: "spring", stiffness: 150, damping: 20 } as Transition,
} as const;

// =============================================================================
// IGNITION ANIMATIONS - The Obsidian Standard
// Elements wake up from darkness, not just fade in
// =============================================================================

/**
 * Standard ignition - elements emerge from the void
 */
export const ignition: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    filter: "brightness(0.5) blur(4px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "brightness(1) blur(0px)",
    transition: transitions.ignition,
  },
};

/**
 * Quick ignition - faster version for smaller elements
 */
export const ignitionQuick: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.97,
    filter: "brightness(0.6) blur(2px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "brightness(1) blur(0px)",
    transition: transitions.smooth,
  },
};

/**
 * Hero ignition - dramatic version for large elements
 */
export const ignitionHero: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    filter: "brightness(0) blur(10px)",
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "brightness(1) blur(0px)",
    transition: { duration: 1.2, ease: cinematic },
  },
};

// =============================================================================
// GLOW ANIMATIONS - The 0% → 50% Energy System
// =============================================================================

/**
 * Glow pulse - rhythmic glow for loading/processing
 */
export const glowPulse: Variants = {
  dormant: {
    filter: "drop-shadow(0 0 10px rgba(168, 85, 247, 0.2))",
  },
  active: {
    filter: [
      "drop-shadow(0 0 10px rgba(168, 85, 247, 0.2))",
      "drop-shadow(0 0 40px rgba(168, 85, 247, 0.6))",
      "drop-shadow(0 0 10px rgba(168, 85, 247, 0.2))",
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

/**
 * Glow ignite - 0% → 50% transition for obsidian panels
 */
export const glowIgnite: Variants = {
  dormant: {
    boxShadow: "0 0 0 0 rgba(168, 85, 247, 0), inset 0 0 0 0 rgba(168, 85, 247, 0)",
  },
  active: {
    boxShadow: "0 0 25px rgba(168, 85, 247, 0.4), inset 0 0 20px rgba(168, 85, 247, 0.1)",
    transition: transitions.slow,
  },
};

/**
 * Border glow - for interactive obsidian panels
 */
export const borderGlow: Variants = {
  dormant: {
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  active: {
    borderColor: "rgba(168, 85, 247, 0.4)",
    transition: transitions.smooth,
  },
};

// =============================================================================
// RING STATE ANIMATIONS - For the Opta Ring protagonist
// =============================================================================

/**
 * Ring overlay opacity (50% state visibility)
 */
export const ringOverlay: Variants = {
  dormant: {
    opacity: 0,
    transition: { duration: 0.6, ease: smoothOut },
  },
  active: {
    opacity: 1,
    transition: { duration: 0.6, ease: smoothOut },
  },
  processing: {
    opacity: [0.3, 0.9, 0.3],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Ring glow states
 */
export const ringGlow: Variants = {
  dormant: {
    filter: "drop-shadow(0 0 10px rgba(168, 85, 247, 0.15))",
    transition: { duration: 0.6, ease: smoothOut },
  },
  active: {
    filter: "drop-shadow(0 0 40px rgba(168, 85, 247, 0.6))",
    transition: { duration: 0.6, ease: smoothOut },
  },
  processing: {
    filter: [
      "drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))",
      "drop-shadow(0 0 50px rgba(168, 85, 247, 0.7))",
      "drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))",
    ],
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Ring breathing (gentle pulse when dormant)
 */
export const ringBreathe: Variants = {
  breathe: {
    filter: [
      "drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9)",
      "drop-shadow(0 0 25px rgba(168, 85, 247, 0.35)) brightness(1)",
      "drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9)",
    ],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" },
  },
};

// =============================================================================
// FOG ANIMATIONS - For the atmospheric fog layer
// =============================================================================

/**
 * Fog drift - slow movement for idle state
 */
export const fogDrift: Variants = {
  drift: {
    x: [0, 20, -10, 0],
    y: [0, -10, 15, 0],
    transition: { duration: 30, repeat: Infinity, ease: "easeInOut" },
  },
};

/**
 * Fog intensity variants
 */
export const fogIntensity: Variants = {
  idle: { opacity: 0.15, transition: transitions.slow },
  active: { opacity: 0.35, transition: transitions.slow },
  storm: { opacity: 0.55, transition: transitions.slow },
};

// =============================================================================
// PAGE TRANSITIONS - Spring-based choreography
// =============================================================================

/**
 * Page transition variants with spring physics
 *
 * - Exit: fade out + slide up (150ms)
 * - Enter: fade in + slide up from below (300ms)
 * - Children stagger: 50ms delay between elements
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    filter: "brightness(0.8)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      mass: 1,
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: "brightness(0.9)",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      duration: 0.15,
    },
  },
};

/**
 * Page child variants - used by children of page containers
 * Automatically staggers when parent has staggerChildren
 */
export const pageChildVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
};

// =============================================================================
// FADE VARIANTS
// =============================================================================

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

// =============================================================================
// SCALE VARIANTS
// =============================================================================

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

// =============================================================================
// SLIDE VARIANTS
// =============================================================================

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

// =============================================================================
// STAGGER CHILDREN
// =============================================================================

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
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
    filter: "brightness(0.7)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "brightness(1)",
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

// =============================================================================
// INTERACTIVE VARIANTS - Obsidian Hover Effects
// =============================================================================

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
    y: -2,
    boxShadow: "0 0 0 1px rgba(168, 85, 247, 0.2), 0 8px 32px -8px rgba(168, 85, 247, 0.25)",
    transition: transitions.smooth,
  },
};

export const glowHoverVariants: Variants = {
  initial: {
    boxShadow: "0 0 0 0 transparent",
  },
  hover: {
    boxShadow: "0 0 24px -4px rgba(168, 85, 247, 0.4)",
    transition: transitions.smooth,
  },
};

/** Obsidian panel hover - triggers 0% → 50% glow */
export const obsidianHoverVariants: Variants = {
  initial: {
    borderColor: "rgba(255, 255, 255, 0.05)",
    boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
  },
  hover: {
    borderColor: "rgba(168, 85, 247, 0.4)",
    boxShadow: "inset 0 0 20px rgba(168, 85, 247, 0.1), 0 0 15px rgba(168, 85, 247, 0.3)",
    transition: { duration: 0.5, ease: smoothOut },
  },
};

// =============================================================================
// DRAWER/PANEL VARIANTS
// =============================================================================

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

// =============================================================================
// EXPAND/COLLAPSE VARIANTS
// =============================================================================

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

// =============================================================================
// METER/PROGRESS VARIANTS
// =============================================================================

export const meterVariants: Variants = {
  initial: {
    pathLength: 0,
    opacity: 0,
  },
  animate: (value: number) => ({
    pathLength: value,
    opacity: 1,
    transition: {
      pathLength: { duration: 1, ease: smoothOut },
      opacity: { duration: 0.3 },
    },
  }),
};

export const counterVariants = {
  from: { value: 0 },
  to: (value: number) => ({
    value,
    transition: { duration: 0.8, ease: smoothOut },
  }),
};

// =============================================================================
// NOTIFICATION/TOAST VARIANTS
// =============================================================================

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

// =============================================================================
// MICRO-INTERACTION VARIANTS
// =============================================================================

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

/**
 * Card lift effect on hover - subtle 3D depth shift
 *
 * Features:
 * - Scale: 1 → 1.02
 * - Y translate: 0 → -4px (lift)
 * - Enhanced shadow on hover
 * - Spring physics (200ms feel)
 */
export const cardLiftVariants: Variants = {
  initial: {
    y: 0,
    scale: 1,
    boxShadow: "0 0 0 0 transparent, 0 4px 12px -4px rgba(0, 0, 0, 0.2)",
  },
  hover: {
    y: -4,
    scale: 1.02,
    boxShadow: "0 0 0 1px rgba(168, 85, 247, 0.15), 0 12px 24px -8px rgba(168, 85, 247, 0.25)",
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      mass: 0.9,
    },
  },
  tap: {
    y: -2,
    scale: 0.99,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
  },
};

/**
 * Card lift variants - compact version for smaller cards
 */
export const cardLiftSubtleVariants: Variants = {
  initial: {
    y: 0,
    scale: 1,
  },
  hover: {
    y: -2,
    scale: 1.01,
    transition: {
      type: "spring",
      stiffness: 250,
      damping: 25,
    },
  },
  tap: {
    scale: 0.99,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
  },
};

/**
 * Interactive card with deep glow on hover
 * Combines lift with obsidian energy awakening
 */
export const cardInteractiveVariants: Variants = {
  initial: {
    y: 0,
    scale: 1,
    boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  hover: {
    y: -4,
    scale: 1.02,
    boxShadow: "inset 0 0 20px rgba(168, 85, 247, 0.1), 0 12px 32px -8px rgba(168, 85, 247, 0.3)",
    borderColor: "rgba(168, 85, 247, 0.4)",
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 25,
      mass: 0.9,
    },
  },
  tap: {
    y: -2,
    scale: 0.99,
    boxShadow: "inset 0 0 30px rgba(168, 85, 247, 0.15), 0 8px 24px -6px rgba(168, 85, 247, 0.35)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
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

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates stagger delay for child elements
 */
export function getStaggerDelay(index: number, base = 0.05): number {
  return index * base;
}

/**
 * Creates a custom transition with delay
 */
export function withDelay(transition: Transition, delay: number): Transition {
  return { ...transition, delay };
}

/**
 * Create ignition variant with custom delay
 */
export function createIgnitionVariant(delay: number): Variants {
  return {
    hidden: ignition.hidden,
    visible: {
      ...ignition.visible,
      transition: {
        ...transitions.ignition,
        delay,
      },
    },
  };
}

/**
 * Create stagger container with custom timing
 */
export function createStaggerContainer(
  staggerChildren = 0.05,
  delayChildren = 0.1
): Variants {
  return {
    initial: {},
    animate: {
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
}

// =============================================================================
// REDUCED MOTION SUPPORT
// =============================================================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get transition based on reduced motion preference
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
 */
export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};
