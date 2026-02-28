'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type HookState = { type: 'ok' | 'error'; message: string } | null;

export function SecurityApiHooks() {
  const [state, setState] = useState<HookState>(null);

  async function run(path: string, method: 'GET' | 'POST' = 'POST') {
    setState(null);
    const res = await fetch(path, { method, headers: { 'content-type': 'application/json' } });
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      setState({ type: 'error', message: String(payload.error ?? payload.reason ?? 'request_failed') });
      return;
    }

    setState({ type: 'ok', message: 'API check passed' });
  }

  return (
    <div className="glass rounded-2xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className="text-opta-primary" />
        <h2 className="text-sm font-medium text-opta-text-secondary">Security API Hooks</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run('/api/devices', 'GET')}
          className={cn('px-3 py-1.5 rounded-lg text-xs glass-subtle hover:border-opta-primary/20 transition-colors')}
        >
          Check devices API
        </button>
        <button
          type="button"
          onClick={() => run('/api/providers', 'GET')}
          className={cn('px-3 py-1.5 rounded-lg text-xs glass-subtle hover:border-opta-primary/20 transition-colors')}
        >
          Check providers API
        </button>
        <button
          type="button"
          onClick={() => run('/api/sessions/revoke-all', 'POST')}
          className={cn('px-3 py-1.5 rounded-lg text-xs glass-subtle hover:border-opta-neon-red/20 transition-colors')}
        >
          Revoke all sessions
        </button>
      </div>
      {state && (
        <p className={cn('mt-3 text-xs', state.type === 'ok' ? 'text-opta-green' : 'text-opta-neon-red')}>
          {state.message}
        </p>
      )}
    </div>
  );
}
