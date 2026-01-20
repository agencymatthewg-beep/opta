/**
 * usePlatform - Hook for accessing platform context and capabilities.
 *
 * Returns the current platform information from the Rust backend,
 * including OS details, native features, and capabilities.
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Operating system identification.
 */
export type OperatingSystem =
  | {
      type: 'macos';
      version: string;
      build: string;
      architecture: Architecture;
    }
  | {
      type: 'windows';
      version: string;
      build: number;
      edition: string;
    }
  | {
      type: 'linux';
      distro: string;
      version: string;
      desktop_env: DesktopEnvironment;
    }
  | {
      type: 'ios';
      version: string;
    }
  | {
      type: 'android';
      api_level: number;
      version: string;
    }
  | {
      type: 'unknown';
    };

/**
 * CPU architecture.
 */
export type Architecture = 'arm64' | 'x86_64' | 'x86' | 'unknown';

/**
 * Linux desktop environment.
 */
export type DesktopEnvironment =
  | 'gnome'
  | 'kde'
  | 'xfce'
  | 'cinnamon'
  | 'mate'
  | 'unity'
  | 'wayland'
  | 'x11'
  | 'unknown';

/**
 * Native features available on the platform.
 */
export type NativeFeature =
  // macOS
  | 'menu_bar'
  | 'dock_badge'
  | 'app_nap'
  | 'metal'
  | 'spotlight'
  // Windows
  | 'jump_list'
  | 'taskbar_progress'
  | 'toast_notifications'
  | 'startup_registration'
  // Linux
  | 'desktop_entry'
  | 'dbus_notifications'
  | 'freedesktop_tray'
  | 'systemd_integration'
  // Cross-platform
  | 'system_tray'
  | 'native_notifications'
  | 'background_execution'
  | 'power_management';

/**
 * Platform capabilities.
 */
export interface PlatformCapabilities {
  gpu_acceleration: boolean;
  native_notifications: boolean;
  system_tray: boolean;
  background_execution: boolean;
  power_management: boolean;
  touch_support: boolean;
  high_dpi: boolean;
}

/**
 * Launch optimization applied at startup.
 */
export interface LaunchOptimization {
  name: string;
  description: string;
  applied: boolean;
}

/**
 * Complete platform context from backend.
 */
export interface PlatformContext {
  os: OperatingSystem;
  capabilities: PlatformCapabilities;
  native_features: NativeFeature[];
  launch_optimizations: LaunchOptimization[];
  display_name: string;
  icon: string;
}

/**
 * Hook return type.
 */
export interface UsePlatformReturn {
  /** Platform context (null while loading) */
  platform: PlatformContext | null;
  /** Current operating system */
  os: OperatingSystem | null;
  /** Platform capabilities */
  capabilities: PlatformCapabilities | null;
  /** Available native features */
  nativeFeatures: NativeFeature[];
  /** Whether currently loading */
  loading: boolean;
  /** Error if fetch failed */
  error: string | null;
  /** Check if a specific feature is available */
  hasFeature: (feature: NativeFeature) => boolean;
  /** Get platform display name */
  displayName: string;
  /** Get Lucide icon name for platform */
  icon: string;
  /** Whether running on desktop */
  isDesktop: boolean;
  /** Whether running on mobile */
  isMobile: boolean;
  /** Whether running on macOS */
  isMacOS: boolean;
  /** Whether running on Windows */
  isWindows: boolean;
  /** Whether running on Linux */
  isLinux: boolean;
  /** Refresh platform context */
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing platform context and capabilities.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { platform, hasFeature, isMacOS, loading } = usePlatform();
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <p>Running on {platform?.display_name}</p>
 *       {hasFeature('system_tray') && <p>System tray supported!</p>}
 *       {isMacOS && <p>macOS-specific content</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlatform(): UsePlatformReturn {
  const [platform, setPlatform] = useState<PlatformContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlatform = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const context = await invoke<PlatformContext>('get_platform_context');
      setPlatform(context);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get platform context';
      setError(message);
      console.error('usePlatform error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchPlatform();
  }, [fetchPlatform]);

  // Derived values
  const os = platform?.os ?? null;
  const capabilities = platform?.capabilities ?? null;
  const nativeFeatures = platform?.native_features ?? [];

  // Feature check
  const hasFeature = useCallback(
    (feature: NativeFeature): boolean => {
      return nativeFeatures.includes(feature);
    },
    [nativeFeatures]
  );

  // Platform type checks
  const isMacOS = os?.type === 'macos';
  const isWindows = os?.type === 'windows';
  const isLinux = os?.type === 'linux';
  const isIOS = os?.type === 'ios';
  const isAndroid = os?.type === 'android';
  const isDesktop = isMacOS || isWindows || isLinux;
  const isMobile = isIOS || isAndroid;

  return {
    platform,
    os,
    capabilities,
    nativeFeatures,
    loading,
    error,
    hasFeature,
    displayName: platform?.display_name ?? 'Unknown',
    icon: platform?.icon ?? 'help-circle',
    isDesktop,
    isMobile,
    isMacOS,
    isWindows,
    isLinux,
    refresh: fetchPlatform,
  };
}

export default usePlatform;
