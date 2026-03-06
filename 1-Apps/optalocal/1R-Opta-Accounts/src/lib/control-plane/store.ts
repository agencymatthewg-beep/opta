import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BridgeTokenClaims,
  DeviceCommandRecord,
  DeviceCommandRequest,
  DeviceCommandResult,
  PairingSession,
} from '@/lib/control-plane/types';

type ControlPlaneStore = {
  pairingSessions: Map<string, PairingSession>;
  bridgeTokens: Map<string, BridgeTokenClaims & { tokenHash: string }>;
  commands: Map<string, DeviceCommandRecord>;
  idempotencyByUser: Map<string, Map<string, string>>;
};

type ControlPlaneSupabase = SupabaseClient;
type StoreOptions = { supabase?: ControlPlaneSupabase | null };

type PairingSessionRow = {
  id: string;
  user_id: string;
  code: string;
  status: PairingSession['status'];
  device_id: string | null;
  device_label: string | null;
  capability_scopes: string[] | null;
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  bridge_token_id: string | null;
};

type BridgeTokenRow = {
  token_id: string;
  user_id: string;
  device_id: string;
  trust_state: string | null;
  scopes: string[] | null;
  issued_at: string;
  expires_at: string;
  status: BridgeTokenClaims['status'];
  token_hash: string;
};

type DeviceCommandRow = {
  id: string;
  user_id: string;
  device_id: string;
  command: string;
  payload: unknown;
  scope: string | null;
  idempotency_key: string | null;
  status: DeviceCommandRecord['status'];
  created_at: string;
  delivered_at: string | null;
  completed_at: string | null;
  result_hash: string | null;
  result: unknown;
  error: string | null;
};

declare global {
  var __OPTA_ACCOUNTS_CONTROL_PLANE_STORE__: ControlPlaneStore | undefined;
  var __OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__: ControlPlaneSupabase | null | undefined;
}

