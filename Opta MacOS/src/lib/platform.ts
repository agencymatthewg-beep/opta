/**
 * Shared Platform Detection Utilities
 *
 * Consolidated platform detection to avoid duplication across
 * AdaptationEngine, ProfileEngine, and ConfigCalculator hooks.
 *
 * @see src/hooks/usePlatform.ts - Platform detection hook
 */

/**
 * Supported platform types for optimization targeting.
 */
export type Platform = 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'unknown';

/**
 * Detect the current platform from the browser user agent.
 * Used for client-side platform detection when Tauri API isn't available.
 *
 * @returns The detected platform
 *
 * @example
 * const platform = getPlatform();
 * if (platform === 'macos') {
 *   // macOS-specific logic
 * }
 */
export function getPlatform(): Platform {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  const ua = navigator.userAgent.toLowerCase();

  // Check mobile platforms first (they may include desktop OS names)
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }

  // Desktop platforms
  if (/macintosh|macintel|macppc|mac68k|macos/.test(ua)) {
    return 'macos';
  }
  if (/win32|win64|windows|wince/.test(ua)) {
    return 'windows';
  }
  if (/linux/.test(ua)) {
    return 'linux';
  }

  return 'unknown';
}

/**
 * Check if we're running on a desktop platform.
 */
export function isDesktop(): boolean {
  const platform = getPlatform();
  return platform === 'macos' || platform === 'windows' || platform === 'linux';
}

/**
 * Check if we're running on a mobile platform.
 */
export function isMobile(): boolean {
  const platform = getPlatform();
  return platform === 'ios' || platform === 'android';
}

/**
 * Check if we're running on Apple Silicon (M-series) Mac.
 * Note: This is a best-effort detection based on user agent.
 */
export function isAppleSilicon(): boolean {
  if (typeof navigator === 'undefined') return false;

  const platform = getPlatform();
  if (platform !== 'macos') return false;

  // Check for ARM architecture hint in user agent
  // Modern browsers on M-series Macs may report ARM
  const ua = navigator.userAgent;
  return /arm|aarch64/i.test(ua) || /macOS.*arm/i.test(ua);
}

/**
 * Get a human-readable platform name.
 */
export function getPlatformDisplayName(platform?: Platform): string {
  const p = platform ?? getPlatform();
  const names: Record<Platform, string> = {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
    ios: 'iOS',
    android: 'Android',
    unknown: 'Unknown',
  };
  return names[p];
}
