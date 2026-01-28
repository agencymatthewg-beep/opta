"use client";

import { useState, useEffect } from "react";
import { X, Key, Check, AlertCircle, Settings, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiConfig {
  google_client_id: string | null;
  google_client_secret: string | null;
  todoist_api_token: string | null;
  gemini_api_key: string | null;
  auth_secret: string | null;
}

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiSettingsModal({ isOpen, onClose }: ApiSettingsModalProps) {
  const [config, setConfig] = useState<ApiConfig>({
    google_client_id: null,
    google_client_secret: null,
    todoist_api_token: null,
    gemini_api_key: null,
    auth_secret: null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const [checkingTauri, setCheckingTauri] = useState(true);

  // Check for Tauri on mount - Tauri v2 uses dynamic imports
  useEffect(() => {
    async function checkTauri() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        // Try a simple invoke to verify Tauri is working
        await invoke("get_api_status");
        setIsTauri(true);
      } catch {
        setIsTauri(false);
      } finally {
        setCheckingTauri(false);
      }
    }
    checkTauri();
  }, []);

  useEffect(() => {
    if (isOpen && isTauri) {
      loadConfig();
    }
  }, [isOpen, isTauri]);

  const loadConfig = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const loadedConfig = await invoke<ApiConfig>("get_api_config");
      setConfig(loadedConfig);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_api_config", { config });
      setSaved(true);
      // Don't auto-hide - let user click Restart
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const restartApp = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("restart_app");
    } catch (e) {
      setError(String(e));
    }
  };

  const updateField = (field: keyof ApiConfig, value: string) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value || null,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 glass-panel p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                API Settings
              </h2>
              <p className="text-xs text-text-muted">
                Configure your API tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {checkingTauri ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !isTauri ? (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200 font-medium">
                  Desktop App Required
                </p>
                <p className="text-xs text-amber-200/70 mt-1">
                  API settings can only be configured in the desktop app. In the
                  browser, use .env.local file.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Form Fields */}
            <div className="space-y-4">
              {/* Google OAuth */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Google OAuth
                </label>
                <input
                  type="text"
                  placeholder="Google Client ID"
                  value={config.google_client_id || ""}
                  onChange={(e) =>
                    updateField("google_client_id", e.target.value)
                  }
                  className="w-full px-4 py-3 rounded-lg bg-void/50 border border-glass-border text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
                <input
                  type="password"
                  placeholder="Google Client Secret"
                  value={config.google_client_secret || ""}
                  onChange={(e) =>
                    updateField("google_client_secret", e.target.value)
                  }
                  className="w-full px-4 py-3 rounded-lg bg-void/50 border border-glass-border text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Todoist */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Todoist
                </label>
                <input
                  type="password"
                  placeholder="Todoist API Token"
                  value={config.todoist_api_token || ""}
                  onChange={(e) =>
                    updateField("todoist_api_token", e.target.value)
                  }
                  className="w-full px-4 py-3 rounded-lg bg-void/50 border border-glass-border text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Gemini */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Gemini AI
                </label>
                <input
                  type="password"
                  placeholder="Gemini API Key"
                  value={config.gemini_api_key || ""}
                  onChange={(e) => updateField("gemini_api_key", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-void/50 border border-glass-border text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>

              {/* Auth Secret */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Auth Secret
                </label>
                <input
                  type="password"
                  placeholder="NextAuth Secret (32+ characters)"
                  value={config.auth_secret || ""}
                  onChange={(e) => updateField("auth_secret", e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-void/50 border border-glass-border text-text-primary text-sm placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                {saved ? "Settings saved! Restart to apply changes." : "Changes require app restart"}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  {saved ? "Later" : "Cancel"}
                </button>
                {saved ? (
                  <button
                    onClick={restartApp}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-neon-green/20 text-neon-green border border-neon-green/30 hover:bg-neon-green/30"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restart Now
                  </button>
                ) : (
                  <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                  >
                    {saving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Settings button to open the modal
export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-3 rounded-full hover:bg-white/5 transition-colors text-text-secondary hover:text-primary"
      title="API Settings"
    >
      <Settings className="w-5 h-5" />
    </button>
  );
}
