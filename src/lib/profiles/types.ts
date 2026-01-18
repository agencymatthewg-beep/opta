/**
 * Phase 46: Dynamic Profile Engine
 *
 * Types for Opta's intelligent profile system that adapts settings
 * based on game, hardware, and usage patterns.
 */

/**
 * Profile mode determines the overall optimization strategy.
 */
export type ProfileMode = 'gaming' | 'productivity' | 'battery_saver' | 'auto';

/**
 * Performance tier levels for hardware-specific tuning.
 */
export type PerformanceTier = 'ultra' | 'high' | 'balanced' | 'power_saver';

/**
 * Process priority levels matching platform backends.
 */
export type ProcessPriorityLevel = 'realtime' | 'high' | 'normal' | 'background' | 'idle';

/**
 * GPU performance preference.
 */
export type GpuPerformanceMode = 'high' | 'medium' | 'low' | 'auto';

/**
 * Memory optimization strategy.
 */
export type MemoryStrategy = 'aggressive' | 'balanced' | 'conservative';

/**
 * Thermal management approach.
 */
export type ThermalPolicy = 'performance' | 'balanced' | 'quiet';

/**
 * Hardware-specific optimization settings.
 */
export interface HardwareTuning {
  /** CPU priority for target process */
  processPriority: ProcessPriorityLevel;
  /** GPU performance mode */
  gpuPerformance: GpuPerformanceMode;
  /** Memory optimization strategy */
  memoryStrategy: MemoryStrategy;
  /** Thermal management policy */
  thermalPolicy: ThermalPolicy;
  /** Enable Apple Silicon P-core preference (macOS) */
  preferPerformanceCores: boolean;
  /** Enable Windows Game Mode (Windows) */
  windowsGameMode: boolean;
  /** Prevent display sleep during active use */
  preventDisplaySleep: boolean;
  /** Disable background app throttling */
  disableAppThrottling: boolean;
}

/**
 * Game-specific override settings.
 */
export interface GameOverride {
  /** Game identifier */
  gameId: string;
  /** Display name for the game */
  gameName: string;
  /** Override hardware tuning for this game */
  hardwareTuning?: Partial<HardwareTuning>;
  /** Custom launch arguments */
  launchArguments?: string[];
  /** Preferred resolution (if available) */
  preferredResolution?: string;
  /** FPS limit (0 = unlimited) */
  fpsLimit?: number;
  /** Notes from user or learning system */
  notes?: string;
  /** Last modified timestamp */
  updatedAt: number;
}

/**
 * Context used for auto profile detection.
 */
export interface ProfileContext {
  /** Currently active process name (if any) */
  activeProcess?: string;
  /** Active process PID */
  activePid?: number;
  /** Current power source */
  powerSource: 'ac' | 'battery' | 'unknown';
  /** Battery percentage (if applicable) */
  batteryPercent?: number;
  /** Memory pressure level */
  memoryPressure: 'normal' | 'warn' | 'critical';
  /** Thermal state */
  thermalState: 'nominal' | 'fair' | 'serious' | 'critical';
  /** Time of day (for schedule-based switching) */
  timeOfDay: number;
  /** Whether a known game is detected */
  gameDetected: boolean;
  /** Detected game ID (if any) */
  detectedGameId?: string;
}

/**
 * Schedule entry for automatic profile switching.
 */
export interface ProfileSchedule {
  /** Unique schedule ID */
  id: string;
  /** Profile to activate */
  profileId: string;
  /** Days of week (0 = Sunday, 6 = Saturday) */
  daysOfWeek: number[];
  /** Start time in 24h format (e.g., "09:00") */
  startTime: string;
  /** End time in 24h format (e.g., "17:00") */
  endTime: string;
  /** Whether this schedule is enabled */
  enabled: boolean;
}

/**
 * Complete optimization profile definition.
 */
export interface OptimizationProfile {
  /** Unique profile identifier */
  id: string;
  /** Display name */
  name: string;
  /** Profile description */
  description: string;
  /** Profile mode/category */
  mode: ProfileMode;
  /** Performance tier */
  tier: PerformanceTier;
  /** Is this a system default profile (non-deletable) */
  isDefault: boolean;
  /** Is this profile currently active */
  isActive: boolean;
  /** Hardware tuning settings */
  hardwareTuning: HardwareTuning;
  /** Per-game overrides */
  gameOverrides: Record<string, GameOverride>;
  /** Custom icon (Lucide icon name) */
  icon: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last modified timestamp */
  updatedAt: number;
}

/**
 * Profile switch event for tracking and undo support.
 */