function getStore(): ControlPlaneStore {
  if (!globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_STORE__) {
    globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_STORE__ = {
      pairingSessions: new Map<string, PairingSession>(),
      bridgeTokens: new Map<string, BridgeTokenClaims & { tokenHash: string }>(),
      commands: new Map<string, DeviceCommandRecord>(),
      idempotencyByUser: new Map<string, Map<string, string>>(),
    };
  }
  return globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_STORE__;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapPairingSessionRow(row: PairingSessionRow): PairingSession {
  return {
    id: row.id,
    userId: row.user_id,
    code: row.code,
    status: row.status,
    deviceId: row.device_id,
    deviceLabel: row.device_label,
    capabilityScopes: parseStringArray(row.capability_scopes),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at,
    bridgeTokenId: row.bridge_token_id,
  };
}

function toPairingSessionRow(session: PairingSession): PairingSessionRow {
  return {
    id: session.id,
    user_id: session.userId,
    code: session.code,
    status: session.status,
    device_id: session.deviceId,
    device_label: session.deviceLabel,
    capability_scopes: session.capabilityScopes,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
    claimed_at: session.claimedAt,
    bridge_token_id: session.bridgeTokenId,
  };
}

function mapBridgeTokenRow(row: BridgeTokenRow): BridgeTokenClaims & { tokenHash: string } {
  return {
    tokenId: row.token_id,
    userId: row.user_id,
    deviceId: row.device_id,
    trustState: row.trust_state,
    scopes: parseStringArray(row.scopes),
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status: row.status,
    tokenHash: row.token_hash,
  };
}

function toBridgeTokenRow(record: BridgeTokenClaims & { tokenHash: string }): BridgeTokenRow {
  return {
    token_id: record.tokenId,
    user_id: record.userId,
    device_id: record.deviceId,
    trust_state: record.trustState,
    scopes: record.scopes,
    issued_at: record.issuedAt,
    expires_at: record.expiresAt,
    status: record.status,
    token_hash: record.tokenHash,
  };
}

function toBridgeClaims(record: BridgeTokenClaims & { tokenHash: string }): BridgeTokenClaims {
  return {
    tokenId: record.tokenId,
    userId: record.userId,
    deviceId: record.deviceId,
    trustState: record.trustState,
    scopes: record.scopes,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    status: record.status,
  };
}

function mapDeviceCommandRow(row: DeviceCommandRow): DeviceCommandRecord {
  return {
    id: row.id,
    userId: row.user_id,
    deviceId: row.device_id,
    command: row.command,
    payload: parseJsonObject(row.payload),
    scope: row.scope,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    completedAt: row.completed_at,
    resultHash: row.result_hash,
    result: row.result ? parseJsonObject(row.result) : null,
    error: row.error,
  };
}

function toDeviceCommandRow(record: DeviceCommandRecord): DeviceCommandRow {
  return {
    id: record.id,
    user_id: record.userId,
    device_id: record.deviceId,
    command: record.command,
    payload: record.payload,
    scope: record.scope,
    idempotency_key: record.idempotencyKey,
    status: record.status,
    created_at: record.createdAt,
    delivered_at: record.deliveredAt,
    completed_at: record.completedAt,
    result_hash: record.resultHash,
    result: record.result,
    error: record.error,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return code === '23505';
}

function getSupabaseClient(options?: StoreOptions): ControlPlaneSupabase | null {
  if (options && 'supabase' in options) {
    return options.supabase ?? null;
  }

  if (globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__ !== undefined) {
    return globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__ = null;
    return null;
  }

  globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__ = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return globalThis.__OPTA_ACCOUNTS_CONTROL_PLANE_SUPABASE__;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function generatePairingCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

function syncPairingSession(session: PairingSession): PairingSession {
  getStore().pairingSessions.set(session.id, session);
  return session;
}

function getPairingSessionInMemory(id: string): PairingSession | null {
  const store = getStore();
  const found = store.pairingSessions.get(id);
  if (!found) return null;
  if (found.status === 'pending' && new Date(found.expiresAt).getTime() <= Date.now()) {
    const expired = { ...found, status: 'expired' as const };
    store.pairingSessions.set(id, expired);
    return expired;
  }
  return found;
}

function claimPairingSessionInMemory(input: {
  id: string;
  userId: string;
  deviceId?: string | null;
  deviceLabel?: string | null;
  bridgeTokenId?: string | null;
}): PairingSession | null {
  const store = getStore();
  const found = getPairingSessionInMemory(input.id);
  if (!found) return null;
  if (found.userId !== input.userId) return null;
  if (found.status !== 'pending') return found;
  const next: PairingSession = {
    ...found,
    status: 'claimed',
    claimedAt: nowIso(),
    deviceId: input.deviceId ?? found.deviceId,
    deviceLabel: input.deviceLabel ?? found.deviceLabel,
    bridgeTokenId: input.bridgeTokenId ?? found.bridgeTokenId,
  };
  store.pairingSessions.set(input.id, next);
  return next;
}

function findBridgeTokenInMemoryByHash(tokenHash: string): (BridgeTokenClaims & { tokenHash: string }) | null {
  for (const record of getStore().bridgeTokens.values()) {
    if (record.tokenHash === tokenHash) return record;
  }
  return null;
}

function syncBridgeToken(record: BridgeTokenClaims & { tokenHash: string }) {
  getStore().bridgeTokens.set(record.tokenId, record);
}

function revokeBridgeTokenInMemory(tokenId: string): BridgeTokenClaims | null {
  const store = getStore();
  const record = store.bridgeTokens.get(tokenId);
  if (!record) return null;
  const next = { ...record, status: 'revoked' as const };
  store.bridgeTokens.set(tokenId, next);
  return toBridgeClaims(next);
}

function getIdempotencyStore(userId: string): Map<string, string> {
  const store = getStore();
  const scoped = store.idempotencyByUser.get(userId) ?? new Map<string, string>();
  store.idempotencyByUser.set(userId, scoped);
  return scoped;
}

function syncDeviceCommand(command: DeviceCommandRecord) {
  const store = getStore();
  store.commands.set(command.id, command);
  if (command.idempotencyKey) {
    getIdempotencyStore(command.userId).set(command.idempotencyKey, command.id);
  }
}

function createDeviceCommandInMemory(input: {
  userId: string;
  request: DeviceCommandRequest;
}): DeviceCommandRecord {
  const scoped = getIdempotencyStore(input.userId);
  if (input.request.idempotencyKey) {
    const existingId = scoped.get(input.request.idempotencyKey);
    if (existingId) {
      const existing = getStore().commands.get(existingId);
      if (existing) return existing;
    }
  }

  const command: DeviceCommandRecord = {
    id: randomUUID(),
    userId: input.userId,
    deviceId: input.request.deviceId,
    command: input.request.command,
    payload: input.request.payload,
    scope: input.request.scope,
    idempotencyKey: input.request.idempotencyKey,
    status: 'queued',
    createdAt: nowIso(),
    deliveredAt: null,
    completedAt: null,
    resultHash: null,
    result: null,
    error: null,
  };
  syncDeviceCommand(command);
  return command;
}

function listDeviceCommandsForDeliveryInMemory(input: {
  deviceId: string;
  limit?: number;
  since?: string;
}): DeviceCommandRecord[] {
  const store = getStore();
  const limit = clampNumber(input.limit ?? 20, 1, 100);
  const queued = [...store.commands.values()]
    .filter(
      (command) =>
        command.deviceId === input.deviceId &&
        command.status === 'queued' &&
        (input.since == null || command.createdAt > input.since),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);

  const deliveredAt = nowIso();
  for (const command of queued) {
    store.commands.set(command.id, {
      ...command,
      status: 'delivered',
      deliveredAt,
    });
  }

  return queued;
}

function storeDeviceCommandResultInMemory(input: {
  id: string;
  deviceId: string;
  result: DeviceCommandResult;
}): DeviceCommandRecord | null {
  const store = getStore();
  const existing = store.commands.get(input.id);
  if (!existing) return null;
  if (existing.deviceId !== input.deviceId) return null;
  const next: DeviceCommandRecord = {
    ...existing,
    status: input.result.status,
    completedAt: nowIso(),
    resultHash: input.result.resultHash ?? null,
    result: input.result.result ?? null,
    error: input.result.error ?? null,
  };
  store.commands.set(input.id, next);
  return next;
}

export async function createPairingSession(
  input: {
  userId: string;
  deviceId?: string | null;
  deviceLabel?: string | null;
  capabilityScopes?: string[];
  ttlSeconds?: number;
  },
  options?: StoreOptions,
): Promise<PairingSession> {
  const createdAt = new Date();
  const ttlSeconds = clampNumber(input.ttlSeconds ?? 300, 60, 900);
  const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
  const session: PairingSession = {
    id: randomUUID(),
    userId: input.userId,
    code: generatePairingCode(),
    status: 'pending',
    deviceId: input.deviceId ?? null,
    deviceLabel: input.deviceLabel ?? null,
    capabilityScopes: Array.isArray(input.capabilityScopes) ? input.capabilityScopes : [],
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    claimedAt: null,
    bridgeTokenId: null,
  };

  syncPairingSession(session);

  const supabase = getSupabaseClient(options);
  if (!supabase) return session;

  try {
    await supabase.from('accounts_pairing_sessions').insert(toPairingSessionRow(session));
  } catch {
    // Fallback remains in-memory.
  }

  return session;
}

export async function getPairingSession(
  id: string,
  options?: StoreOptions,
): Promise<PairingSession | null> {
  const supabase = getSupabaseClient(options);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts_pairing_sessions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped = syncPairingSession(mapPairingSessionRow(data as PairingSessionRow));
        if (mapped.status === 'pending' && new Date(mapped.expiresAt).getTime() <= Date.now()) {
          const expired: PairingSession = { ...mapped, status: 'expired' };
          syncPairingSession(expired);
          try {
            await supabase
              .from('accounts_pairing_sessions')
              .update({ status: 'expired' })
              .eq('id', id)
              .eq('status', 'pending');
          } catch {
            // Fallback already updated in-memory.
          }
          return expired;
        }
        return mapped;
      }

      if (!error && !data) {
        return getPairingSessionInMemory(id);
      }
    } catch {
      // Fallback to in-memory below.
    }
  }

  return getPairingSessionInMemory(id);
}

