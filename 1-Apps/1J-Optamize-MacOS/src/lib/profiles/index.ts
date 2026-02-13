/**
 * Phase 46: Dynamic Profile Engine
 *
 * Entry point for the profile management system.
 */

// Types
export type {
  ProfileMode,
  PerformanceTier,
  ProcessPriorityLevel,
  GpuPerformanceMode,
  MemoryStrategy,
  ThermalPolicy,
  HardwareTuning,
  GameOverride,
  ProfileContext,
  ProfileSchedule,
  OptimizationProfile,
  ProfileSwitchEvent,
  ProfileStoreState,
  ProfileSwitchResult,
  ProfileMatchResult,
} from './types';

export {
  DEFAULT_HARDWARE_TUNING,
  DEFAULT_PROFILES,
} from './types';

// Engine
export { ProfileEngine, getProfileEngine } from './ProfileEngine';

// Matcher
export { ProfileMatcher, getProfileMatcher } from './ProfileMatcher';

// Store
export { ProfileStore, getProfileStore } from './ProfileStore';
