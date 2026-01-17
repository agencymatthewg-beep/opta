/**
 * useGlobalShortcut - Hook for registering global keyboard shortcuts.
 *
 * Wraps Tauri's global-shortcut plugin API with proper lifecycle management.
 * Shortcuts work even when the app is in the background.
 */

import { useEffect, useCallback, useRef } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';

/**
 * Supported shortcut keys using CommandOrControl for cross-platform support.
 * On macOS: Cmd+Shift+X
 * On Windows/Linux: Ctrl+Shift+X
 */
export type ShortcutKey =
  | 'CommandOrControl+Shift+O'  // Quick Optimization
  | 'CommandOrControl+Shift+S'  // Quick Score check
  | 'CommandOrControl+Shift+G'  // Games library
  | 'CommandOrControl+Shift+D'; // Dashboard

/**
 * Shortcut event state from Tauri plugin.
 */
export type ShortcutState = 'Pressed' | 'Released';

/**
 * Options for useGlobalShortcut hook.
 */
export interface UseGlobalShortcutOptions {
  /** The shortcut key combination to register */
  shortcut: ShortcutKey;
  /** Handler called when shortcut is triggered */
  handler: () => void | Promise<void>;
  /** Whether the shortcut should be active (default: true) */
  enabled?: boolean;
}

/**
 * Return type for useGlobalShortcut hook.
 */
export interface UseGlobalShortcutReturn {
  /** Whether the shortcut is currently registered */
  isRegistered: boolean;
  /** Any error that occurred during registration */
  error: string | null;
}

/**
 * Hook for registering and managing global keyboard shortcuts.
 *
 * Global shortcuts work even when the app is in the background or unfocused.
 * The shortcut is automatically unregistered when the component unmounts
 * or when `enabled` becomes false.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useGlobalShortcut({
 *     shortcut: 'CommandOrControl+Shift+O',
 *     handler: () => {
 *       console.log('Quick optimization triggered!');
 *       runOptimization();
 *     },
 *     enabled: true,
 *   });
 *
 *   return <div>Press Cmd+Shift+O to optimize</div>;
 * }
 * ```
 */
export function useGlobalShortcut({
  shortcut,
  handler,
  enabled = true,
}: UseGlobalShortcutOptions): UseGlobalShortcutReturn {
  const handlerRef = useRef(handler);
  const registeredRef = useRef(false);
  const errorRef = useRef<string | null>(null);

  // Keep handler ref current to avoid re-registration on handler change
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const registerShortcut = useCallback(async () => {
    if (!enabled) {
      // If disabled, ensure we unregister
      if (registeredRef.current) {
        try {
          await unregister(shortcut);
          registeredRef.current = false;
        } catch {
          // Ignore unregister errors
        }
      }
      return;
    }

    try {
      // Check if already registered and unregister first
      const alreadyRegistered = await isRegistered(shortcut);
      if (alreadyRegistered) {
        await unregister(shortcut);
      }

      // Register the shortcut
      await register(shortcut, (event) => {
        if (event.state === 'Pressed') {
          handlerRef.current();
        }
      });

      registeredRef.current = true;
      errorRef.current = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errorRef.current = message;
      registeredRef.current = false;
      console.warn(`Failed to register shortcut ${shortcut}:`, message);
    }
  }, [shortcut, enabled]);

  // Register on mount, unregister on unmount
  useEffect(() => {
    registerShortcut();

    return () => {
      // Cleanup on unmount
      if (registeredRef.current) {
        unregister(shortcut).catch(() => {
          // Shortcut may already be unregistered
        });
        registeredRef.current = false;
      }
    };
  }, [registerShortcut, shortcut]);

  return {
    isRegistered: registeredRef.current,
    error: errorRef.current,
  };
}

export default useGlobalShortcut;
