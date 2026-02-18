'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  RefreshCw,
  Check,
  X,
  Loader2,
  Wifi,
  WifiOff,
  Info,
} from 'lucide-react';
import { cn, Button } from '@opta/ui';
import {
  type ConnectionSettings,
  type ConnectionType,
  DEFAULT_SETTINGS,
  getConnectionSettings,
  saveConnectionSettings,
  getOptimalBaseUrl,
} from '@/lib/connection';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const connectionLabels: Record<ConnectionType, { label: string; color: string; icon: typeof Wifi }> = {
  lan: { label: 'LAN (Direct)', color: 'text-neon-green', icon: Wifi },
  wan: { label: 'WAN (Tunnel)', color: 'text-neon-amber', icon: Globe },
  offline: { label: 'Offline', color: 'text-neon-red', icon: WifiOff },
};

export default function TunnelSettingsPage() {
  const [tunnelUrl, setTunnelUrl] = useState('');
  const [useTunnel, setUseTunnel] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [detectedType, setDetectedType] = useState<ConnectionType | null>(null);
  const [detectedLatency, setDetectedLatency] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loaded, setLoaded] = useState(false);

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

  // Track changes
  useEffect(() => {
    if (!loaded) return;
    async function check() {
      const current = await getConnectionSettings();
      const changed =
        tunnelUrl !== current.tunnelUrl || useTunnel !== current.useTunnel;
      setHasChanges(changed);
    }
    check();
  }, [tunnelUrl, useTunnel, loaded]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Load existing settings to preserve host/port/adminKey
      const existing = await getConnectionSettings();
      const updated: ConnectionSettings = {
        ...existing,
        tunnelUrl,
        useTunnel,
      };
      await saveConnectionSettings(updated);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [tunnelUrl, useTunnel]);

  const handleTestTunnel = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');
    setDetectedType(null);
    setDetectedLatency(null);

    // Build current settings for the probe
    const settings = await getConnectionSettings();
    const probeSettings: ConnectionSettings = {
      ...settings,
      tunnelUrl,
      useTunnel: true, // Force tunnel on for this test
    };

    const result = await getOptimalBaseUrl(probeSettings);

    if (result) {
      setTestStatus('success');
      setDetectedType(result.type);
      setDetectedLatency(result.latencyMs);
      setTestMessage(
        result.type === 'lan'
          ? `LAN reachable (${result.latencyMs}ms) — tunnel not needed on this network`
          : `Tunnel reachable (${result.latencyMs}ms)`,
      );
    } else {
      setTestStatus('error');
      setDetectedType('offline');
      setTestMessage('Server unreachable via LAN and tunnel');
    }

    // Reset status after 8 seconds
    setTimeout(() => {
      setTestStatus('idle');
      setTestMessage('');
      setDetectedType(null);
      setDetectedLatency(null);
    }, 8000);
  }, [tunnelUrl]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

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
            A tunnel lets you chat with your local AI when you are away from
            your home network. Opta Local automatically detects whether you are
            on LAN or need the tunnel, and picks the fastest path.
          </p>
          <p className="text-text-muted">
            Requires a Cloudflare Tunnel pointed at your LMX server (e.g.,
            lmx.optamize.biz).
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

        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">
              Enable Tunnel
            </p>
            <p className="text-xs text-text-muted">
              Fall back to tunnel when LAN is unavailable
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useTunnel}
            onClick={() => setUseTunnel((prev) => !prev)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50',
              useTunnel ? 'bg-primary' : 'bg-opta-border',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                useTunnel ? 'translate-x-6' : 'translate-x-1',
              )}
            />
          </button>
        </div>

        {/* Tunnel URL */}
        <div className={cn('space-y-2 transition-opacity', !useTunnel && 'opacity-50')}>
          <label
            htmlFor="tunnel-url"
            className="block text-sm font-medium text-text-secondary"
          >
            Tunnel URL
          </label>
          <input
            id="tunnel-url"
            type="url"
            value={tunnelUrl}
            onChange={(e) => setTunnelUrl(e.target.value)}
            placeholder="https://lmx.optamize.biz"
            disabled={!useTunnel}
            className="w-full px-3 py-2 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-text-muted">
            The public HTTPS URL for your Cloudflare Tunnel
          </p>
        </div>
      </section>

      {/* Connection test result */}
      {detectedType && (
        <section className="glass-subtle rounded-xl p-4">
          <div className="flex items-center gap-3">
            {/* Status dot */}
            <span className="relative flex h-2.5 w-2.5">
              {detectedType === 'offline' && (
                <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-neon-red" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2.5 w-2.5 rounded-full',
                  detectedType === 'lan' && 'bg-neon-green',
                  detectedType === 'wan' && 'bg-neon-amber',
                  detectedType === 'offline' && 'bg-neon-red',
                )}
              />
            </span>
            <div className="flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  connectionLabels[detectedType].color,
                )}
              >
                {connectionLabels[detectedType].label}
                {detectedLatency !== null && detectedType !== 'offline' && (
                  <span className="text-text-muted ml-2">
                    {detectedLatency}ms
                  </span>
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Save button */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(!hasChanges && 'opacity-50 cursor-not-allowed')}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>

        {/* Test tunnel button */}
        <Button
          variant="secondary"
          size="md"
          onClick={handleTestTunnel}
          disabled={testStatus === 'testing' || (!useTunnel && !tunnelUrl)}
        >
          {testStatus === 'testing' ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : testStatus === 'success' ? (
            <>
              <Check className="w-4 h-4 mr-2 text-neon-green" />
              Reachable
            </>
          ) : testStatus === 'error' ? (
            <>
              <X className="w-4 h-4 mr-2 text-neon-red" />
              Unreachable
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Test Connection
            </>
          )}
        </Button>

        {/* Test result message */}
        {testMessage && (
          <span
            className={cn(
              'text-sm',
              testStatus === 'success' ? 'text-neon-green' : 'text-neon-red',
            )}
          >
            {testMessage}
          </span>
        )}
      </div>
    </div>
  );
}
