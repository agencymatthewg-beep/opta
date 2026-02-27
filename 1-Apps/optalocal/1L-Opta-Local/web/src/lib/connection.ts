/**
 * Connection settings management for Opta LMX server.
 *
 * Stores host/port/tunnel in plain localStorage and admin key encrypted
 * via Web Crypto API (storage.ts). Provides a factory to create a
 * configured LMXClient instance. Includes LAN health check with timeout
 * and optimal URL resolution for LAN/WAN/offline detection.
 */

import { LMXClient } from '@/lib/lmx-client';
import { getSecure, setSecure, removeSecure } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Connection transport type: LAN (direct), WAN (tunnel), or offline */
export type ConnectionType = 'lan' | 'wan' | 'offline';

/** Result of an optimal URL probe */
export interface ConnectionProbeResult {
  url: string;
  type: ConnectionType;
  latencyMs: number;
}

export interface ConnectionSettings {
  host: string;
  port: number;
  adminKey: string;
  useTunnel: boolean;
  tunnelUrl: string;
}

/** Broadcast when connection settings change so providers can refresh state. */
export const CONNECTION_SETTINGS_UPDATED_EVENT =
  'opta-local:connection-settings-updated';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS = Object.freeze({
  host: '192.168.188.11',
  port: 1234,
  adminKey: '',
  useTunnel: false,
  tunnelUrl: process.env.NEXT_PUBLIC_DEFAULT_LMX_TUNNEL_URL ?? '',
} satisfies ConnectionSettings);

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const STORAGE_KEY_HOST = 'opta-local:host';
const STORAGE_KEY_PORT = 'opta-local:port';
const STORAGE_KEY_USE_TUNNEL = 'opta-local:useTunnel';
const STORAGE_KEY_TUNNEL_URL = 'opta-local:tunnelUrl';
const STORAGE_KEY_ADMIN_KEY = 'opta-local:adminKey'; // encrypted

// ---------------------------------------------------------------------------
// Read / Write
// ---------------------------------------------------------------------------

/** Read connection settings from storage. Admin key is decrypted. */
export async function getConnectionSettings(): Promise<ConnectionSettings> {
  const host = localStorage.getItem(STORAGE_KEY_HOST) ?? DEFAULT_SETTINGS.host;
  const portStr = localStorage.getItem(STORAGE_KEY_PORT);
  const port = portStr ? Number(portStr) : DEFAULT_SETTINGS.port;
  const useTunnel =
    localStorage.getItem(STORAGE_KEY_USE_TUNNEL) === 'true'
      ? true
      : DEFAULT_SETTINGS.useTunnel;
  const tunnelUrl =
    localStorage.getItem(STORAGE_KEY_TUNNEL_URL) ?? DEFAULT_SETTINGS.tunnelUrl;

  // Admin key is stored encrypted
  const adminKey =
    (await getSecure(STORAGE_KEY_ADMIN_KEY)) ?? DEFAULT_SETTINGS.adminKey;

  return { host, port, adminKey, useTunnel, tunnelUrl };
}

/** Save connection settings. Admin key is encrypted before storage. */
export async function saveConnectionSettings(
  settings: ConnectionSettings,
): Promise<void> {
  localStorage.setItem(STORAGE_KEY_HOST, settings.host);
  localStorage.setItem(STORAGE_KEY_PORT, String(settings.port));
  localStorage.setItem(STORAGE_KEY_USE_TUNNEL, String(settings.useTunnel));
  localStorage.setItem(STORAGE_KEY_TUNNEL_URL, settings.tunnelUrl);

  // Encrypt admin key before storing
  if (settings.adminKey) {
    await setSecure(STORAGE_KEY_ADMIN_KEY, settings.adminKey);
  } else {
    removeSecure(STORAGE_KEY_ADMIN_KEY);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CONNECTION_SETTINGS_UPDATED_EVENT));
  }
}

// ---------------------------------------------------------------------------
// Health check constants
// ---------------------------------------------------------------------------

