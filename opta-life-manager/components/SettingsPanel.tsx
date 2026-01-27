"use client";

import { useState, useEffect } from "react";
import { X, Eye, EyeOff, Save, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface SettingField {
  key: string;
  label: string;
  description: string;
  placeholder: string;
}

const SETTINGS_FIELDS: SettingField[] = [
  {
    key: "TODOIST_API_TOKEN",
    label: "Todoist API Token",
    description: "Get from Settings → Integrations → Developer in Todoist",
    placeholder: "e.g. 0123456789abcdef...",
  },
  {
    key: "GOOGLE_CLIENT_ID",
    label: "Google Client ID",
    description: "OAuth 2.0 Client ID from Google Cloud Console",
    placeholder: "e.g. 123456789.apps.googleusercontent.com",
  },
  {
    key: "GOOGLE_CLIENT_SECRET",
    label: "Google Client Secret",
    description: "OAuth 2.0 Client Secret from Google Cloud Console",
    placeholder: "e.g. GOCSPX-...",
  },
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API Key",
    description: "Google AI Studio API key for AI features",
    placeholder: "e.g. AIzaSy...",
  },
  {
    key: "AUTH_SECRET",
    label: "Auth Secret",
    description: "NextAuth secret for session encryption. Generate with: openssl rand -base64 32",
    placeholder: "Random base64 string",
  },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.success) {
        setConfiguredKeys(data.keys);
      }
    } catch {
      // Silently fail - just show all as unconfigured
    }
    setLoading(false);
  };

  const handleSave = async () => {
    // Filter out empty values
    const toSave: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value && value.trim().length > 0) {
        toSave[key] = value.trim();
      }
    }

    if (Object.keys(toSave).length === 0) {
      setFeedback({ type: "error", message: "No changes to save" });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: toSave }),
      });
      const data = await res.json();

      if (data.success) {
        setFeedback({ type: "success", message: "Settings saved! Restart the app to apply changes." });
        setValues({});
        loadStatus();
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to save" });
      }
    } catch {
      setFeedback({ type: "error", message: "Network error - could not save settings" });
    }

    setSaving(false);
    setTimeout(() => setFeedback(null), 5000);
  };

  const toggleVisibility = (key: string) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg z-50 overflow-y-auto"
          >
            <div className="min-h-full bg-void/95 backdrop-blur-xl border-l border-glass-border p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold text-text-primary">Settings</h2>
                  <p className="text-xs text-text-muted mt-1">Configure API keys and secrets</p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors text-text-muted hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback */}
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-lg mb-6 text-sm",
                      feedback.type === "success"
                        ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    )}
                  >
                    {feedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {feedback.message}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Loading */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : (
                <>
                  {/* Fields */}
                  <div className="space-y-5">
                    {SETTINGS_FIELDS.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-text-primary">
                            {field.label}
                          </label>
                          {configuredKeys[field.key] && !values[field.key] && (
                            <span className="flex items-center gap-1 text-[10px] text-neon-green">
                              <CheckCircle2 className="w-3 h-3" />
                              Configured
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">
                          {field.description}
                        </p>
                        <div className="relative">
                          <input
                            type={visibility[field.key] ? "text" : "password"}
                            value={values[field.key] || ""}
                            onChange={(e) =>
                              setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            placeholder={
                              configuredKeys[field.key]
                                ? "••••••••  (already set — enter new value to update)"
                                : field.placeholder
                            }
                            className="w-full bg-white/5 border border-glass-border rounded-lg px-3 py-2.5 pr-10 text-sm text-text-primary focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 placeholder:text-text-muted/50 transition-all font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => toggleVisibility(field.key)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
                          >
                            {visibility[field.key] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Save Button */}
                  <div className="mt-8 pt-6 border-t border-glass-border">
                    <button
                      onClick={handleSave}
                      disabled={saving || Object.values(values).every((v) => !v?.trim())}
                      className={cn(
                        "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                        "bg-primary hover:bg-primary-glow text-white",
                        "disabled:opacity-40 disabled:cursor-not-allowed"
                      )}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving ? "Saving..." : "Save Settings"}
                    </button>
                    <p className="text-[10px] text-text-muted text-center mt-3">
                      Settings are saved to .env.local. The app needs a restart to apply changes.
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