export async function claimPairingSession(
  input: {
    id: string;
    userId: string;
    deviceId?: string | null;
    deviceLabel?: string | null;
    bridgeTokenId?: string | null;
  },
  options?: StoreOptions,
): Promise<PairingSession | null> {
  const found = await getPairingSession(input.id, options);
  if (!found) return null;
  if (found.userId !== input.userId) return null;
  if (found.status !== 'pending') return found;

  const next: PairingSession = {
    ...found,
    status: 'claimed',
    claimedAt: nowIso(),
    deviceId: input.deviceId ?? found.deviceId,
    deviceLabel: input.deviceLabel ?? found.deviceLabel,
    bridgeTokenId: input.bridgeTokenId ?? found.bridgeTokenId,
  };

  syncPairingSession(next);

  const supabase = getSupabaseClient(options);
  if (supabase) {
    try {
      const { error } = await supabase
        .from('accounts_pairing_sessions')
        .update({
          status: next.status,
          claimed_at: next.claimedAt,
          device_id: next.deviceId,
          device_label: next.deviceLabel,
          bridge_token_id: next.bridgeTokenId,
        })
        .eq('id', input.id)
        .eq('user_id', input.userId);

      if (error) {
        return claimPairingSessionInMemory(input);
      }
    } catch {
      return claimPairingSessionInMemory(input);
    }
  }

  return next;
}

