'use client';

import { useMemo, useState } from 'react';

import { CodexActionLine } from '@/components/shared/CodexActionLine';
import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';
import { CodexKeyValue } from '@/components/shared/CodexKeyValue';
import { SETTINGS_CHANGE_GUARD } from '@/lib/safety/change-scope-guard';
import { diffSettings } from '@/lib/safety/settings-diff';

interface SettingsState {
  host: string;
  port: number;
  adminKey: string;
  useTunnel: boolean;
  tunnelUrl: string;
  densityMode: 'compact' | 'comfortable';
}

function toRecord(settings: SettingsState): Record<string, unknown> {
  return {
    host: settings.host,
    port: settings.port,
    adminKey: settings.adminKey,
    useTunnel: settings.useTunnel,
    tunnelUrl: settings.tunnelUrl,
    densityMode: settings.densityMode,
  };
}

const INITIAL_SETTINGS: SettingsState = {
  host: '192.168.188.11',
  port: 1234,
  adminKey: '',
  useTunnel: false,
  tunnelUrl: '',
  densityMode: 'compact',
};

export default function SettingsPage() {
  const [baseline, setBaseline] = useState<SettingsState>(INITIAL_SETTINGS);
  const [draft, setDraft] = useState<SettingsState>(INITIAL_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const previewDiff = useMemo(
    () => diffSettings(toRecord(baseline), toRecord(draft)),
    [baseline, draft],
  );

  const applyConnectionSettings = () => {
    const validation = SETTINGS_CHANGE_GUARD.validate(
      'connection:update',
      toRecord(baseline),
      toRecord(draft),
    );

    if (!validation.ok) {
      setError(
        `Blocked change: ${validation.blockedKeys.join(', ')}. Only scoped connection keys are allowed.`,
      );
      return;
    }

    setError(null);
    setBaseline(draft);
  };

  return (
    <div className="max-w-4xl space-y-3">
      <CodexDenseSurface
        title="Settings"
        subtitle="Precision updates with scoped mutation guard and diff preview."
      >
        <div className="codex-grid-2">
          <div>
            <label className="codex-kv-label" htmlFor="settings-host">
              Host
            </label>
            <input
              id="settings-host"
              data-testid="settings-host-input"
              value={draft.host}
              onChange={(event) =>
                setDraft((current) => ({ ...current, host: event.target.value }))
              }
              className="w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="codex-kv-label" htmlFor="settings-port">
              Port
            </label>
            <input
              id="settings-port"
              value={draft.port}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  port: Number(event.target.value) || 0,
                }))
              }
              className="w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="codex-kv-label" htmlFor="settings-admin-key">
              Admin Key
            </label>
            <input
              id="settings-admin-key"
              value={draft.adminKey}
              onChange={(event) =>
                setDraft((current) => ({ ...current, adminKey: event.target.value }))
              }
              className="w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-sm"
            />
          </div>

          <div>
            <label className="codex-kv-label" htmlFor="settings-tunnel-url">
              Tunnel URL
            </label>
            <input
              id="settings-tunnel-url"
              value={draft.tunnelUrl}
              onChange={(event) =>
                setDraft((current) => ({ ...current, tunnelUrl: event.target.value }))
              }
              className="w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-sm"
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={draft.useTunnel}
              onChange={(event) =>
                setDraft((current) => ({ ...current, useTunnel: event.target.checked }))
              }
            />
            <span className="codex-kv-label" style={{ margin: 0 }}>
              Use Tunnel
            </span>
          </label>

          <div>
            <label className="codex-kv-label" htmlFor="settings-density">
              Density Mode (unrelated)
            </label>
            <select
              id="settings-density"
              value={draft.densityMode}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  densityMode: event.target.value as SettingsState['densityMode'],
                }))
              }
              className="w-full rounded border border-opta-border bg-opta-surface/30 px-2 py-1 text-sm"
            >
              <option value="compact">compact</option>
              <option value="comfortable">comfortable</option>
            </select>
          </div>
        </div>

        <CodexActionLine
          primaryLabel="Apply Connection Settings"
          onPrimary={applyConnectionSettings}
          secondary={<span className="codex-kv-label">Action scope: connection:update</span>}
        />

        {error ? <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p> : null}
      </CodexDenseSurface>

      <CodexDenseSurface title="Diff Preview" subtitle="Only changed keys are shown.">
        <pre data-testid="settings-diff-preview" className="rounded border border-opta-border bg-opta-surface/30 p-2 text-xs">
          {previewDiff.length > 0
            ? JSON.stringify(previewDiff, null, 2)
            : 'No pending changes.'}
        </pre>
      </CodexDenseSurface>

      <CodexDenseSurface title="Applied Snapshot" subtitle="Guarded committed settings state.">
        <CodexKeyValue label="Host" value={baseline.host} testId="applied-host" />
        <CodexKeyValue
          label="Density"
          value={baseline.densityMode}
          testId="applied-density"
        />
      </CodexDenseSurface>
    </div>
  );
}
