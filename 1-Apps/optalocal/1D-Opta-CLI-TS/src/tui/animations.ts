/**
 * Animation configuration for TUI overlays.
 *
 * All easing constants, thresholds, and durations are centralised here.
 * Tuning a value here updates the entire animation system — no magic numbers
 * scattered across components.
 */

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

export const ANIMATION = {
  /** Number of animation tick steps for Opta Menu open/close. */
  optaMenuSteps: 4,
  /** Milliseconds between each animation tick. */
  optaMenuFrameMs: 10,
  /** Total open/close duration in ms (steps × frameMs). */
  optaMenuDurationMs: 40,

  // ---------------------------------------------------------------------------
  // Content reveal thresholds (normalizedProgress 0.0–1.0)
  // ---------------------------------------------------------------------------

  /** Core info (model, autonomy, connection) appears at this progress. */
  showCoreContentAt: 0.28,
  /** Item action list appears at this progress. */
  showActionsListAt: 0.55,
  /** Info panel on the right appears at this progress. */
  showInfoPanelAt: 0.75,
  /** Menu is considered fully open — dimensions lock to stable values. */
  considerFullyOpenAt: 0.95,

  // ---------------------------------------------------------------------------
  // Size easing
  //
  // Height formula:  visualRows = targetRows × (heightBase + heightRange × p)
  // Width formula:   animatedWidth = targetWidth × (widthBase + widthRange × p)
  //
  // At p=0: height = 45% of target, width = 55% of target (compressed feel)
  // At p=1: height = 100%, width = 100%
  // ---------------------------------------------------------------------------

  /** Height fraction at start of animation (p=0). */
  heightBase: 0.45,
  /** Height fraction added over the full animation (0→1). */
  heightRange: 0.55,
  /** Width fraction at start of animation (p=0). */
  widthBase: 0.55,
  /** Width fraction added over the full animation (0→1). */
  widthRange: 0.45,
} as const;

// ---------------------------------------------------------------------------
// Easing helpers
// ---------------------------------------------------------------------------

/**
 * Compute the height multiplier for a given animation progress.
 *
 * @param progress  Normalised animation progress, clamped 0.0–1.0.
 * @returns         Fraction of target height to render (0.45–1.0).
 */
export function animateHeight(progress: number): number {
  return ANIMATION.heightBase + (ANIMATION.heightRange * progress);
}

/**
 * Compute the width multiplier for a given animation progress.
 *
 * @param progress  Normalised animation progress, clamped 0.0–1.0.
 * @returns         Fraction of target width to render (0.55–1.0).
 */
export function animateWidth(progress: number): number {
  return ANIMATION.widthBase + (ANIMATION.widthRange * progress);
}
