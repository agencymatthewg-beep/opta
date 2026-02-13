/**
 * Phase 46: Dynamic Profile Engine
 *
 * ProfileMatcher automatically detects the best profile based on
 * active processes, system state, and usage context.
 */

import type {
  OptimizationProfile,
  ProfileContext,
  ProfileMatchResult,
  ProfileSchedule,
} from './types';

/**
 * Known game process patterns for auto-detection.
 * Maps process name patterns to game IDs.
 */
const KNOWN_GAME_PATTERNS: Record<string, string[]> = {
  // Steam games
  steam: ['steam', 'steamwebhelper'],
  // Epic Games
  epic: ['epicgameslauncher', 'easyanticheat'],
  // Battle.net
  battlenet: ['battle.net', 'agent.exe'],
  // Common game engines
  unity: ['unity', 'unityplayer'],
  unreal: ['unreal', 'ue4', 'ue5'],
  // Specific popular games
  minecraft: ['minecraft', 'javaw'],
  fortnite: ['fortnite', 'fortniteclient'],
  valorant: ['valorant', 'riotclientservices'],
  leagueoflegends: ['leagueclient', 'league of legends'],
  csgo: ['csgo', 'cs2'],
  dota2: ['dota2'],
  overwatch: ['overwatch'],
  wow: ['wow', 'world of warcraft'],
};

/**
 * Productivity app process patterns.
 */
const PRODUCTIVITY_PATTERNS: string[] = [
  'code', // VS Code
  'visual studio',
  'xcode',
  'intellij',
  'android studio',
  'slack',
  'teams',
  'zoom',
  'figma',
  'sketch',
  'photoshop',
  'illustrator',
  'premiere',
  'final cut',
  'logic pro',
  'word',
  'excel',
  'powerpoint',
  'notion',
  'obsidian',
];

/**
 * ProfileMatcher - Determines the best profile based on context.
 */
export class ProfileMatcher {
  private knownGames: Map<string, string> = new Map();

  constructor() {
    // Build reverse lookup: process name -> game ID
    for (const [gameId, patterns] of Object.entries(KNOWN_GAME_PATTERNS)) {
      for (const pattern of patterns) {
        this.knownGames.set(pattern.toLowerCase(), gameId);
      }
    }
  }

  /**
   * Match the best profile for the given context.
   */
  matchProfile(
    profiles: OptimizationProfile[],
    context: ProfileContext,
    schedules: ProfileSchedule[] = []
  ): ProfileMatchResult {
    // Priority order:
    // 1. Active schedule
    // 2. Critical thermal/memory (force battery saver)
    // 3. Game detected (gaming profile)
    // 4. Productivity app (productivity profile)
    // 5. Battery power (battery saver)
    // 6. Auto profile

    // Check active schedules first
    const scheduledProfile = this.checkSchedules(profiles, schedules);
    if (scheduledProfile) {
      return scheduledProfile;
    }

    // Check critical system conditions
    if (context.thermalState === 'critical' || context.memoryPressure === 'critical') {
      const batterySaver = profiles.find(p => p.mode === 'battery_saver');
      if (batterySaver) {
        return {
          profileId: batterySaver.id,
          confidence: 0.95,
          reason: context.thermalState === 'critical'
            ? 'Critical thermal state detected - switching to power saver'
            : 'Critical memory pressure - switching to power saver',
          shouldSwitch: true,
        };
      }
    }

    // Check for game detection
    if (context.activeProcess) {
      const gameMatch = this.detectGame(context.activeProcess);
      if (gameMatch) {
        const gamingProfile = profiles.find(p => p.mode === 'gaming');
        if (gamingProfile) {
          return {
            profileId: gamingProfile.id,
            confidence: 0.9,
            reason: `Game detected: ${gameMatch}`,
            shouldSwitch: true,
          };
        }
      }

      // Check for productivity apps
      if (this.isProductivityApp(context.activeProcess)) {
        const productivityProfile = profiles.find(p => p.mode === 'productivity');
        if (productivityProfile) {
          return {
            profileId: productivityProfile.id,
            confidence: 0.75,
            reason: 'Productivity application detected',
            shouldSwitch: true,
          };
        }
      }
    }

    // Check power source
    if (context.powerSource === 'battery') {
      // Low battery - force battery saver
      if (context.batteryPercent !== undefined && context.batteryPercent < 20) {
        const batterySaver = profiles.find(p => p.mode === 'battery_saver');
        if (batterySaver) {
          return {
            profileId: batterySaver.id,
            confidence: 0.9,
            reason: `Low battery (${context.batteryPercent}%) - switching to battery saver`,
            shouldSwitch: true,
          };
        }
      }

      // On battery with moderate charge - suggest battery saver
      if (context.batteryPercent !== undefined && context.batteryPercent < 50) {
        const batterySaver = profiles.find(p => p.mode === 'battery_saver');
        if (batterySaver) {
          return {
            profileId: batterySaver.id,
            confidence: 0.6,
            reason: 'Running on battery - battery saver recommended',
            shouldSwitch: false, // Suggest but don't force
          };
        }
      }
    }

    // Default to auto profile
    const autoProfile = profiles.find(p => p.mode === 'auto') ?? profiles[0];
    return {
      profileId: autoProfile.id,
      confidence: 0.5,
      reason: 'No specific context detected - using auto profile',
      shouldSwitch: false,
    };
  }

