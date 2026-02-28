export interface ConnectionSettings {
  host: string;
  port: number;
  adminKey: string;
  useTunnel: boolean;
  tunnelUrl: string;
}

export const CONNECTION_SETTINGS_STORAGE_KEY = 'opta-local:connection-settings';
export const CONNECTION_SETTINGS_UPDATED_EVENT = 'opta-local:connection-settings-updated';

export const DEFAULT_SETTINGS: ConnectionSettings = {
  host: '127.0.0.1',
  port: 1234,
  adminKey: '',
  useTunnel: false,
  tunnelUrl: '',
};

function normalizeSettings(input: Partial<ConnectionSettings> | null): ConnectionSettings {
  if (!input) return DEFAULT_SETTINGS;

  const nextPort = Number(input.port);

  return {
    host: input.host?.trim() || DEFAULT_SETTINGS.host,
    port: Number.isFinite(nextPort) && nextPort > 0 ? nextPort : DEFAULT_SETTINGS.port,
    adminKey: input.adminKey ?? DEFAULT_SETTINGS.adminKey,
    useTunnel: Boolean(input.useTunnel),
    tunnelUrl: input.tunnelUrl?.trim() ?? DEFAULT_SETTINGS.tunnelUrl,
  };
}

export async function getConnectionSettings(): Promise<ConnectionSettings> {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  const raw = window.localStorage.getItem(CONNECTION_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<ConnectionSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveConnectionSettings(
  settings: Partial<ConnectionSettings>,
): Promise<ConnectionSettings> {
  const normalized = normalizeSettings(settings);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      CONNECTION_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    );
    window.dispatchEvent(new Event(CONNECTION_SETTINGS_UPDATED_EVENT));
  }

  return normalized;
}