export async function createBridgeToken(
  input: {
    userId: string;
    deviceId: string;
    trustState?: string | null;
    scopes: string[];
    ttlSeconds?: number;
  },
  options?: StoreOptions,
): Promise<{ token: string; claims: BridgeTokenClaims }> {
  const issuedAt = new Date();
  const ttlSeconds = clampNumber(input.ttlSeconds ?? 1800, 60, 86_400);
  const expiresAt = new Date(issuedAt.getTime() + ttlSeconds * 1000);
  const tokenValue = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(tokenValue).digest('hex');
  const claims: BridgeTokenClaims = {
    tokenId: randomUUID(),
    userId: input.userId,
    deviceId: input.deviceId,
    trustState: input.trustState ?? null,
    scopes: input.scopes,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'active',
  };

  const record = { ...claims, tokenHash };
  syncBridgeToken(record);

  const supabase = getSupabaseClient(options);
  if (supabase) {
    try {
      await supabase.from('accounts_bridge_tokens').insert(toBridgeTokenRow(record));
    } catch {
      // Fallback remains in-memory.
    }
  }

  return { token: tokenValue, claims };
}

export async function revokeBridgeToken(
  tokenId: string,
  options?: StoreOptions,
): Promise<BridgeTokenClaims | null> {
  const supabase = getSupabaseClient(options);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts_bridge_tokens')
        .update({ status: 'revoked' })
        .eq('token_id', tokenId)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        const next = mapBridgeTokenRow(data as BridgeTokenRow);
        syncBridgeToken(next);
        return toBridgeClaims(next);
      }
      if (!error && !data) {
        return revokeBridgeTokenInMemory(tokenId);
      }
    } catch {
      return revokeBridgeTokenInMemory(tokenId);
    }
  }

  return revokeBridgeTokenInMemory(tokenId);
}

export async function resolveBridgeTokenClaimsFromSecret(
  token: string,
  options?: StoreOptions,
): Promise<BridgeTokenClaims | null> {
  if (!token || token.trim().length === 0) return null;
  const tokenHash = createHash('sha256').update(token.trim()).digest('hex');

  let record: (BridgeTokenClaims & { tokenHash: string }) | null = null;
  const supabase = getSupabaseClient(options);

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts_bridge_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (!error && data) {
        record = mapBridgeTokenRow(data as BridgeTokenRow);
        syncBridgeToken(record);
      } else if (!error && !data) {
        record = findBridgeTokenInMemoryByHash(tokenHash);
      } else {
        record = findBridgeTokenInMemoryByHash(tokenHash);
      }
    } catch {
      record = findBridgeTokenInMemoryByHash(tokenHash);
    }
  } else {
    record = findBridgeTokenInMemoryByHash(tokenHash);
  }

  if (!record) return null;
  if (record.status !== 'active') return null;

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    const expired = { ...record, status: 'expired' as const };
    syncBridgeToken(expired);

    if (supabase) {
      try {
        await supabase
          .from('accounts_bridge_tokens')
          .update({ status: 'expired' })
          .eq('token_id', expired.tokenId)
          .eq('status', 'active');
      } catch {
        // Fallback already updated in-memory.
      }
    }

    return null;
  }

  return toBridgeClaims(record);
}

