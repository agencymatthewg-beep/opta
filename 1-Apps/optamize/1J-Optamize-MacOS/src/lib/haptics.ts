/**
 * Haptic feedback utilities for macOS.
 *
 * Provides tactile feedback on macOS devices with Force Touch trackpads.
 * Gracefully no-ops on other platforms.
 *
 * IMPORTANT: Haptics should be used sparingly - only for consequential actions
 * like optimization complete, errors, or important confirmations. Target 3-4
 * haptic triggers per session maximum to avoid fatigue.
 */

import { platform } from '@tauri-apps/plugin-os';

/**
 * Native macOS haptic feedback patterns.
 * These map to NSHapticFeedbackPattern values.
 */
export type HapticPattern = 'generic' | 'alignment' | 'levelChange';

/**
 * Semantic haptic intents for consistent UX.
 * Use these instead of raw patterns for better maintainability.
 */
export type HapticIntent = 'success' | 'warning' | 'error' | 'selection';

/**
 * Maps semantic intents to native haptic patterns.
 *
 * - success (levelChange): Strong feedback for completed actions
 * - warning (alignment): Medium feedback for cautions
 * - error (generic): Distinct feedback for errors
 * - selection (alignment): Light feedback for UI interactions
 */
const intentToPattern: Record<HapticIntent, HapticPattern> = {
  success: 'levelChange',
  warning: 'alignment',
  error: 'generic',
  selection: 'alignment',
};

/**
 * Cached platform detection result.
 * null = not yet checked, boolean = result cached
 */
let isMacOS: boolean | null = null;

/**
 * Global haptics enabled state (can be disabled via settings).
 */
let hapticsEnabled = true;

/**
 * Check if running on macOS.
 * Result is cached after first check.
 */
async function checkPlatform(): Promise<boolean> {
  if (isMacOS === null) {
    try {
      const currentPlatform = await platform();
      isMacOS = currentPlatform === 'macos';
    } catch {
      // If platform detection fails, assume not macOS
      isMacOS = false;
    }
  }
  return isMacOS;
}

/**
 * Trigger haptic feedback with a semantic intent.
 *
 * This is the recommended API for triggering haptics.
 * Uses semantic intents that map to appropriate native patterns.
 *
 * @param intent - The semantic intent (success, warning, error, selection)
 *
 * @example
 * ```ts
 * // After optimization completes
 * await haptic('success');
 *
 * // On error
 * await haptic('error');
 *
 * // On menu selection
 * await haptic('selection');
 * ```
 */
export async function haptic(intent: HapticIntent): Promise<void> {
  // Early exit if haptics disabled
  if (!hapticsEnabled) return;

  // Only trigger on macOS
  const mac = await checkPlatform();
  if (!mac) return;

  // Get the native pattern for this intent
  const _pattern = intentToPattern[intent];

  // NOTE: tauri-plugin-macos-haptics is not yet available as a stable package.
  // For now, we log the intent. When the plugin is added, this will invoke
  // the native haptic API.
  //
  // Future implementation:
  // try {
  //   await invoke('trigger_haptic', { pattern });
  // } catch (error) {
  //   console.debug('Haptic feedback unavailable:', error);
  // }

  // For now, just log in development
  if (import.meta.env.DEV) {
    console.debug(`[Haptics] Would trigger: ${intent} (${_pattern})`);
  }
}

/**
 * Trigger success haptic feedback.
 * Use for: optimization complete, achievement unlocked, action confirmed.
 */
export const hapticSuccess = (): Promise<void> => haptic('success');

/**
 * Trigger warning haptic feedback.
 * Use for: approaching limits, soft errors, attention needed.
 */
export const hapticWarning = (): Promise<void> => haptic('warning');

/**
 * Trigger error haptic feedback.
 * Use for: action failed, validation error, critical issue.
 */
export const hapticError = (): Promise<void> => haptic('error');

/**
 * Trigger selection haptic feedback.
 * Use for: menu selection, toggle change, important UI interaction.
 */
export const hapticSelection = (): Promise<void> => haptic('selection');

/**
 * Enable or disable haptic feedback globally.
 * This setting persists only for the current session.
 *
 * @param enabled - Whether haptics should be enabled
 */
export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/**
 * Check if haptics are currently enabled.
 */
export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

/**
 * Check if the current platform supports haptic feedback.
 * Returns true only on macOS.
 */
export async function isHapticsSupported(): Promise<boolean> {
  return checkPlatform();
}
