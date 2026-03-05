import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const CLI_REPLAY_TABLE = 'accounts_cli_replay_nonces';
const CLI_REPLAY_MAX_ENTRIES = 4096;
const DEFAULT_DURABLE_REPLAY_PRUNE_INTERVAL_MS = 5 * 60 * 1000;

type ReplayKind = 'handoff' | 'relay';

declare global {
  var __optaCliReplayStore: Map<string, number> | undefined;
  var __optaCliReplaySupabase: SupabaseClient | null | undefined;
  var __optaCliReplayNextPruneAtMs: number | undefined;
}

function replayStore(): Map<string, number> {
  if (!globalThis.__optaCliReplayStore) {
    globalThis.__optaCliReplayStore = new Map<string, number>();
  }
  return globalThis.__optaCliReplayStore;
}

function nowMs(): number {
  return Date.now();
}

function replayKey(kind: ReplayKind, nonce: string): string {
  return `${kind}:${nonce}`;
}

function isTruthyEnvFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function requireDurableReplayStore(): boolean {
  if (isTruthyEnvFlag(process.env['OPTA_CLI_REQUIRE_DURABLE_REPLAY'])) return true;
  return process.env['NODE_ENV'] === 'production';
}

function resolveDurableReplayPruneIntervalMs(): number {
  const raw = process.env['OPTA_CLI_REPLAY_PRUNE_INTERVAL_MS'];
  if (!raw) return DEFAULT_DURABLE_REPLAY_PRUNE_INTERVAL_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 10_000) {
    return DEFAULT_DURABLE_REPLAY_PRUNE_INTERVAL_MS;
  }
  return parsed;
}

function getSupabaseClient(): SupabaseClient | null {
  if (globalThis.__optaCliReplaySupabase !== undefined) {
    return globalThis.__optaCliReplaySupabase;
  }

  const url = process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    globalThis.__optaCliReplaySupabase = null;
    return null;
  }

  globalThis.__optaCliReplaySupabase = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return globalThis.__optaCliReplaySupabase;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === '23505';
}

function isMissingRelation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === '42P01') return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.toLowerCase().includes('relation') && message.includes(CLI_REPLAY_TABLE);
}

function sweepInMemoryReplayStore(current: number): void {
  const store = replayStore();
  for (const [key, expiresAt] of store.entries()) {
    if (expiresAt <= current) {
      store.delete(key);
    }
  }
  if (store.size <= CLI_REPLAY_MAX_ENTRIES) return;
  const ordered = Array.from(store.entries()).sort((a, b) => a[1] - b[1]);
  const deleteCount = store.size - CLI_REPLAY_MAX_ENTRIES;
  for (let index = 0; index < deleteCount; index += 1) {
    const entry = ordered[index];
    if (!entry) continue;
    store.delete(entry[0]);
  }
}

function markConsumedInMemory(kind: ReplayKind, nonce: string, expiresAtMs: number): boolean {
  const current = nowMs();
  sweepInMemoryReplayStore(current);

  const key = replayKey(kind, nonce);
  const store = replayStore();
  const existing = store.get(key);
  if (existing && existing > current) {
    return false;
  }
  store.set(key, expiresAtMs);
  return true;
}

async function maybePruneExpiredDurableReplayRows(supabase: SupabaseClient): Promise<void> {
  const current = nowMs();
  if (
    typeof globalThis.__optaCliReplayNextPruneAtMs === 'number' &&
    globalThis.__optaCliReplayNextPruneAtMs > current
  ) {
    return;
  }
  const intervalMs = resolveDurableReplayPruneIntervalMs();
  globalThis.__optaCliReplayNextPruneAtMs = current + intervalMs;
  await supabase
    .from(CLI_REPLAY_TABLE)
    .delete()
    .lt('expires_at', new Date(current).toISOString());
}

export async function markCliReplayNonceConsumed(input: {
  kind: ReplayKind;
  nonce: string;
  expiresAtMs: number;
}): Promise<boolean> {
  const supabase = getSupabaseClient();
  const strictDurable = requireDurableReplayStore();

  if (supabase) {
    try {
      const { error } = await supabase.from(CLI_REPLAY_TABLE).insert({
        kind: input.kind,
        nonce: input.nonce,
        expires_at: new Date(input.expiresAtMs).toISOString(),
      });
      if (!error) {
        void maybePruneExpiredDurableReplayRows(supabase).catch(() => {});
        return true;
      }
      if (isUniqueViolation(error)) return false;
      if (strictDurable || !isMissingRelation(error)) {
        throw new Error(`Durable replay store insert failed: ${String((error as { message?: unknown }).message ?? error)}`);
      }
      // Missing table in non-strict mode: fall through to memory fallback.
    } catch (error) {
      if (strictDurable) {
        throw error instanceof Error
          ? error
          : new Error(`Durable replay store error: ${String(error)}`);
      }
    }
  } else if (strictDurable) {
    throw new Error(
      'Durable replay store is required but Supabase service credentials are not configured.',
    );
  }

  return markConsumedInMemory(input.kind, input.nonce, input.expiresAtMs);
}
