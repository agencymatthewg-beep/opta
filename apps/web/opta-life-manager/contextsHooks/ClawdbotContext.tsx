"use client";

/**
 * Clawdbot Feature Flag Context
 *
 * This context controls whether Clawdbot features are enabled.
 * When disabled, the Opta Life app works exactly as before.
 * All Clawdbot state is stored in localStorage for easy reversal.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ClawdbotConfig {
  enabled: boolean;
  serverUrl: string;
  autoConnect: boolean;
}

interface ClawdbotContextValue {
  config: ClawdbotConfig;
  setEnabled: (enabled: boolean) => void;
  setServerUrl: (url: string) => void;
  setAutoConnect: (auto: boolean) => void;
  resetToDefaults: () => void;
  isConfigured: boolean;
}

const STORAGE_KEY = "opta-clawdbot-config";

const DEFAULT_CONFIG: ClawdbotConfig = {
  enabled: false,
  serverUrl: "",
  autoConnect: true,
};

const ClawdbotContext = createContext<ClawdbotContextValue | null>(null);

export function ClawdbotProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClawdbotConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // Load config from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfig({ ...DEFAULT_CONFIG, ...parsed });
      }
    } catch {
      // If localStorage fails, use defaults (Clawdbot disabled)
      console.warn("[Clawdbot] Failed to load config, using defaults");
    }
    setLoaded(true);
  }, []);

  // Save config to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      console.warn("[Clawdbot] Failed to save config");
    }
  }, [config, loaded]);

  const setEnabled = (enabled: boolean) => {
    setConfig((prev) => ({ ...prev, enabled }));
  };

  const setServerUrl = (serverUrl: string) => {
    setConfig((prev) => ({ ...prev, serverUrl }));
  };

  const setAutoConnect = (autoConnect: boolean) => {
    setConfig((prev) => ({ ...prev, autoConnect }));
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const isConfigured = config.serverUrl.trim().length > 0;

  return (
    <ClawdbotContext.Provider
      value={{
        config,
        setEnabled,
        setServerUrl,
        setAutoConnect,
        resetToDefaults,
        isConfigured,
      }}
    >
      {children}
    </ClawdbotContext.Provider>
  );
}

export function useClawdbotConfig() {
  const context = useContext(ClawdbotContext);
  if (!context) {
    throw new Error("useClawdbotConfig must be used within ClawdbotProvider");
  }
  return context;
}

/**
 * Hook to check if Clawdbot features should be shown
 * Returns false until config is loaded to prevent flash
 */
export function useClawdbotEnabled(): boolean {
  const context = useContext(ClawdbotContext);
  // If no provider, Clawdbot is disabled (safe fallback)
  if (!context) return false;
  return context.config.enabled;
}
