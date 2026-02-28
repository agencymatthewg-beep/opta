/**
 * Settings cloud sync — writes connection settings to the Supabase `devices`
 * table and hydrates them on first load for new devices.
 *
 * adminKey is intentionally excluded: it is device-specific and must never
 * leave the local encrypted store.
 *
 * Sync flow:
 *  1. On first save: generate a stable deviceId UUID, upsert row in `devices`.
 *  2. On subsequent saves: upsert (update in-place) using the stored deviceId.
 *  3. On fresh-device sign-in: hydrate host/port/tunnelUrl from cloud.
 *
 * A `opta-local:cloud-registered` flag prevents cloud from overwriting
 * settings that the user has deliberately saved on this device.
 */

import { createClient } from '@/lib/supabase/client';
import {
  type ConnectionSettings,
  getConnectionSettings,
  saveConnectionSettings,
} from '@/lib/connection';

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const DEVICE_ID_KEY = 'opta-local:device-id';
/** Set after the first successful cloud sync — prevents hydration overwriting local settings. */
const DEVICE_REGISTERED_KEY = 'opta-local:cloud-registered';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the stable device UUID, generating and persisting one if absent. */
function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Sync: local → cloud
// ---------------------------------------------------------------------------

/**
 * Upsert this device's connection settings to the `devices` table.
 * No-ops silently if Supabase is not configured or the user is not signed in.
 * adminKey is never included.
 */
export async function syncSettingsToCloud(
  settings: ConnectionSettings,
): Promise<void> {
  const supabase = createClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const deviceId = getOrCreateDeviceId();

  const { error } = await supabase.from('devices').upsert(
    {
      id: deviceId,
      user_id: user.id,
      name: 'Opta Local',
      role: 'workstation' as const,
      lan_ip: settings.host,
      lan_port: settings.port,
      tunnel_url: settings.tunnelUrl || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (!error) {
    localStorage.setItem(DEVICE_REGISTERED_KEY, 'true');
  }
}

// ---------------------------------------------------------------------------
// Hydrate: cloud → local (first-visit only)
// ---------------------------------------------------------------------------

/**
 * On a fresh device (no cloud-registered flag), pulls connection settings
 * from the user's most recent workstation device in Supabase and writes them
 * to localStorage.
 *
 * Does nothing if:
 *  - Supabase is not configured
 *  - User is not signed in
 *  - This device has already synced settings (opta-local:cloud-registered = 'true')
 *  - No workstation device found in cloud
 */
export async function tryHydrateSettingsFromCloud(): Promise<void> {
  // Already synced on this device — don't overwrite local settings with cloud
  if (localStorage.getItem(DEVICE_REGISTERED_KEY) === 'true') return;

  const supabase = createClient();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Try the stored deviceId first for exact-device restore
  const storedId = localStorage.getItem(DEVICE_ID_KEY);
  let lan_ip: string | null = null;
  let lan_port: number | null = null;
  let tunnel_url: string | null = null;

  if (storedId) {
    const { data } = await supabase
      .from('devices')
      .select('lan_ip, lan_port, tunnel_url')
      .eq('id', storedId)
      .single();

    if (data) {
      lan_ip = data.lan_ip;
      lan_port = data.lan_port;
      tunnel_url = data.tunnel_url;
    }
  }

  // Fall back to most-recently-seen workstation for this user
  if (!lan_ip) {
    const { data } = await supabase
      .from('devices')
      .select('lan_ip, lan_port, tunnel_url')
      .eq('user_id', user.id)
      .eq('role', 'workstation')
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      lan_ip = data.lan_ip;
      lan_port = data.lan_port;
      tunnel_url = data.tunnel_url;
    }
  }

  if (!lan_ip) return; // Nothing in cloud

  // Merge cloud values into existing settings (preserves adminKey, useTunnel)
  const current = await getConnectionSettings();
  await saveConnectionSettings({
    ...current,
    host: lan_ip,
    port: lan_port ?? current.port,
    tunnelUrl: tunnel_url ?? current.tunnelUrl,
  });

  // Mark as registered so next load uses local values
  localStorage.setItem(DEVICE_REGISTERED_KEY, 'true');
}
