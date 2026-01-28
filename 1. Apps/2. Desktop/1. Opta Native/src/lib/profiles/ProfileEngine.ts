/**
 * Phase 46: Dynamic Profile Engine
 *
 * ProfileEngine manages optimization profiles and applies hardware tuning
 * settings to the system via platform-specific backends.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  OptimizationProfile,
  HardwareTuning,
  GameOverride,
  ProfileSwitchResult,
  ProfileContext,
} from './types';

/**
 * Platform detection helper.
 */
function getPlatform(): 'macos' | 'windows' | 'linux' | 'unknown' {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'macos';
  if (userAgent.includes('win')) return 'windows';
  if (userAgent.includes('linux')) return 'linux';
  return 'unknown';
}

/**
 * ProfileEngine - Core service for managing and applying optimization profiles.
 *
 * Handles:
 * - Profile activation/deactivation
 * - Hardware tuning application via platform backends
 * - Game-specific override merging
 * - Profile switch coordination
 */
export class ProfileEngine {
  private currentProfile: OptimizationProfile | null = null;
  private currentGameOverride: GameOverride | null = null;
  private platform: 'macos' | 'windows' | 'linux' | 'unknown';
  private listeners: Set<(result: ProfileSwitchResult) => void> = new Set();

  constructor() {
    this.platform = getPlatform();
  }

  /**
   * Get the currently active profile.
   */
  getCurrentProfile(): OptimizationProfile | null {
    return this.currentProfile;
  }

  /**
   * Get the currently applied game override (if any).
   */
  getCurrentGameOverride(): GameOverride | null {
    return this.currentGameOverride;
  }