export async function createDeviceCommand(
  input: {
    userId: string;
    request: DeviceCommandRequest;
  },
  options?: StoreOptions,
): Promise<DeviceCommandRecord> {
  if (input.request.idempotencyKey) {
    const localId = getIdempotencyStore(input.userId).get(input.request.idempotencyKey);
    if (localId) {
      const local = getStore().commands.get(localId);
      if (local) return local;
    }
  }

  const supabase = getSupabaseClient(options);
  if (supabase && input.request.idempotencyKey) {
    try {
      const { data, error } = await supabase
        .from('accounts_device_commands')
        .select('*')
        .eq('user_id', input.userId)
        .eq('idempotency_key', input.request.idempotencyKey)
        .maybeSingle();

      if (!error && data) {
        const existing = mapDeviceCommandRow(data as DeviceCommandRow);
        syncDeviceCommand(existing);
        return existing;
      }
    } catch {
      // Continue and fallback below.
    }
  }

  const command: DeviceCommandRecord = {
    id: randomUUID(),
    userId: input.userId,
    deviceId: input.request.deviceId,
    command: input.request.command,
    payload: input.request.payload,
    scope: input.request.scope,
    idempotencyKey: input.request.idempotencyKey,
    status: 'queued',
    createdAt: nowIso(),
    deliveredAt: null,
    completedAt: null,
    resultHash: null,
    result: null,
    error: null,
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('accounts_device_commands').insert(toDeviceCommandRow(command));

      if (!error) {
        syncDeviceCommand(command);
        return command;
      }

      if (isUniqueViolation(error) && command.idempotencyKey) {
        const { data: existing } = await supabase
          .from('accounts_device_commands')
          .select('*')
          .eq('user_id', input.userId)
          .eq('idempotency_key', command.idempotencyKey)
          .maybeSingle();

        if (existing) {
          const mapped = mapDeviceCommandRow(existing);
          syncDeviceCommand(mapped);
          return mapped;
        }
      }
    } catch {
      // Fallback to in-memory below.
    }
  }

  return createDeviceCommandInMemory(input);
}

export async function listDeviceCommandsForDelivery(
  input: {
    deviceId: string;
    limit?: number;
    /** ISO timestamp — only return commands created strictly after this time */
    since?: string;
  },
  options?: StoreOptions,
): Promise<DeviceCommandRecord[]> {
  const supabase = getSupabaseClient(options);
  const limit = clampNumber(input.limit ?? 20, 1, 100);

  if (supabase) {
    try {
      let query = supabase
        .from('accounts_device_commands')
        .select('*')
        .eq('device_id', input.deviceId)
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (input.since != null) {
        query = query.gt('created_at', input.since);
      }

      const { data, error } = await query;

      if (!error) {
        const queued = (data ?? []).map((row) => mapDeviceCommandRow(row as DeviceCommandRow));
        for (const command of queued) {
          syncDeviceCommand(command);
        }

        if (queued.length > 0) {
          const deliveredAt = nowIso();
          const ids = queued.map((command) => command.id);
          await supabase
            .from('accounts_device_commands')
            .update({ status: 'delivered', delivered_at: deliveredAt })
            .in('id', ids)
            .eq('status', 'queued');

          for (const command of queued) {
            syncDeviceCommand({ ...command, status: 'delivered', deliveredAt });
          }
        }

        return queued;
      }
    } catch {
      // Fallback to in-memory below.
    }
  }

  return listDeviceCommandsForDeliveryInMemory({ deviceId: input.deviceId, limit, since: input.since });
}

export async function getDeviceCommand(
  id: string,
  options?: StoreOptions,
): Promise<DeviceCommandRecord | null> {
  const supabase = getSupabaseClient(options);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts_device_commands')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped = mapDeviceCommandRow(data);
        syncDeviceCommand(mapped);
        return mapped;
      }

      if (!error && !data) {
        return getStore().commands.get(id) ?? null;
      }
    } catch {
      // Fallback to in-memory below.
    }
  }

  return getStore().commands.get(id) ?? null;
}

export async function storeDeviceCommandResult(
  input: {
    id: string;
    deviceId: string;
    result: DeviceCommandResult;
  },
  options?: StoreOptions,
): Promise<DeviceCommandRecord | null> {
  const existing = await getDeviceCommand(input.id, options);
  if (!existing) return null;
  if (existing.deviceId !== input.deviceId) return null;

  const next: DeviceCommandRecord = {
    ...existing,
    status: input.result.status,
    completedAt: nowIso(),
    resultHash: input.result.resultHash ?? null,
    result: input.result.result ?? null,
    error: input.result.error ?? null,
  };

  syncDeviceCommand(next);

  const supabase = getSupabaseClient(options);
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('accounts_device_commands')
        .update({
          status: next.status,
          completed_at: next.completedAt,
          result_hash: next.resultHash,
          result: next.result,
          error: next.error,
        })
        .eq('id', input.id)
        .eq('device_id', input.deviceId)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        const mapped = mapDeviceCommandRow(data);
        syncDeviceCommand(mapped);
        return mapped;
      }
    } catch {
      return storeDeviceCommandResultInMemory(input);
    }
  }

  return next;
}
