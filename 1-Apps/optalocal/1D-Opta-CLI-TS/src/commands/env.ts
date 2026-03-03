import chalk from 'chalk';
import { getConfigStore, loadConfig, saveConfig } from '../core/config.js';
import type { OptaConfig } from '../core/config.js';
import { EXIT, ExitError } from '../core/errors.js';
import { parseAdminKeysByHost } from '../lmx/admin-keys.js';
import { lookupContextLimit } from '../lmx/client.js';
import { normalizeConfiguredModelId } from '../lmx/model-lifecycle.js';

interface EnvCommandOptions {
  json?: boolean;
  host?: string;
  port?: string;
  adminKey?: string;
  adminKeysByHost?: string;
  model?: string;
  provider?: string;
  mode?: string;
}
type ProviderName = OptaConfig['provider']['active'];
type DefaultMode = OptaConfig['defaultMode'];

export interface EnvProfile {
  name: string;
  connection: {
    host: string;
    port: number;
    adminKey?: string;
    apiKey?: string;
    adminKeysByHost?: Record<string, string>;
    protocol?: 'http';
  };
  modelDefault: string;
  provider: ProviderName;
  defaultMode: DefaultMode;
  updatedAt: number;
}

const ENV_PROFILES_KEY = 'profiles.environments';
const ENV_CURRENT_KEY = 'profiles.activeEnvironment';
const VALID_PROVIDERS = new Set<ProviderName>(['lmx', 'anthropic', 'gemini', 'openai', 'opencode_zen']);
const VALID_MODES = new Set<DefaultMode>([
  'safe',
  'auto',
  'plan',
  'review',
  'research',
  'dangerous',
  'ci',
]);

function parsePort(value: string | undefined, fallback: number): number {
  if (!value || !value.trim()) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    console.error(chalk.red('✗') + ` Invalid port: ${value}`);
    throw new ExitError(EXIT.MISUSE);
  }
  return parsed;
}

function parseProvider(value: string | undefined, fallback: ProviderName): ProviderName {
  if (!value || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase() as ProviderName;
  if (!VALID_PROVIDERS.has(normalized)) {
    console.error(chalk.red('✗') + ` Invalid provider: ${value}`);
    throw new ExitError(EXIT.MISUSE);
  }
  return normalized;
}

function parseMode(value: string | undefined, fallback: DefaultMode): DefaultMode {
  if (!value || !value.trim()) return fallback;
  const normalized = value.trim().toLowerCase() as DefaultMode;
  if (!VALID_MODES.has(normalized)) {
    console.error(chalk.red('✗') + ` Invalid mode: ${value}`);
    throw new ExitError(EXIT.MISUSE);
  }
  return normalized;
}

function sanitizeAdminKeysByHostMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const normalized: Record<string, string> = {};
  for (const [hostKey, keyValue] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof keyValue !== 'string') continue;
    const host = hostKey.trim();
    const key = keyValue.trim();
    if (!host || !key) continue;
    normalized[host] = key;
  }
  return normalized;
}

export function normalizeEnvProfileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

function sanitizeProfiles(raw: unknown): Record<string, EnvProfile> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const out: Record<string, EnvProfile> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const obj = value as Record<string, unknown>;
    const host =
      typeof obj.connection === 'object' && obj.connection !== null
        ? (obj.connection as Record<string, unknown>).host
        : undefined;
    const port =
      typeof obj.connection === 'object' && obj.connection !== null
        ? (obj.connection as Record<string, unknown>).port
        : undefined;
    const adminKey =
      typeof obj.connection === 'object' && obj.connection !== null
        ? (obj.connection as Record<string, unknown>).adminKey
        : undefined;
    const apiKey =
      typeof obj.connection === 'object' && obj.connection !== null
        ? (obj.connection as Record<string, unknown>).apiKey
        : undefined;
    const adminKeysByHost =
      typeof obj.connection === 'object' && obj.connection !== null
        ? (obj.connection as Record<string, unknown>).adminKeysByHost
        : undefined;
    const modelDefault = obj.modelDefault;
    const providerRaw = obj.provider;
    const defaultMode = obj.defaultMode;
    const updatedAt = obj.updatedAt;

    if (typeof host !== 'string' || !host.trim()) continue;
    if (typeof port !== 'number' || !Number.isFinite(port)) continue;
    if (typeof modelDefault !== 'string') continue;
    if (typeof providerRaw !== 'string' || !VALID_PROVIDERS.has(providerRaw as ProviderName)) continue;
    if (typeof defaultMode !== 'string' || !VALID_MODES.has(defaultMode as DefaultMode)) continue;
    const provider = providerRaw as ProviderName;

    const normalized = normalizeEnvProfileName(typeof obj.name === 'string' ? obj.name : key);
    if (!normalized) continue;

    const normalizedModelDefault = normalizeConfiguredModelId(modelDefault);
    out[normalized] = {
      name: normalized,
      connection: {
        host: host.trim(),
        port: Math.max(1, Math.floor(port)),
        ...(typeof adminKey === 'string' && adminKey.length > 0 ? { adminKey } : {}),
        ...(typeof apiKey === 'string' && apiKey.length > 0 ? { apiKey } : {}),
        ...(() => {
          const hostKeyMap = sanitizeAdminKeysByHostMap(adminKeysByHost);
          return Object.keys(hostKeyMap).length > 0 ? { adminKeysByHost: hostKeyMap } : {};
        })(),
      },
      modelDefault: normalizedModelDefault,
      provider,
      defaultMode: defaultMode as DefaultMode,
      updatedAt:
        typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : Date.now(),
    };
  }

  return out;
}

