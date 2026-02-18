/**
 * Connection settings management for Opta LMX server.
 *
 * Stores host/port/tunnel in plain localStorage and admin key encrypted
 * via Web Crypto API (storage.ts). Provides a factory to create a
 * configured LMXClient instance.
 */

import { LMXClient } from '@/lib/lmx-client';
import { getSecure, setSecure, removeSecure } from '@/lib/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectionSettings {
  host: string;
  port: number;
  adminKey: string;
  useTunnel: boolean;
  tunnelUrl: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: ConnectionSettings = {
  host: '192.168.188.11',
  port: 1234,
  adminKey: '',
  useTunnel: false,
  tunnelUrl: '',
};

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
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/** Build the base URL from connection settings. */
export function getBaseUrl(settings: ConnectionSettings): string {
  if (settings.useTunnel && settings.tunnelUrl) {
    // Tunnel URL is used as-is (includes protocol)
    return settings.tunnelUrl.replace(/\/+$/, '');
  }
  return `http://${settings.host}:${settings.port}`;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a configured LMXClient from connection settings. */
export function createClient(settings: ConnectionSettings): LMXClient {
  return new LMXClient(getBaseUrl(settings), settings.adminKey);
}