/** LAN health check timeout — LAN should respond in <100ms; 1.5s accommodates slow WiFi */
const LAN_TIMEOUT_MS = 1500;

/** WAN health check timeout — tunnel adds ~50-200ms latency */
const WAN_TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Check whether the LMX server is reachable at the given LAN URL.
 * Uses AbortSignal.timeout for a clean 1.5s cutoff. Probes /v1/models
 * as a lightweight endpoint that does not require an admin key.
 */
export async function checkLanHealth(lanUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${lanUrl}/v1/models`, {
      signal: AbortSignal.timeout(LAN_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    // Timeout, network error, or AbortError — LAN unreachable
    return false;
  }
}

/**
 * Check whether the LMX server is reachable at a given URL within a timeout.
 * Returns latency in milliseconds if reachable, or null if not.
 */
async function probeUrl(
  url: string,
  timeoutMs: number,
  adminKey?: string,
): Promise<number | null> {
  try {
    const headers: Record<string, string> = {};
    if (adminKey) {
      headers['X-Admin-Key'] = adminKey;
    }
    const start = performance.now();
    const response = await fetch(`${url}/v1/models`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers,
    });
    if (response.ok) {
      return Math.round(performance.now() - start);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if LAN mode is available given current page protocol.
 * HTTPS pages cannot fetch HTTP resources (mixed content blocking).
 */
export function isLanAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'http:';
}

// ---------------------------------------------------------------------------
// Optimal URL resolution
// ---------------------------------------------------------------------------

/**
 * Probe LAN first (fast timeout), then tunnel if configured.
 * Returns the best reachable URL with its connection type and latency,
 * or null if nothing is reachable.
 */
export async function getOptimalBaseUrl(
  settings: ConnectionSettings,
): Promise<ConnectionProbeResult | null> {
  const lanUrl = `http://${settings.host}:${settings.port}`;

  // Try LAN first (only if protocol allows it — HTTPS blocks HTTP fetches)
  if (isLanAvailable()) {
    const lanLatency = await probeUrl(lanUrl, LAN_TIMEOUT_MS, settings.adminKey);
    if (lanLatency !== null) {
      return { url: lanUrl, type: 'lan', latencyMs: lanLatency };
    }
  }

  // Try WAN (tunnel) if configured
  if (settings.useTunnel && settings.tunnelUrl) {
    const tunnelUrl = settings.tunnelUrl.replace(/\/+$/, '');
    const wanLatency = await probeUrl(tunnelUrl, WAN_TIMEOUT_MS, settings.adminKey);
    if (wanLatency !== null) {
      return { url: tunnelUrl, type: 'wan', latencyMs: wanLatency };
    }
  }

  // Nothing reachable
  return null;
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/** Build the base URL from connection settings (static, no probing). */
export function getBaseUrl(settings: ConnectionSettings): string {
  if (settings.useTunnel && settings.tunnelUrl) {
    // Tunnel URL is used as-is (includes protocol)
    return settings.tunnelUrl.replace(/\/+$/, '');
  }
  return `http://${settings.host}:${settings.port}`;
}

/**
 * Get the active URL based on live connection state.
 * Use this instead of getBaseUrl when you have connection mode info.
 */
export function getActiveUrl(
  settings: ConnectionSettings,
  connectionType: ConnectionType,
): string {
  if (connectionType === 'wan' && settings.tunnelUrl) {
    return settings.tunnelUrl.replace(/\/+$/, '');
  }
  // LAN, probing, or offline — use LAN URL as default
  return `http://${settings.host}:${settings.port}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a configured LMXClient from connection settings. */
export function createClient(settings: ConnectionSettings): LMXClient {
  return new LMXClient(getBaseUrl(settings), settings.adminKey);
}

/** Create a configured LMXClient using a specific base URL. */
export function createClientWithUrl(
  baseUrl: string,
  adminKey: string,
): LMXClient {
  return new LMXClient(baseUrl, adminKey);
}