async function readProfiles(): Promise<Record<string, EnvProfile>> {
  const store = await getConfigStore();
  return sanitizeProfiles(store.get(ENV_PROFILES_KEY));
}

async function writeProfiles(profiles: Record<string, EnvProfile>): Promise<void> {
  const store = await getConfigStore();
  store.set(ENV_PROFILES_KEY, profiles);
}

async function getCurrentProfileName(): Promise<string | undefined> {
  const store = await getConfigStore();
  const raw = store.get(ENV_CURRENT_KEY);
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return normalizeEnvProfileName(raw);
}

async function setCurrentProfileName(name: string): Promise<void> {
  const store = await getConfigStore();
  store.set(ENV_CURRENT_KEY, name);
}

function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const mins = Math.max(1, Math.round(diffMs / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function printHelp(): void {
  console.log(chalk.bold('Environment Profiles\n'));
  console.log(`  ${chalk.reset('opta env')}                         list profiles`);
  console.log(`  ${chalk.reset('opta env list')}                    list profiles`);
  console.log(
    `  ${chalk.reset('opta env show [name]')}             show a profile (or active one)`
  );
  console.log(
    `  ${chalk.reset('opta env save <name>')}             save current/overridden settings as profile`
  );
  console.log(
    `  ${chalk.reset('opta env use <name>')}              apply profile to active config`
  );
  console.log(`  ${chalk.reset('opta env delete <name>')}           remove a profile`);
  console.log('');
  console.log(
    chalk.dim(
      'Flags for save: --host --port --admin-key --admin-keys-by-host \'{\"host\":\"key\"}\' --model --provider --mode --json'
    )
  );
}

async function listProfiles(opts: EnvCommandOptions): Promise<void> {
  const profiles = await readProfiles();
  const current = await getCurrentProfileName();
  const entries = Object.values(profiles).sort((a, b) => b.updatedAt - a.updatedAt);

  if (opts.json) {
    console.log(JSON.stringify({ current, profiles: entries }, null, 2));
    return;
  }

  console.log(chalk.bold('Environment Profiles\n'));
  if (entries.length === 0) {
    console.log(chalk.dim('  No environment profiles saved yet.'));
    console.log(chalk.dim(`  Save one with ${chalk.reset('opta env save laptop')}`));
    return;
  }

  for (const profile of entries) {
    const active = current === profile.name;
    const dot = active ? chalk.green('●') : chalk.dim('○');
    const activeTag = active ? chalk.green(' active') : '';
    const keyConfigured = Boolean(profile.connection.apiKey || profile.connection.adminKey);
    const admin = keyConfigured ? 'key-set' : 'no-key';
    console.log(
      `  ${dot} ${chalk.bold(profile.name)}${activeTag} ` +
        chalk.dim(
          `(${profile.connection.host}:${profile.connection.port} · ${profile.provider} · ${profile.defaultMode} · ${admin} · ${formatRelativeTime(profile.updatedAt)})`
        )
    );
    if (profile.modelDefault) {
      console.log(chalk.dim(`     model ${profile.modelDefault}`));
    }
  }
}

async function showProfile(name: string | undefined, opts: EnvCommandOptions): Promise<void> {
  const profiles = await readProfiles();
  const current = await getCurrentProfileName();
  const resolvedName = name ? normalizeEnvProfileName(name) : current;

  if (!resolvedName) {
    console.error(chalk.red('✗') + ' No active environment profile');
    throw new ExitError(EXIT.NOT_FOUND);
  }

  const profile = profiles[resolvedName];
  if (!profile) {
    console.error(chalk.red('✗') + ` Environment profile not found: ${resolvedName}`);
    throw new ExitError(EXIT.NOT_FOUND);
  }

  if (opts.json) {
    console.log(JSON.stringify({ current, profile }, null, 2));
    return;
  }

  console.log(chalk.bold(`Environment · ${profile.name}\n`));
  console.log(`  Host:        ${profile.connection.host}`);
  console.log(`  Port:        ${profile.connection.port}`);
  console.log(`  LMX key:     ${profile.connection.apiKey || profile.connection.adminKey ? chalk.green('set') : chalk.dim('not set')}`);
  console.log(
    `  Host keys:   ${profile.connection.adminKeysByHost && Object.keys(profile.connection.adminKeysByHost).length > 0
      ? chalk.green(`${Object.keys(profile.connection.adminKeysByHost).length} configured`)
      : chalk.dim('none')}`
  );
  console.log(`  Provider:    ${profile.provider}`);
  console.log(`  Mode:        ${profile.defaultMode}`);
  console.log(`  Model:       ${profile.modelDefault || chalk.dim('(empty)')}`);
  console.log(`  Updated:     ${new Date(profile.updatedAt).toLocaleString()}`);
  if (current === profile.name) {
    console.log(chalk.green('\n  Active profile'));
  }
}

async function saveProfile(name: string | undefined, opts: EnvCommandOptions): Promise<void> {
  const profileName = normalizeEnvProfileName(name ?? '');
  if (!profileName) {
    console.error(chalk.red('✗') + ' Missing profile name');
    throw new ExitError(EXIT.MISUSE);
  }

  const config = await loadConfig();
  const host = (opts.host ?? config.connection.host).trim();
  if (!host) {
    console.error(chalk.red('✗') + ' Host cannot be empty');
    throw new ExitError(EXIT.MISUSE);
  }

  let adminKeysByHostOverride: Record<string, string> | undefined;
  if (opts.adminKeysByHost !== undefined) {
    const parsed = parseAdminKeysByHost(opts.adminKeysByHost);
    if (parsed === null) {
      console.error(chalk.red('✗') + ' Invalid admin-keys-by-host format');
      throw new ExitError(EXIT.MISUSE);
    }
    adminKeysByHostOverride = parsed;
  }

  const profile: EnvProfile = {
    name: profileName,
    connection: {
      host,
      port: parsePort(opts.port, config.connection.port),
      ...(opts.adminKey !== undefined
        ? opts.adminKey.trim()
          ? { adminKey: opts.adminKey.trim(), apiKey: opts.adminKey.trim() }
          : {}
        : config.connection.adminKey || config.connection.apiKey
          ? {
            ...(config.connection.adminKey ? { adminKey: config.connection.adminKey } : {}),
            ...(config.connection.apiKey ? { apiKey: config.connection.apiKey } : {}),
          }
          : {}),
      ...(adminKeysByHostOverride !== undefined
        ? (Object.keys(adminKeysByHostOverride).length > 0
          ? { adminKeysByHost: adminKeysByHostOverride }
          : {})
        : config.connection.adminKeysByHost && Object.keys(config.connection.adminKeysByHost).length > 0
          ? { adminKeysByHost: config.connection.adminKeysByHost }
          : {}),
    },
    modelDefault: normalizeConfiguredModelId(opts.model?.trim() ?? config.model.default),
    provider: parseProvider(opts.provider, config.provider.active),
    defaultMode: parseMode(opts.mode, config.defaultMode),
    updatedAt: Date.now(),
  };

  const profiles = await readProfiles();
  profiles[profileName] = profile;
  await writeProfiles(profiles);

  const current = await getCurrentProfileName();
  if (!current) {
    await setCurrentProfileName(profileName);
  }

  if (opts.json) {
    console.log(JSON.stringify({ saved: profileName, profile }, null, 2));
    return;
  }

  console.log(chalk.green('✓') + ` Saved environment profile ${chalk.bold(profileName)}`);
  console.log(chalk.dim(`  Use ${chalk.reset(`opta env use ${profileName}`)} to apply it`));
}

async function useProfile(name: string | undefined, opts: EnvCommandOptions): Promise<void> {
  const profileName = normalizeEnvProfileName(name ?? '');
  if (!profileName) {
    console.error(chalk.red('✗') + ' Missing profile name');
    throw new ExitError(EXIT.MISUSE);
  }

  const profiles = await readProfiles();
  const profile = profiles[profileName];
  if (!profile) {
    console.error(chalk.red('✗') + ` Environment profile not found: ${profileName}`);
    throw new ExitError(EXIT.NOT_FOUND);
  }

  const effectiveModelDefault = normalizeConfiguredModelId(profile.modelDefault);
  const updates: Record<string, unknown> = {
    'connection.host': profile.connection.host,
    'connection.port': profile.connection.port,
    'provider.active': profile.provider,
    defaultMode: profile.defaultMode,
    'model.default': effectiveModelDefault,
    'model.contextLimit': lookupContextLimit(effectiveModelDefault),
  };

  await saveConfig(updates);
  const store = await getConfigStore();
  const effectiveKey = profile.connection.apiKey ?? profile.connection.adminKey;
  if (effectiveKey) {
    store.set('connection.adminKey', profile.connection.adminKey ?? effectiveKey);
    store.set('connection.apiKey', effectiveKey);
  } else {
    store.delete('connection.adminKey');
    store.delete('connection.apiKey');
  }
  const profileHostKeys = profile.connection.adminKeysByHost ?? {};
  if (Object.keys(profileHostKeys).length > 0) {
    store.set('connection.adminKeysByHost', profileHostKeys);
  } else {
    store.delete('connection.adminKeysByHost');
  }
  await setCurrentProfileName(profile.name);

  if (opts.json) {
    console.log(JSON.stringify({ active: profile.name, applied: updates }, null, 2));
    return;
  }

  console.log(chalk.green('✓') + ` Activated environment ${chalk.bold(profile.name)}`);
  console.log(
    chalk.dim(
      `  ${profile.connection.host}:${profile.connection.port} · ${profile.provider} · ${profile.defaultMode}`
    )
  );
  if (profile.modelDefault) {
    console.log(chalk.dim(`  model ${profile.modelDefault}`));
  }
}

async function deleteProfile(name: string | undefined, opts: EnvCommandOptions): Promise<void> {
  const profileName = normalizeEnvProfileName(name ?? '');
  if (!profileName) {
    console.error(chalk.red('✗') + ' Missing profile name');
    throw new ExitError(EXIT.MISUSE);
  }

  const profiles = await readProfiles();
  if (!profiles[profileName]) {
    console.error(chalk.red('✗') + ` Environment profile not found: ${profileName}`);
    throw new ExitError(EXIT.NOT_FOUND);
  }

  Reflect.deleteProperty(profiles, profileName);
  await writeProfiles(profiles);

  const current = await getCurrentProfileName();
  const store = await getConfigStore();
  if (current === profileName) {
    const remaining = Object.keys(profiles).sort();
    if (remaining.length > 0) {
      store.set(ENV_CURRENT_KEY, remaining[0]);
    } else {
      store.delete(ENV_CURRENT_KEY);
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ deleted: profileName }, null, 2));
    return;
  }

  console.log(chalk.green('✓') + ` Deleted environment ${chalk.bold(profileName)}`);
}

export async function envCommand(
  action?: string,
  name?: string,
  opts: EnvCommandOptions = {}
): Promise<void> {
  const normalizedAction = (action ?? 'list').toLowerCase();

  switch (normalizedAction) {
    case 'help':
      printHelp();
      return;
    case 'list':
    case 'ls':
      await listProfiles(opts);
      return;
    case 'show':
    case 'current':
      await showProfile(name, opts);
      return;
    case 'save':
    case 'set':
      await saveProfile(name, opts);
      return;
    case 'use':
    case 'switch':
      await useProfile(name, opts);
      return;
    case 'delete':
    case 'remove':
    case 'rm':
      await deleteProfile(name, opts);
      return;
    default:
      console.error(chalk.red('✗') + ` Unknown env action: ${normalizedAction}`);
      throw new ExitError(EXIT.MISUSE);
  }
}