  /**
   * Detect if a process matches a known game.
   */
  detectGame(processName: string): string | null {
    const lower = processName.toLowerCase();

    // Direct match
    if (this.knownGames.has(lower)) {
      return this.knownGames.get(lower) ?? null;
    }

    // Partial match
    for (const [pattern, gameId] of this.knownGames) {
      if (lower.includes(pattern) || pattern.includes(lower)) {
        return gameId;
      }
    }

    // Check for common game indicators
    if (lower.includes('game') || lower.includes('.exe')) {
      // Could be a game, return generic indicator
      return 'unknown_game';
    }

    return null;
  }

  /**
   * Check if a process is a productivity application.
   */
  isProductivityApp(processName: string): boolean {
    const lower = processName.toLowerCase();
    return PRODUCTIVITY_PATTERNS.some(pattern => lower.includes(pattern));
  }

  /**
   * Check schedules for active profile.
   */
  private checkSchedules(
    profiles: OptimizationProfile[],
    schedules: ProfileSchedule[]
  ): ProfileMatchResult | null {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      if (!schedule.daysOfWeek.includes(currentDay)) continue;

      if (this.isTimeInRange(currentTime, schedule.startTime, schedule.endTime)) {
        const profile = profiles.find(p => p.id === schedule.profileId);
        if (profile) {
          return {
            profileId: profile.id,
            confidence: 1.0,
            reason: `Scheduled: ${profile.name} (${schedule.startTime}-${schedule.endTime})`,
            shouldSwitch: true,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if current time is within a time range.
   */
  private isTimeInRange(current: string, start: string, end: string): boolean {
    // Handle overnight ranges (e.g., 22:00 - 06:00)
    if (start > end) {
      return current >= start || current <= end;
    }
    return current >= start && current <= end;
  }

  /**
   * Register a custom game pattern for detection.
   */
  registerGamePattern(gameId: string, patterns: string[]): void {
    for (const pattern of patterns) {
      this.knownGames.set(pattern.toLowerCase(), gameId);
    }
  }

  /**
   * Get all registered game patterns.
   */
  getKnownGames(): Map<string, string> {
    return new Map(this.knownGames);
  }
}

// Singleton instance
let matcherInstance: ProfileMatcher | null = null;

/**
 * Get the ProfileMatcher singleton instance.
 */
export function getProfileMatcher(): ProfileMatcher {
  if (!matcherInstance) {
    matcherInstance = new ProfileMatcher();
  }
  return matcherInstance;
}
