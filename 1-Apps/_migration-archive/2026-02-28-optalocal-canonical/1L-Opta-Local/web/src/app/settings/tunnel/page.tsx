'use client';

import { useEffect, useState } from 'react';

import { OptaSurface } from '@/components/shared/OptaPrimitives';
import {
  getConnectionSettings,
  saveConnectionSettings,
  type ConnectionSettings,
} from '@/lib/connection';

export default function TunnelSettingsPage() {
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getConnectionSettings().then(setSettings).catch(() => {
      setSettings(null);
    });
  }, []);

  const updateTunnelUrl = (value: string) => {
    if (!settings) return;
    setSettings({ ...settings, tunnelUrl: value });
  };

  const updateUseTunnel = (value: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, useTunnel: value });
  };

  const save = async () => {
    if (!settings) return;
    setIsSaving(true);
    setMessage(null);

    try {
      await saveConnectionSettings(settings);
      setMessage('Saved tunnel settings.');
    } catch {
      setMessage('Failed to save tunnel settings.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Tunnel</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Configure a secure external endpoint when remote access is required.
        </p>
      </div>

      <OptaSurface hierarchy="raised" padding="lg" className="space-y-4">
        <label className="block space-y-1 text-sm text-text-secondary" htmlFor="tunnel-url">
          <span>Tunnel URL</span>
          <input
            id="tunnel-url"
            value={settings?.tunnelUrl ?? ''}
            onChange={(event) => updateTunnelUrl(event.target.value)}
            className="w-full rounded border border-opta-border bg-opta-surface/30 px-3 py-2 text-sm text-text-primary"
            placeholder="https://example.trycloudflare.com"
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={Boolean(settings?.useTunnel)}
            onChange={(event) => updateUseTunnel(event.target.checked)}
          />
          <span>Use tunnel for new connections</span>
        </label>

        <button
          type="button"
          onClick={() => {
            void save();
          }}
          className="codex-primary-btn"
          disabled={!settings || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Tunnel Settings'}
        </button>

        {message ? <p className="text-xs text-text-muted">{message}</p> : null}
      </OptaSurface>
    </div>
  );
}
