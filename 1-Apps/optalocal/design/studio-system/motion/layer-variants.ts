/**
 * Opta Studio System — Layer Transition Variants
 * Extracted from: 1P-Opta-Code-Universal/src/App.tsx (settingsLayerVariants)
 *
 * This is the Framer Motion variant set that drives the 3D depth illusion
 * when navigating between Studio layers (L1 → L2 → L3 and back).
 *
 * Drop this into any new Studio component — it works identically for
 * Browser Studio, Models Studio, Atpo Studio, or any future Studio.
 *
 * ── How it works ──
 * Each layer is a <motion.div> that uses this variant set.
 * The "direction" and "motion" custom props drive which entry/exit animation plays.
 *
 * direction: "deeper"    → going INTO the Studio (L1→L2, L2→L3)
 * direction: "shallower" → going OUT OF the Studio (L3→L2, L2→L1)
 * motion: "root"         → the first time the Studio opens (from nothing)
 * motion: "intra"        → navigating within the Studio (layer changes)
 */

import type { Variants } from "framer-motion";

/**
 * The layer depth animation system.
 *
 * Uses scale + translate + blur to simulate 3D depth:
 *   - Going deeper: current layer shrinks/blurs backwards, new layer emerges from front
 *   - Going shallower: current layer expands/sharpens forwards, previous layer returns
 */
export const studioLayerVariants: Variants = {
  enter: (custom: { direction: "deeper" | "shallower"; motion: "root" | "intra" }) => ({
    opacity: custom.motion === "root" ? 0 : 1,
    scale: custom.direction === "deeper" ? 1.08 : 0.92,
    y: custom.direction === "deeper" ? 24 : -18,
    filter:
      custom.motion === "root"
        ? "blur(0px)"
        : custom.direction === "deeper"
          ? "blur(3px)"
          : "blur(2px)",
  }),
  center: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.22,   // matches --opta-transition-layer-duration: 220ms
      ease: [0.22, 1, 0.36, 1], // matches --opta-transition-layer-ease
    },
  },
  exit: (custom: { direction: "deeper" | "shallower"; motion: "root" | "intra" }) => ({
    opacity: custom.motion === "root" ? 0 : 0.6,
    scale: custom.direction === "deeper" ? 0.88 : 1.06,
    y: custom.direction === "deeper" ? -20 : 28,
    filter: custom.direction === "deeper" ? "blur(4px)" : "blur(2px)",
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

/**
 * Usage in a Studio component:
 *
 * const [layerDirection, setLayerDirection] = useState<"deeper" | "shallower">("deeper");
 * const [layerMotion, setLayerMotion] = useState<"root" | "intra">("root");
 *
 * <AnimatePresence
 *   mode="wait"
 *   custom={{ direction: layerDirection, motion: layerMotion }}
 * >
 *   <motion.div
 *     key={`layer-${currentLayer}`}
 *     variants={studioLayerVariants}
 *     initial="enter"
 *     animate="center"
 *     exit="exit"
 *     custom={{ direction: layerDirection, motion: layerMotion }}
 *   >
 *     {layerContent}
 *   </motion.div>
 * </AnimatePresence>
 */

/**
 * Overlay entrance (the whole Studio modal appearing):
 * Used on the .opta-studio-backdrop wrapper.
 */
export const studioOverlayVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.32,  // matches --opta-transition-overlay-duration: 320ms
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/**
 * Shell entrance (the glass panel scaling in):
 */
export const studioShellVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: 12,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};