export interface ProfileSwitchEvent {
  /** Previous profile ID */
  fromProfileId: string;
  /** New profile ID */
  toProfileId: string;
  /** Reason for switch */
  reason: 'manual' | 'auto_game' | 'auto_power' | 'auto_thermal' | 'auto_memory' | 'scheduled';
  /** Timestamp of switch */
  timestamp: number;
  /** Context at time of switch */
  context: ProfileContext;
}

/**
 * Profile store state for persistence.
 */
export interface ProfileStoreState {
  /** All profiles keyed by ID */
  profiles: Record<string, OptimizationProfile>;
  /** Currently active profile ID */
  activeProfileId: string;
  /** Whether auto profile switching is enabled */
  autoSwitchEnabled: boolean;
  /** Recent switch history (for undo) */
  switchHistory: ProfileSwitchEvent[];
  /** Profile schedules */
  schedules: ProfileSchedule[];
  /** Store version for migrations */
  version: number;
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Result of a profile switch operation.
 */
export interface ProfileSwitchResult {
  /** Whether the switch was successful */
  success: boolean;
  /** Previous profile ID */
  previousProfileId: string;
  /** New active profile ID */
  newProfileId: string;
  /** Applied hardware tuning settings */
  appliedSettings: HardwareTuning;
  /** Game override applied (if any) */
  gameOverride?: GameOverride;
  /** Any warnings during switch */
  warnings: string[];
  /** Timestamp of switch */
  timestamp: number;
}

/**
 * Profile matching result from auto-detection.
 */
export interface ProfileMatchResult {
  /** Matched profile ID */
  profileId: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for match */
  reason: string;
  /** Should this trigger an automatic switch? */
  shouldSwitch: boolean;
}

/**
 * Default hardware tuning for each profile mode.
 */
export const DEFAULT_HARDWARE_TUNING: Record<ProfileMode, HardwareTuning> = {
  gaming: {
    processPriority: 'high',
    gpuPerformance: 'high',
    memoryStrategy: 'aggressive',
    thermalPolicy: 'performance',
    preferPerformanceCores: true,
    windowsGameMode: true,
    preventDisplaySleep: true,
    disableAppThrottling: true,
  },
  productivity: {
    processPriority: 'normal',
    gpuPerformance: 'auto',
    memoryStrategy: 'balanced',
    thermalPolicy: 'balanced',
    preferPerformanceCores: false,
    windowsGameMode: false,
    preventDisplaySleep: false,
    disableAppThrottling: false,
  },
  battery_saver: {
    processPriority: 'background',
    gpuPerformance: 'low',
    memoryStrategy: 'conservative',
    thermalPolicy: 'quiet',
    preferPerformanceCores: false,
    windowsGameMode: false,
    preventDisplaySleep: false,
    disableAppThrottling: false,
  },
  auto: {
    processPriority: 'normal',
    gpuPerformance: 'auto',
    memoryStrategy: 'balanced',
    thermalPolicy: 'balanced',
    preferPerformanceCores: false,
    windowsGameMode: false,
    preventDisplaySleep: false,
    disableAppThrottling: false,
  },
};

/**
 * Default system profiles.
 */
export const DEFAULT_PROFILES: OptimizationProfile[] = [
  {
    id: 'gaming',
    name: 'Gaming',
    description: 'Maximum performance for games with elevated priority and GPU optimization',
    mode: 'gaming',
    tier: 'ultra',
    isDefault: true,
    isActive: false,
    hardwareTuning: DEFAULT_HARDWARE_TUNING.gaming,
    gameOverrides: {},
    icon: 'Gamepad2',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'productivity',
    name: 'Productivity',
    description: 'Balanced performance for work applications with stable power management',
    mode: 'productivity',
    tier: 'balanced',
    isDefault: true,
    isActive: false,
    hardwareTuning: DEFAULT_HARDWARE_TUNING.productivity,
    gameOverrides: {},
    icon: 'Briefcase',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'battery_saver',
    name: 'Battery Saver',
    description: 'Extended battery life with conservative power usage',
    mode: 'battery_saver',
    tier: 'power_saver',
    isDefault: true,
    isActive: false,
    hardwareTuning: DEFAULT_HARDWARE_TUNING.battery_saver,
    gameOverrides: {},
    icon: 'BatteryLow',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'auto',
    name: 'Auto',
    description: 'Automatically adapts based on running applications and system state',
    mode: 'auto',
    tier: 'balanced',
    isDefault: true,
    isActive: true,
    hardwareTuning: DEFAULT_HARDWARE_TUNING.auto,
    gameOverrides: {},
    icon: 'Sparkles',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];