  /**
   * Subscribe to profile switch events.
   */
  onProfileSwitch(listener: (result: ProfileSwitchResult) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Activate a profile and apply its hardware tuning settings.
   */
  async activateProfile(
    profile: OptimizationProfile,
    context?: ProfileContext
  ): Promise<ProfileSwitchResult> {
    const previousProfileId = this.currentProfile?.id ?? 'none';
    const warnings: string[] = [];

    // Determine if we should apply a game override
    let effectiveTuning = { ...profile.hardwareTuning };
    let gameOverride: GameOverride | undefined;

    if (context?.detectedGameId && profile.gameOverrides[context.detectedGameId]) {
      gameOverride = profile.gameOverrides[context.detectedGameId];
      effectiveTuning = this.mergeGameOverride(effectiveTuning, gameOverride);
    }

    // Apply hardware tuning based on platform
    try {
      await this.applyHardwareTuning(effectiveTuning, context);
    } catch (error) {
      warnings.push(`Failed to apply some settings: ${error}`);
    }

    // Update internal state
    this.currentProfile = profile;
    this.currentGameOverride = gameOverride ?? null;

    const result: ProfileSwitchResult = {
      success: true,
      previousProfileId,
      newProfileId: profile.id,
      appliedSettings: effectiveTuning,
      gameOverride,
      warnings,
      timestamp: Date.now(),
    };

    // Notify listeners
    this.listeners.forEach(listener => listener(result));

    return result;
  }

  /**
   * Deactivate the current profile (reset to defaults).
   */
  async deactivateProfile(): Promise<void> {
    if (!this.currentProfile) return;

    // Reset to neutral settings
    const neutralTuning: HardwareTuning = {
      processPriority: 'normal',
      gpuPerformance: 'auto',
      memoryStrategy: 'balanced',
      thermalPolicy: 'balanced',
      preferPerformanceCores: false,
      windowsGameMode: false,
      preventDisplaySleep: false,
      disableAppThrottling: false,
    };

    try {
      await this.applyHardwareTuning(neutralTuning);
    } catch (error) {
      console.error('Failed to reset hardware tuning:', error);
    }

    this.currentProfile = null;
    this.currentGameOverride = null;
  }

  /**
   * Apply a game-specific override to the current profile.
   */
  async applyGameOverride(override: GameOverride): Promise<ProfileSwitchResult> {
    if (!this.currentProfile) {
      throw new Error('No active profile to apply game override to');
    }

    const effectiveTuning = this.mergeGameOverride(
      this.currentProfile.hardwareTuning,
      override
    );

    try {
      await this.applyHardwareTuning(effectiveTuning);
    } catch (error) {
      console.error('Failed to apply game override:', error);
    }

    this.currentGameOverride = override;

    return {
      success: true,
      previousProfileId: this.currentProfile.id,
      newProfileId: this.currentProfile.id,
      appliedSettings: effectiveTuning,
      gameOverride: override,
      warnings: [],
      timestamp: Date.now(),
    };
  }

  /**
   * Clear the current game override and revert to base profile settings.
   */
  async clearGameOverride(): Promise<void> {
    if (!this.currentProfile || !this.currentGameOverride) return;

    try {
      await this.applyHardwareTuning(this.currentProfile.hardwareTuning);
    } catch (error) {
      console.error('Failed to clear game override:', error);
    }

    this.currentGameOverride = null;
  }

  /**
   * Merge game override with base hardware tuning.
   */
  private mergeGameOverride(
    base: HardwareTuning,
    override: GameOverride
  ): HardwareTuning {
    if (!override.hardwareTuning) return base;

    return {
      ...base,
      ...override.hardwareTuning,
    };
  }

  /**
   * Apply hardware tuning settings to the system.
   */
  private async applyHardwareTuning(
    tuning: HardwareTuning,
    context?: ProfileContext
  ): Promise<void> {
    const platform = this.platform;

    // Apply gaming mode (display sleep, background throttling)
    if (platform === 'macos') {
      await this.applyMacOSTuning(tuning);
    } else if (platform === 'windows') {
      await this.applyWindowsTuning(tuning);
    }

    // Apply process priority if we have an active process
    if (context?.activePid) {
      await this.setProcessPriority(context.activePid, tuning.processPriority);
    }
  }

  /**
   * Apply macOS-specific hardware tuning.
   */
  private async applyMacOSTuning(tuning: HardwareTuning): Promise<void> {
    try {
      // Configure gaming mode (caffeinate, etc.)
      const enableGamingMode =
        tuning.preventDisplaySleep ||
        tuning.processPriority === 'high' ||
        tuning.processPriority === 'realtime';

      await invoke('macos_configure_gaming_mode', { enable: enableGamingMode });
    } catch (error) {
      console.warn('macOS tuning not available:', error);
    }
  }

  /**
   * Apply Windows-specific hardware tuning.
   */
  private async applyWindowsTuning(tuning: HardwareTuning): Promise<void> {
    try {
      // Configure Windows Game Mode
      if (tuning.windowsGameMode) {
        await invoke('windows_enable_game_mode', { enable: true });
      }

      // Set power plan based on thermal policy
      const powerPlan = tuning.thermalPolicy === 'performance'
        ? 'high_performance'
        : tuning.thermalPolicy === 'quiet'
          ? 'power_saver'
          : 'balanced';

      await invoke('windows_set_power_plan', { plan: powerPlan });
    } catch (error) {
      console.warn('Windows tuning not available:', error);
    }
  }

  /**
   * Set process priority on the target process.
   */
  private async setProcessPriority(
    pid: number,
    priority: string
  ): Promise<void> {
    const platform = this.platform;

    try {
      if (platform === 'macos') {
        await invoke('macos_set_process_priority', { pid, priority });
      } else if (platform === 'windows') {
        await invoke('windows_set_process_priority', { pid, priority });
      }
    } catch (error) {
      console.warn(`Failed to set process priority: ${error}`);
    }
  }

  /**
   * Get effective tuning settings (profile + game override merged).
   */
  getEffectiveTuning(): HardwareTuning | null {
    if (!this.currentProfile) return null;

    if (this.currentGameOverride?.hardwareTuning) {
      return this.mergeGameOverride(
        this.currentProfile.hardwareTuning,
        this.currentGameOverride
      );
    }

    return this.currentProfile.hardwareTuning;
  }
}

// Singleton instance
let engineInstance: ProfileEngine | null = null;

/**
 * Get the ProfileEngine singleton instance.
 */
export function getProfileEngine(): ProfileEngine {
  if (!engineInstance) {
    engineInstance = new ProfileEngine();
  }
  return engineInstance;
}
