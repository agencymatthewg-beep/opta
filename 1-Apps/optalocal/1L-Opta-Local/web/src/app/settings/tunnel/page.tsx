"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Globe,
  RefreshCw,
  Check,
  X,
  Loader2,
  Wifi,
  Info,
  Clipboard,
  Zap,
} from "lucide-react";
import { cn, Button } from "@opta/ui";
import {
  type ConnectionSettings,
  type ConnectionType,
  getConnectionSettings,
  saveConnectionSettings,
  getOptimalBaseUrl,
} from "@/lib/connection";
import { syncSettingsToCloud } from "@/lib/settings-sync";

type TestStatus = "idle" | "testing" | "success" | "error";

const connectionLabels: Record<
  ConnectionType,
  { label: string; color: string }
> = {
  lan: { label: "LAN · Direct", color: "text-neon-green" },
  wan: { label: "WAN · Tunnel", color: "text-neon-amber" },
  offline: { label: "Offline", color: "text-neon-red" },
};

export default function TunnelSettingsPage() {
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [useTunnel, setUseTunnel] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [detectedType, setDetectedType] = useState<ConnectionType | null>(null);
  const [detectedLatency, setDetectedLatency] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUrlChanges, setHasUrlChanges] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const tunnelUrlRef = useRef<HTMLInputElement>(null);

  // Load settings from storage on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const settings = await getConnectionSettings();
      if (cancelled) return;
      setTunnelUrl(settings.tunnelUrl);
      setUseTunnel(settings.useTunnel);
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Track URL changes only (toggle auto-saves)
  useEffect(() => {
    if (!loaded) return;
    async function check() {
      const current = await getConnectionSettings();
      setHasUrlChanges(tunnelUrl !== current.tunnelUrl);
    }
    check();
  }, [tunnelUrl, loaded]);

  // --------------------------------------------------------------------------
  // Toggle — auto-saves immediately (no explicit Save needed for boolean)
  // --------------------------------------------------------------------------

  const handleToggle = useCallback(async () => {
    const newVal = !useTunnel;
    setUseTunnel(newVal);
    // Auto-save the toggle
    const existing = await getConnectionSettings();
    const saved = { ...existing, tunnelUrl, useTunnel: newVal };
    await saveConnectionSettings(saved);
    void syncSettingsToCloud(saved);
    // Auto-focus URL field when enabling the tunnel
    if (newVal) {
      setTimeout(() => tunnelUrlRef.current?.focus(), 50);
    }
  }, [useTunnel, tunnelUrl]);

  // --------------------------------------------------------------------------
  // Save URL + Test — single action
  // --------------------------------------------------------------------------

  const handleSaveAndTest = useCallback(async () => {
    setIsSaving(true);
    setTestStatus("idle");
    setTestMessage("");
    setDetectedType(null);
    setDetectedLatency(null);

    try {
      const existing = await getConnectionSettings();
      const saved = { ...existing, tunnelUrl, useTunnel };
      await saveConnectionSettings(saved);
      setHasUrlChanges(false);
      void syncSettingsToCloud(saved);
    } finally {
      setIsSaving(false);
    }

    // Auto-test after save
    setTestStatus("testing");
    const settings = await getConnectionSettings();
    const probeSettings: ConnectionSettings = {
      ...settings,
      tunnelUrl,
      useTunnel: true,
    };
    const result = await getOptimalBaseUrl(probeSettings);

    if (result) {
      setTestStatus("success");
      setDetectedType(result.type);
      setDetectedLatency(result.latencyMs);
      setTestMessage(
        result.type === "lan"
          ? `LAN reachable (${result.latencyMs}ms) — tunnel not needed on this network`
          : `Tunnel reachable (${result.latencyMs}ms)`,
      );
    } else {
      setTestStatus("error");
      setDetectedType("offline");
      setTestMessage("Server unreachable via LAN and tunnel");
    }

    setTimeout(() => {
      setTestStatus("idle");
      setTestMessage("");
      setDetectedType(null);
      setDetectedLatency(null);
    }, 8000);
  }, [tunnelUrl, useTunnel]);

  // Quick re-test without saving
  const handleTestOnly = useCallback(async () => {
    setTestStatus("testing");
    setTestMessage("");
    setDetectedType(null);
    setDetectedLatency(null);

    const settings = await getConnectionSettings();
    const probeSettings: ConnectionSettings = {
      ...settings,
      tunnelUrl,
      useTunnel: true,
    };
    const result = await getOptimalBaseUrl(probeSettings);

    if (result) {
      setTestStatus("success");
      setDetectedType(result.type);
      setDetectedLatency(result.latencyMs);
      setTestMessage(
        result.type === "lan"
          ? `LAN reachable (${result.latencyMs}ms)`
          : `Tunnel reachable (${result.latencyMs}ms)`,
      );
    } else {
      setTestStatus("error");
      setDetectedType("offline");
      setTestMessage("Server unreachable");
    }

    setTimeout(() => {
      setTestStatus("idle");
      setTestMessage("");
      setDetectedType(null);
      setDetectedLatency(null);
    }, 8000);
  }, [tunnelUrl]);

  // --------------------------------------------------------------------------
  // Keyboard: Cmd+S, Enter
  // --------------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (hasUrlChanges && !isSaving) handleSaveAndTest();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasUrlChanges, isSaving, handleSaveAndTest]);

  const onUrlKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSaving) {
        e.preventDefault();
        handleSaveAndTest();
      }
    },
    [isSaving, handleSaveAndTest],
  );

  // --------------------------------------------------------------------------
  // Clipboard paste for tunnel URL
  // --------------------------------------------------------------------------

  const handlePasteUrl = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (trimmed.startsWith("http")) setTunnelUrl(trimmed);
    } catch {
      tunnelUrlRef.current?.focus();
    }
  }, []);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  const isBusy = isSaving || testStatus === "testing";

  return (
    <div className="max-w-xl space-y-8">
      {/* Page heading */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Tunnel</h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure a Cloudflare Tunnel to access your LMX server from anywhere.
        </p>
      </div>

      {/* Info box */}
      <div className="glass-subtle rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-neon-blue flex-shrink-0 mt-0.5" />
        <div className="text-sm text-text-secondary space-y-1">
          <p>
            A tunnel lets you chat with your local AI when away from home. Opta
            Local automatically picks LAN when available, tunnel when not.
          </p>
          <p className="text-text-muted">
            Requires Cloudflare Tunnel pointed at your LMX server.
          </p>
        </div>
      </div>

      {/* Tunnel configuration */}
      <section className="glass-subtle rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-neon-amber" />
          <h3 className="text-base font-semibold text-text-primary">
            Cloudflare Tunnel
          </h3>
        </div>

        {/* Enable toggle — auto-saves */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Enable Tunnel
            </p>
            <p className="text-xs text-text-muted">
              Fall back to tunnel when LAN is unavailable
              {useTunnel && (
                <span className="ml-2 text-neon-green font-medium">
                  · saved
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useTunnel}
            onClick={handleToggle}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50",
              useTunnel ? "bg-primary" : "bg-opta-border",
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                useTunnel ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        </div>

        {/* Tunnel URL */}
        <div
          className={cn(
            "space-y-2 transition-opacity",
            !useTunnel && "opacity-40 pointer-events-none",
          )}
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="tunnel-url"
              className="block text-sm font-medium text-text-secondary"
            >
              Tunnel URL
            </label>
            <button
              type="button"
              onClick={handlePasteUrl}
              tabIndex={useTunnel ? 0 : -1}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
            >
              <Clipboard className="w-3 h-3" />
              Paste
            </button>
          </div>
          <input
            id="tunnel-url"
            ref={tunnelUrlRef}
            type="url"
            value={tunnelUrl}
            onChange={(e) => setTunnelUrl(e.target.value)}
            onKeyDown={onUrlKeyDown}
            placeholder="https://lmx.optamize.biz"
            disabled={!useTunnel}
            className="w-full px-3 py-2 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:cursor-not-allowed"
          />
          <p className="text-xs text-text-muted">
            Public HTTPS URL for your Cloudflare Tunnel
          </p>
        </div>
      </section>

      {/* Connection test result */}
      {detectedType && (
        <section className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              {detectedType === "offline" && (
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-neon-red" />
              )}
              <span
                className={cn(
                  "relative inline-flex h-2.5 w-2.5 rounded-full",
                  detectedType === "lan" && "bg-neon-green",
                  detectedType === "wan" && "bg-neon-amber",
                  detectedType === "offline" && "bg-neon-red",
                )}
              />
            </span>
            <p
              className={cn(
                "text-sm font-medium",
                connectionLabels[detectedType].color,
              )}
            >
              {connectionLabels[detectedType].label}
              {detectedLatency !== null && detectedType !== "offline" && (
                <span className="text-text-muted ml-2">
                  {detectedLatency}ms
                </span>
              )}
            </p>
            {testMessage && (
              <p className="text-xs text-text-secondary ml-1">{testMessage}</p>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Primary: Save & Test */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSaveAndTest}
          disabled={!hasUrlChanges || isBusy}
          className={cn(!hasUrlChanges && "opacity-50 cursor-not-allowed")}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving…
            </>
          ) : testStatus === "testing" && !isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Testing…
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Save &amp; Test
            </>
          )}
        </Button>

        {/* Re-test without saving */}
        {!hasUrlChanges && useTunnel && tunnelUrl && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleTestOnly}
            disabled={testStatus === "testing"}
          >
            {testStatus === "testing" ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Testing…
              </>
            ) : testStatus === "success" ? (
              <>
                <Check className="w-4 h-4 mr-2 text-neon-green" />
                Reachable
              </>
            ) : testStatus === "error" ? (
              <>
                <X className="w-4 h-4 mr-2 text-neon-red" />
                Unreachable
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                Test
              </>
            )}
          </Button>
        )}

        {/* Keyboard hint */}
        {hasUrlChanges && !isBusy && (
          <span className="text-xs text-text-muted hidden sm:block">
            or press{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-opta-border bg-opta-surface text-[10px] font-mono">
              ⌘S
            </kbd>{" "}
            /{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-opta-border bg-opta-surface text-[10px] font-mono">
              Enter
            </kbd>
          </span>
        )}
      </div>
    </div>
  );
}
