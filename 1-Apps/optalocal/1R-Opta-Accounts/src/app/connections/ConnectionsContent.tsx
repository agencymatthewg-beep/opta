'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, Link2Off, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeviceFlowCard } from '@/components/providers/DeviceFlowCard';
import { AnthropicSetupCard } from '@/components/providers/AnthropicSetupCard';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderStatus = 'connected' | 'revoked' | null;

interface ProviderConnection {
  id: string;
  provider: string;
  status: ProviderStatus;
  meta: Record<string, unknown> | null;
  updated_at: string;
}

type ConnectMethod = 'device_flow' | 'oauth_redirect' | 'paste_in' | 'api_key';

interface ProviderDef {
  id: string;
  name: string;
  description: string;
  connectMethod: ConnectMethod;
  color: string;
  initial: string;
  oauthStartUrl?: string;
  deviceStartUrl?: string;
  devicePollUrl?: string;
}

const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'Use your Copilot subscription for AI completions',
    connectMethod: 'device_flow',
    color: '#24292e',
    initial: 'GH',
  },
  {
    id: 'gemini-cli',
    name: 'Google Gemini CLI',
    description: 'Access Gemini models via your Google account',
    connectMethod: 'oauth_redirect',
    oauthStartUrl: '/api/oauth/gemini-cli/start?return_to=/connections',
    color: '#4285F4',
    initial: 'G',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Connect with your Anthropic API access',
    connectMethod: 'paste_in',
    color: '#d97706',
    initial: 'A',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    description: 'Use your Codex subscription for code generation',
    connectMethod: 'device_flow',
    color: '#10a37f',
    initial: 'OC',
    deviceStartUrl: '/api/oauth/codex/device/start',
    devicePollUrl: '/api/oauth/codex/device/poll',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4 and other OpenAI models',
    connectMethod: 'api_key',
    color: '#10a37f',
    initial: 'OA',
  },
  {
    id: 'gemini',
    name: 'Google Gemini (API Key)',
    description: 'Gemini via API key from Google AI Studio',
    connectMethod: 'api_key',
    color: '#4285F4',
    initial: 'G',
  },
];

const SPRING = { type: 'spring', stiffness: 220, damping: 26 } as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useConnections() {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { providers: ProviderConnection[] };
      setConnections(data.providers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refetch(); }, [refetch]);

  return { connections, loading, error, refetch };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProviderStatus }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25">
        <CheckCircle size={10} />
        Connected
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-opta-text-muted border border-zinc-700">
      Not connected
    </span>
  );
}

interface ApiKeyInputProps {
  provider: string;
  onConnected: () => void;
}

function ApiKeyInput({ provider, onConnected }: ApiKeyInputProps) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/providers/${provider}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      if (res.ok) {
        onConnected();
        setKey('');
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Connection failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Paste API key…"
          className="flex-1 px-3 py-2 rounded-lg text-sm font-mono bg-zinc-900 border border-zinc-800 text-opta-text-primary placeholder:text-opta-text-muted focus:outline-none focus:border-opta-primary/50 transition-colors"
        />
        <motion.button
          onClick={handleConnect}
          disabled={!key.trim() || loading}
          whileHover={{ scale: key.trim() ? 1.01 : 1 }}
          whileTap={{ scale: 0.98 }}
          transition={SPRING}
          className="px-4 py-2 rounded-lg bg-opta-primary text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Connect'}
        </motion.button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ConnectionsContent() {
  const { connections, loading, error, refetch } = useConnections();
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const getConnection = (id: string) =>
    connections.find(c => c.provider === id) ?? null;

  const handleDisconnect = async (provider: string) => {
    await fetch(`/api/providers/${provider}/disconnect`, { method: 'POST' });
    await refetch();
  };

  return (
    <div className="min-h-screen px-4 py-12 max-w-lg mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={SPRING}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-opta-text-primary tracking-tight">Connected Services</h1>
        <p className="text-sm text-opta-text-secondary mt-1">
          Manage how Opta connects to your AI providers. Connections sync to your CLI and desktop.
        </p>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-opta-text-muted text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading connections…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="glass rounded-xl p-4 flex items-center gap-3 text-sm text-red-400 mb-4">
          <AlertCircle size={16} />
          {error}
          <button onClick={refetch} className="ml-auto text-opta-primary hover:underline text-xs">
            Retry
          </button>
        </div>
      )}

      {/* Provider list */}
      {!loading && (
        <div className="flex flex-col gap-3">
          {PROVIDER_DEFS.map((def, i) => {
            const conn = getConnection(def.id);
            const isConnected = conn?.status === 'connected';
            const isExpanded = expandedProvider === def.id;

            return (
              <motion.div
                key={def.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING, delay: i * 0.04 }}
                className="glass rounded-2xl overflow-hidden"
              >
                {/* Row */}
                <div className="flex items-center gap-3 p-4">
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ backgroundColor: `${def.color}25`, color: def.color }}
                  >
                    {def.initial}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-opta-text-primary">{def.name}</p>
                    <p className="text-xs text-opta-text-muted truncate">{def.description}</p>
                  </div>

                  {/* Status + action */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={isConnected ? 'connected' : null} />

                    {isConnected ? (
                      <motion.button
                        onClick={() => handleDisconnect(def.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={SPRING}
                        className="p-1.5 rounded-lg text-opta-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Disconnect"
                      >
                        <Link2Off size={14} />
                      </motion.button>
                    ) : (
                      def.connectMethod === 'oauth_redirect' ? (
                        <a
                          href={def.oauthStartUrl}
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium',
                            'bg-opta-primary/15 text-opta-primary border border-opta-primary/25',
                            'hover:bg-opta-primary/25 transition-colors',
                          )}
                        >
                          <Link2 size={12} />
                          Connect
                        </a>
                      ) : (
                        <motion.button
                          onClick={() => setExpandedProvider(isExpanded ? null : def.id)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          transition={SPRING}
                          className={cn(
                            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium',
                            'bg-opta-primary/15 text-opta-primary border border-opta-primary/25',
                            'hover:bg-opta-primary/25 transition-colors',
                          )}
                        >
                          <Link2 size={12} />
                          {isExpanded ? 'Cancel' : 'Connect'}
                        </motion.button>
                      )
                    )}
                  </div>
                </div>

                {/* Expanded connect UI */}
                <AnimatePresence>
                  {isExpanded && !isConnected && (
                    <motion.div
                      key="expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPRING}
                      className="overflow-hidden border-t border-zinc-800"
                    >
                      <div className="p-4">
                        {def.connectMethod === 'device_flow' && (
                          <DeviceFlowCard
                            onConnected={async () => {
                              await refetch();
                              setExpandedProvider(null);
                            }}
                            startUrl={def.deviceStartUrl}
                            pollUrl={def.devicePollUrl}
                            providerLabel={def.name}
                          />
                        )}
                        {def.connectMethod === 'paste_in' && (
                          <AnthropicSetupCard
                            onConnected={async () => {
                              await refetch();
                              setExpandedProvider(null);
                            }}
                          />
                        )}
                        {def.connectMethod === 'api_key' && (
                          <ApiKeyInput
                            provider={def.id}
                            onConnected={async () => {
                              await refetch();
                              setExpandedProvider(null);
                            }}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Token expiry warning */}
                {isConnected && conn?.updated_at && (
                  <div className="px-4 pb-3 flex items-center gap-1.5 text-xs text-opta-text-muted">
                    <RefreshCw size={10} />
                    Last updated {new Date(conn.updated_at).toLocaleDateString()}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
