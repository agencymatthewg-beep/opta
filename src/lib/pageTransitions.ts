import type { Variants } from 'framer-motion';
import { smoothOut, cinematic } from './animations';

/**
 * Page Transitions - Ring + Fog Orchestration
 *
 * Coordinates the OptaRing and AtmosphericFog during page navigation.
 * The ring is the PROTAGONIST - it moves to center, ignites, and
 * dissolves as content appears.
 *
 * @see DESIGN_SYSTEM.md - Part 7: The Opta Ring
 */

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/** Time for ring to move to center (ms) */
export const RING_MOVE_DURATION = 200;

/** Time for ring ignition 0% → 50% (ms) */
export const RING_IGNITE_DURATION = 400;

/** Time to hold at 50% state (ms) */
export const RING_HOLD_DURATION = 300;

/** Time for ring to fade/dissolve (ms) */
export const RING_DISSOLVE_DURATION = 300;

/** Total transition duration (ms) */
export const TOTAL_TRANSITION_DURATION =
  RING_MOVE_DURATION + RING_IGNITE_DURATION + RING_HOLD_DURATION + RING_DISSOLVE_DURATION;

// =============================================================================
// PAGE CONTENT VARIANTS
// =============================================================================

/**
 * Page content variants with ignition effect
 */
export const pageContentVariants: Variants = {
  initial: {
    opacity: 0,
    y: 16,
    filter: 'brightness(0.6) blur(4px)',
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'brightness(1) blur(0px)',
    transition: {
      duration: 0.6,
      ease: smoothOut,
      // Delay content appearance until ring transition
      delay: (RING_IGNITE_DURATION + RING_HOLD_DURATION) / 1000,
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'brightness(0.8)',
    transition: {
      duration: 0.25,
      ease: smoothOut,
    },
  },
};

/**
 * Quick page variant (no ring transition)
 */
export const pageQuickVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: smoothOut,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

/**
 * Hero section variant (dramatic entrance)
 */
export const pageHeroVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 30,
    filter: 'brightness(0) blur(10px)',
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'brightness(1) blur(0px)',
    transition: {
      duration: 1,
      ease: cinematic,
      delay: (RING_IGNITE_DURATION + RING_HOLD_DURATION) / 1000,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.3,
    },
  },
};

// =============================================================================
// FLOATING RING OVERLAY VARIANTS
// =============================================================================

/**
 * Floating ring container (appears during transitions)
 */
export const floatingRingVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: RING_MOVE_DURATION / 1000,
      ease: smoothOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 1.1,
    filter: 'brightness(1.5) blur(8px)',
    transition: {
      duration: RING_DISSOLVE_DURATION / 1000,
      ease: smoothOut,
    },
  },
};

/**
 * Ring position variants for movement
 */
export const ringPositionVariants: Variants = {
  sidebar: {
    x: 0,
    y: 0,
    transition: {
      duration: RING_MOVE_DURATION / 1000,
      ease: smoothOut,
    },
  },
  center: {
    x: 'calc(50vw - 50%)',
    y: 'calc(50vh - 50%)',
    transition: {
      duration: RING_MOVE_DURATION / 1000,
      ease: smoothOut,
    },
  },
};

// =============================================================================
// TRANSITION ORCHESTRATION
// =============================================================================

export interface PageTransitionConfig {
  /** Whether to show ring transition */
  showRing?: boolean;
  /** Custom delay before content appears (ms) */
  contentDelay?: number;
  /** Whether to trigger fog intensity increase */
  intensifyFog?: boolean;
  /** Page type for variant selection */
  pageType?: 'default' | 'quick' | 'hero';
}

const defaultConfig: PageTransitionConfig = {
  showRing: true,
  contentDelay: undefined,
  intensifyFog: true,
  pageType: 'default',
};

/**
 * Get page variants based on config
 */
export function getPageVariants(config: PageTransitionConfig = {}): Variants {
  const mergedConfig = { ...defaultConfig, ...config };

  switch (mergedConfig.pageType) {
    case 'quick':
      return pageQuickVariants;
    case 'hero':
      return pageHeroVariants;
    default:
      return pageContentVariants;
  }
}

/**
 * Create custom page transition with specific timing
 */
export function createPageTransition(
  contentDelay: number = RING_IGNITE_DURATION + RING_HOLD_DURATION
): Variants {
  return {
    initial: {
      opacity: 0,
      y: 16,
      filter: 'brightness(0.6) blur(4px)',
    },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'brightness(1) blur(0px)',
      transition: {
        duration: 0.6,
        ease: smoothOut,
        delay: contentDelay / 1000,
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      y: -8,
      filter: 'brightness(0.8)',
      transition: {
        duration: 0.25,
        ease: smoothOut,
      },
    },
  };
}

