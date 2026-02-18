'use client';

import { useState, useEffect, useCallback } from 'react';
import { Server, Eye, EyeOff, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { cn, Button } from '@opta/ui';
import {
  type ConnectionSettings,
  DEFAULT_SETTINGS,
  getConnectionSettings,
  saveConnectionSettings,
  checkLanHealth,
} from '@/lib/connection';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function GeneralSettingsPage() {
  const [host, setHost] = useState(DEFAULT_SETTINGS.host);
  const [port, setPort] = useState(String(DEFAULT_SETTINGS.port));
  const [adminKey, setAdminKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load settings from storage on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const settings = await getConnectionSettings();
      if (cancelled) return;
      setHost(settings.host);
      setPort(String(settings.port));
      setAdminKey(settings.adminKey);
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
        host !== current.host ||
        port !== String(current.port) ||
        adminKey !== current.adminKey;
      setHasChanges(changed);
    }
    check();
  }, [host, port, adminKey, loaded]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Load existing settings to preserve tunnel config
      const existing = await getConnectionSettings();
      const updated: ConnectionSettings = {
        ...existing,
        host,
        port: Number(port) || DEFAULT_SETTINGS.port,
        adminKey,
      };
      await saveConnectionSettings(updated);
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }, [host, port, adminKey]);

  const handleTestConnection = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');

    const lanUrl = `http://${host}:${port || DEFAULT_SETTINGS.port}`;
    const start = performance.now();
    const reachable = await checkLanHealth(lanUrl);
    const latency = Math.round(performance.now() - start);

    if (reachable) {
      setTestStatus('success');
      setTestMessage(`Connected in ${latency}ms`);
    } else {
      setTestStatus('error');
      setTestMessage('Server unreachable — check host and port');
    }

    // Reset status after 5 seconds
    setTimeout(() => {
      setTestStatus('idle');
      setTestMessage('');
    }, 5000);
  }, [host, port]);

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
        <h2 className="text-xl font-semibold text-text-primary">General</h2>
        <p className="text-sm text-text-secondary mt-1">
          Configure the LMX server connection for your Mac Studio.
        </p>
      </div>

      {/* Server connection section */}
      <section className="glass-subtle rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-neon-cyan" />
          <h3 className="text-base font-semibold text-text-primary">
            LMX Server
          </h3>
        </div>

        {/* Host */}
        <div className="space-y-2">
          <label
            htmlFor="host"
            className="block text-sm font-medium text-text-secondary"
          >
            Host
          </label>
          <input
            id="host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.188.11"
            className="w-full px-3 py-2 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
          <p className="text-xs text-text-muted">
            IP address or hostname of the machine running Opta LMX
          </p>
        </div>

        {/* Port */}
        <div className="space-y-2">
          <label
            htmlFor="port"
            className="block text-sm font-medium text-text-secondary"
          >
            Port
          </label>
          <input
            id="port"
            type="text"
            inputMode="numeric"
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
            placeholder="1234"
            className="w-full px-3 py-2 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
        </div>

        {/* Admin key */}
        <div className="space-y-2">
          <label
            htmlFor="admin-key"
            className="block text-sm font-medium text-text-secondary"
          >
            Admin Key
          </label>
          <div className="relative">
            <input
              id="admin-key"
              type={showKey ? 'text' : 'password'}
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin key"
              className="w-full px-3 py-2 pr-10 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
              aria-label={showKey ? 'Hide admin key' : 'Show admin key'}
            >
              {showKey ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Stored encrypted using Web Crypto API (AES-GCM)
          </p>
        </div>
      </section>

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

        {/* Test connection button */}
        <Button
          variant="secondary"
          size="md"
          onClick={handleTestConnection}
          disabled={testStatus === 'testing'}
        >
          {testStatus === 'testing' ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : testStatus === 'success' ? (
            <>
              <Check className="w-4 h-4 mr-2 text-neon-green" />
              Connected
            </>
          ) : testStatus === 'error' ? (
            <>
              <X className="w-4 h-4 mr-2 text-neon-red" />
              Failed
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
