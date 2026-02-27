/**
 * Daemon handshake — zero-config LMX server discovery.
 *
 * Probes the Opta CLI daemon at localhost:9999/v3/config to auto-discover
 * the LMX host, port, admin key, and tunnel URL. The daemon is only
 * reachable when the user is on the same machine (127.0.0.1 bound).
 *
 * Called only when Supabase has no saved settings for the user.
 * Uses a 50ms timeout — if the daemon isn't running, fail fast.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DaemonConfig {
  lmx_host: string;
  lmx_port: number;
  admin_key: string;
  tunnel_url: string;
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

const DAEMON_URL = 'http://127.0.0.1:9999/v3/config';
const DAEMON_TIMEOUT_MS = 50;

/**
 * Fetch LMX configuration from the local Opta daemon.
 * Returns null if the daemon is unreachable or responds with an error.
 */
export async function fetchDaemonConfig(): Promise<DaemonConfig | null> {
  try {
    const response = await fetch(DAEMON_URL, {
      signal: AbortSignal.timeout(DAEMON_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();

    if (
      typeof data === 'object' &&
      data !== null &&
      'lmx_host' in data &&
      'lmx_port' in data
    ) {
      return data as DaemonConfig;
    }

    return null;
  } catch {
    // Timeout, network error, or JSON parse error — daemon not available
    return null;
  }
}