// =============================================================================
// TRANSITION SEQUENCE HELPERS
// =============================================================================

/**
 * Sequence for full page transition with ring
 *
 * 1. Ring moves to center
 * 2. Ring ignites (0% → 50%)
 * 3. Hold at 50%
 * 4. Ring dissolves as content appears
 */
export interface TransitionSequenceStep {
  action: 'moveRing' | 'igniteRing' | 'holdRing' | 'dissolveRing' | 'showContent' | 'activateFog' | 'idleFog';
  duration: number;
  delay: number;
}

export const fullTransitionSequence: TransitionSequenceStep[] = [
  { action: 'activateFog', duration: 100, delay: 0 },
  { action: 'moveRing', duration: RING_MOVE_DURATION, delay: 0 },
  { action: 'igniteRing', duration: RING_IGNITE_DURATION, delay: RING_MOVE_DURATION },
  { action: 'holdRing', duration: RING_HOLD_DURATION, delay: RING_MOVE_DURATION + RING_IGNITE_DURATION },
  {
    action: 'dissolveRing',
    duration: RING_DISSOLVE_DURATION,
    delay: RING_MOVE_DURATION + RING_IGNITE_DURATION + RING_HOLD_DURATION,
  },
  {
    action: 'showContent',
    duration: 600,
    delay: RING_MOVE_DURATION + RING_IGNITE_DURATION + RING_HOLD_DURATION,
  },
  { action: 'idleFog', duration: 300, delay: TOTAL_TRANSITION_DURATION },
];

/**
 * Quick sequence without ring movement
 */
export const quickTransitionSequence: TransitionSequenceStep[] = [
  { action: 'activateFog', duration: 100, delay: 0 },
  { action: 'showContent', duration: 300, delay: 0 },
  { action: 'idleFog', duration: 300, delay: 300 },
];

// =============================================================================
// HOOK INTEGRATION HELPERS
// =============================================================================

/**
 * Creates a delay promise for sequencing
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute transition sequence
 */
export async function executeTransitionSequence(
  sequence: TransitionSequenceStep[],
  handlers: {
    onMoveRing?: () => void;
    onIgniteRing?: () => void;
    onHoldRing?: () => void;
    onDissolveRing?: () => void;
    onShowContent?: () => void;
    onActivateFog?: () => void;
    onIdleFog?: () => void;
  }
): Promise<void> {
  for (const step of sequence) {
    await delay(step.delay);

    switch (step.action) {
      case 'moveRing':
        handlers.onMoveRing?.();
        break;
      case 'igniteRing':
        handlers.onIgniteRing?.();
        break;
      case 'holdRing':
        handlers.onHoldRing?.();
        break;
      case 'dissolveRing':
        handlers.onDissolveRing?.();
        break;
      case 'showContent':
        handlers.onShowContent?.();
        break;
      case 'activateFog':
        handlers.onActivateFog?.();
        break;
      case 'idleFog':
        handlers.onIdleFog?.();
        break;
    }
  }
}

/**
 * Hook-friendly transition runner
 * Returns cleanup function for React useEffect
 */
export function runPageTransition(
  ringContext: {
    moveTo: (pos: 'center' | 'sidebar') => Promise<void>;
    setState: (state: 'dormant' | 'active' | 'processing') => void;
    setShowFloating: (show: boolean) => void;
  } | null,
  fogContext: {
    activate: () => void;
    idle: () => void;
  } | null,
  options: { quick?: boolean } = {}
): () => void {
  let cancelled = false;

  const run = async () => {
    if (options.quick || !ringContext) {
      // Quick transition without ring
      fogContext?.activate();
      await delay(300);
      if (!cancelled) {
        fogContext?.idle();
      }
      return;
    }

    // Full transition with ring
    ringContext.setShowFloating(true);
    ringContext.setState('dormant');
    fogContext?.activate();

    await delay(RING_MOVE_DURATION);
    if (cancelled) return;

    ringContext.setState('active');

    await delay(RING_IGNITE_DURATION + RING_HOLD_DURATION);
    if (cancelled) return;

    ringContext.setState('dormant');

    await delay(RING_DISSOLVE_DURATION);
    if (cancelled) return;

    ringContext.setShowFloating(false);
    fogContext?.idle();
  };

  run();

  return () => {
    cancelled = true;
  };
}
