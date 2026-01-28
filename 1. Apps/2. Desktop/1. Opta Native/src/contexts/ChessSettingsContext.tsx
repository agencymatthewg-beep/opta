/**
 * ChessSettingsContext - Global chess settings state management
 *
 * Provides ChessSettings to all chess components with:
 * - localStorage persistence
 * - Type-safe settings updates
 * - Default settings fallback
 *
 * @see src/types/chess.ts - ChessSettings interface
 * @see src/components/chess/settings/ChessSettingsPanel.tsx - Settings UI
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { ChessSettings } from '@/types/chess';
import { DEFAULT_CHESS_SETTINGS } from '@/types/chess';

// LocalStorage key for chess settings
const CHESS_SETTINGS_KEY = 'opta_chess_settings';

/**
 * Context value interface
 */
interface ChessSettingsContextValue {
  /** Current chess settings */
  settings: ChessSettings;
  /** Update one or more settings */
  updateSettings: (updates: Partial<ChessSettings>) => void;
  /** Reset settings to defaults */
  resetSettings: () => void;
}

/**
 * Chess Settings Context
 */
const ChessSettingsContext = createContext<ChessSettingsContextValue | null>(null);

/**
 * Load settings from localStorage with validation
 */
function loadSettings(): ChessSettings {
  try {
    const saved = localStorage.getItem(CHESS_SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_CHESS_SETTINGS,
        ...parsed,
        // Deep merge nested objects
        aiConfig: {
          ...DEFAULT_CHESS_SETTINGS.aiConfig,
          ...(parsed.aiConfig || {}),
        },
        sound: {
          ...DEFAULT_CHESS_SETTINGS.sound,
          ...(parsed.sound || {}),
        },
        animation: {
          ...DEFAULT_CHESS_SETTINGS.animation,
          ...(parsed.animation || {}),
        },
        display: {
          ...DEFAULT_CHESS_SETTINGS.display,
          ...(parsed.display || {}),
        },
      };
    }
  } catch {
    // Ignore parse errors, return defaults
  }
  return DEFAULT_CHESS_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: ChessSettings): void {
  try {
    localStorage.setItem(CHESS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * ChessSettingsProvider - Provides chess settings to the component tree
 */
export function ChessSettingsProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage
  const [settings, setSettings] = useState<ChessSettings>(loadSettings);

  // Persist settings to localStorage on change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Update settings handler
  const updateSettings = useCallback((updates: Partial<ChessSettings>) => {
    setSettings((prev) => {
      const next = { ...prev };

      // Handle top-level updates
      Object.keys(updates).forEach((key) => {
        const k = key as keyof ChessSettings;
        if (updates[k] !== undefined) {
          // Deep merge for nested objects
          if (k === 'aiConfig' && updates.aiConfig) {
            next.aiConfig = { ...prev.aiConfig, ...updates.aiConfig };
          } else if (k === 'sound' && updates.sound) {
            next.sound = { ...prev.sound, ...updates.sound };
          } else if (k === 'animation' && updates.animation) {
            next.animation = { ...prev.animation, ...updates.animation };
          } else if (k === 'display' && updates.display) {
            next.display = { ...prev.display, ...updates.display };
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (next as any)[k] = updates[k];
          }
        }
      });

      // Keep showCoordinates in sync with display.showCoordinates
      if (updates.display?.showCoordinates !== undefined) {
        next.showCoordinates = updates.display.showCoordinates;
      } else if (updates.showCoordinates !== undefined) {
        next.display = { ...next.display, showCoordinates: updates.showCoordinates };
      }

      return next;
    });
  }, []);

  // Reset settings handler
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_CHESS_SETTINGS);
  }, []);

  // Memoize context value
  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
    }),
    [settings, updateSettings, resetSettings]
  );

  return (
    <ChessSettingsContext.Provider value={value}>
      {children}
    </ChessSettingsContext.Provider>
  );
}

/**
 * Hook to access chess settings context
 * @throws Error if used outside ChessSettingsProvider
 */
export function useChessSettings(): ChessSettingsContextValue {
  const context = useContext(ChessSettingsContext);
  if (!context) {
    throw new Error('useChessSettings must be used within a ChessSettingsProvider');
  }
  return context;
}

/**
 * Hook to access chess settings with optional fallback
 * Returns default settings if used outside provider (for optional integration)
 */
export function useChessSettingsOptional(): ChessSettingsContextValue {
  const context = useContext(ChessSettingsContext);

  // Provide a stable fallback for optional usage
  const fallback = useMemo<ChessSettingsContextValue>(
    () => ({
      settings: DEFAULT_CHESS_SETTINGS,
      updateSettings: () => {
        console.warn('useChessSettingsOptional: updateSettings called outside ChessSettingsProvider');
      },
      resetSettings: () => {
        console.warn('useChessSettingsOptional: resetSettings called outside ChessSettingsProvider');
      },
    }),
    []
  );

  return context ?? fallback;
}

export default ChessSettingsContext;
