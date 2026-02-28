'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Server,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  X,
  Loader2,
  Clipboard,
  Zap,
} from 'lucide-react';
import { cn, Button } from '@opta/ui';
import { OptaStatusPill, OptaSurface } from '@/components/shared/OptaPrimitives';
import {
  type ConnectionSettings,
  DEFAULT_SETTINGS,
  getConnectionSettings,
  saveConnectionSettings,
  checkLanHealth,
} from '@/lib/connection';

// ---------------------------------------------------------------------------
// Quick-select presets
// ---------------------------------------------------------------------------

const HOST_PRESETS = [
  { label: 'Mono512', value: '192.168.188.11', hint: 'Mac Studio' },
  { label: 'Localhost', value: '127.0.0.1', hint: 'this machine' },
] as const;

const PORT_PRESETS = [
  { label: '1234', value: '1234', hint: 'LMX default' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeneralSettingsPage() {
  const [host,       setHost]       = useState(DEFAULT_SETTINGS.host);
  const [port,       setPort]       = useState(String(DEFAULT_SETTINGS.port));
  const [adminKey,   setAdminKey]   = useState('');
  const [showKey,    setShowKey]    = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [isSaving,   setIsSaving]   = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loaded,     setLoaded]     = useState(false);

  const adminKeyRef = useRef<HTMLInputElement>(null);

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
    return () => { cancelled = true; };
  }, []);

  // Track whether staged values differ from saved values
  useEffect(() => {
    if (!loaded) return;
    async function check() {
      const current = await getConnectionSettings();
      setHasChanges(
        host !== current.host ||
        port !== String(current.port) ||
        adminKey !== current.adminKey,
      );
    }
    check();
  }, [host, port, adminKey, loaded]);

  // --------------------------------------------------------------------------
  // Save & connect — single action that saves then auto-probes
  // --------------------------------------------------------------------------

  const handleSaveAndConnect = useCallback(async () => {
    setIsSaving(true);
    setTestStatus('idle');
    setTestMessage('');

    try {
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

    // Auto-test the saved settings
    setTestStatus('testing');
    const lanUrl = `http://${host}:${port || DEFAULT_SETTINGS.port}`;
    const start = performance.now();
    const reachable = await checkLanHealth(lanUrl);
    const latency = Math.round(performance.now() - start);

    if (reachable) {
      setTestStatus('success');
      setTestMessage(`Connected · ${latency}ms`);
    } else {
      setTestStatus('error');
      setTestMessage('Unreachable — check host and port');
    }

    setTimeout(() => { setTestStatus('idle'); setTestMessage(''); }, 6000);
  }, [host, port, adminKey]);

  // Quick re-test without saving (for when there are no changes)
  const handleTestOnly = useCallback(async () => {
    setTestStatus('testing');
    setTestMessage('');
    const lanUrl = `http://${host}:${port || DEFAULT_SETTINGS.port}`;
    const start = performance.now();
    const reachable = await checkLanHealth(lanUrl);
    const latency = Math.round(performance.now() - start);

    if (reachable) {
      setTestStatus('success');
      setTestMessage(`Connected · ${latency}ms`);
    } else {
      setTestStatus('error');
      setTestMessage('Unreachable');
    }
    setTimeout(() => { setTestStatus('idle'); setTestMessage(''); }, 6000);
  }, [host, port]);

  // --------------------------------------------------------------------------
  // Keyboard: Cmd+S to save, Enter to save when field is focused + hasChanges
  // --------------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges && !isSaving) handleSaveAndConnect();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasChanges, isSaving, handleSaveAndConnect]);

  // --------------------------------------------------------------------------
  // Clipboard paste for admin key
  // --------------------------------------------------------------------------

  const handlePasteKey = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) setAdminKey(text.trim());
    } catch {
      // Clipboard access denied — focus the field so user can paste manually
      adminKeyRef.current?.focus();
    }
  }, []);

  // --------------------------------------------------------------------------
  // Enter key on inputs submits if hasChanges
  // --------------------------------------------------------------------------

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && hasChanges && !isSaving) {
        e.preventDefault();
        handleSaveAndConnect();
      }
    },
    [hasChanges, isSaving, handleSaveAndConnect],
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    );
  }

  const isBusy = isSaving || testStatus === 'testing';

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
      <OptaSurface hierarchy="raised" padding="lg" className="space-y-6">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-neon-cyan" />
          <h3 className="text-base font-semibold text-text-primary">LMX Server</h3>
        </div>

        {/* Host */}
        <div className="space-y-2">
          <label htmlFor="host" className="block text-sm font-medium text-text-secondary">
            Host
          </label>
          <input
            id="host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="192.168.188.11"
            className="w-full px-3 py-2 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
          {/* Quick-select chips */}
          <div className="flex flex-wrap gap-2">
            {HOST_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setHost(p.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  host === p.value
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-opta-surface border-opta-border text-text-muted hover:text-text-secondary hover:border-opta-border/80',
                )}
              >
                {host === p.value && <Check className="w-3 h-3" />}
                {p.label}
                <span className="text-text-muted font-normal">{p.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Port */}
        <div className="space-y-2">
          <label htmlFor="port" className="block text-sm font-medium text-text-secondary">
            Port
          </label>
          <input
            id="port"
            type="text"
            inputMode="numeric"
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
            onKeyDown={onInputKeyDown}
            placeholder="1234"
            className="w-full px-3 py-2 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
          />
          <div className="flex gap-2">
            {PORT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPort(p.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                  port === p.value
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-opta-surface border-opta-border text-text-muted hover:text-text-secondary',
                )}
              >
                {port === p.value && <Check className="w-3 h-3" />}
                {p.label}
                <span className="text-text-muted font-normal">{p.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Admin key */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="admin-key" className="block text-sm font-medium text-text-secondary">
              Admin Key
            </label>
            <button
              type="button"
              onClick={handlePasteKey}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
            >
              <Clipboard className="w-3 h-3" />
              Paste
            </button>
          </div>
          <div className="relative">
            <input
              id="admin-key"
              ref={adminKeyRef}
              type={showKey ? 'text' : 'password'}
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Enter admin key"
              className="w-full px-3 py-2 pr-10 rounded-lg bg-opta-surface border border-opta-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
              aria-label={showKey ? 'Hide admin key' : 'Show admin key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-text-muted">Stored encrypted via Web Crypto API (AES-GCM)</p>
        </div>
      </OptaSurface>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Primary: Save & Connect */}
        <Button
          variant="primary"
          size="md"
          onClick={handleSaveAndConnect}
          disabled={!hasChanges || isBusy}
          className={cn(!hasChanges && 'opacity-50 cursor-not-allowed')}
        >
          {isSaving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
          ) : testStatus === 'testing' && !isSaving ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Connecting…</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" />Save &amp; Connect</>
          )}
        </Button>

        {/* Secondary: re-test without saving */}
        {!hasChanges && (
          <Button
            variant="secondary"
            size="md"
            onClick={handleTestOnly}
            disabled={testStatus === 'testing'}
          >
            {testStatus === 'testing' ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Testing…</>
            ) : testStatus === 'success' ? (
              <><Check className="w-4 h-4 mr-2 text-neon-green" />Connected</>
            ) : testStatus === 'error' ? (
              <><X className="w-4 h-4 mr-2 text-neon-red" />Failed</>
            ) : (
              <><RefreshCw className="w-4 h-4 mr-2" />Test</>
            )}
          </Button>
        )}

        {/* Keyboard hint */}
        {hasChanges && !isBusy && (
          <span className="text-xs text-text-muted hidden sm:block">
            or press <kbd className="px-1.5 py-0.5 rounded border border-opta-border bg-opta-surface text-[10px] font-mono">⌘S</kbd>
            {' '}/ <kbd className="px-1.5 py-0.5 rounded border border-opta-border bg-opta-surface text-[10px] font-mono">Enter</kbd>
          </span>
        )}

        {/* Test result */}
        {testMessage && (
          <OptaStatusPill
            status={testStatus === 'success' ? 'success' : 'danger'}
            label={testMessage}
            icon={
              testStatus === 'success'
                ? <Check className="w-3.5 h-3.5" />
                : <X className="w-3.5 h-3.5" />
            }
          />
        )}
      </div>
    </div>
  );
}
