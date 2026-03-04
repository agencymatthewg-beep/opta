import { readFile as fsReadFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { normalizeAdminKeyHost } from './admin-keys.js';

const DEFAULT_LOCAL_CONFIG_PATHS = ['~/.opta-lmx/config.yaml'];

export type LocalAdminKeySource = 'env' | 'local-config' | 'none';

export interface LocalAdminKeyDetection {
  key?: string;
  source: LocalAdminKeySource;
  path?: string;
}

type ReadFileFn = (path: string, encoding: 'utf8') => Promise<string>;

export interface DetectLocalAdminKeyOptions {
  env?: Record<string, string | undefined>;
  readFile?: ReadFileFn;
  homedir?: () => string;
  configCandidates?: string[];
}

function expandHomePath(rawPath: string, userHome: string): string {
  if (!rawPath) return '';
  if (rawPath === '~') return userHome;
  if (rawPath.startsWith('~/')) {
    return resolve(userHome, rawPath.slice(2));
  }
  return resolve(rawPath);
}

function sanitizeAdminKey(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') {
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
}

function extractAdminKey(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const security = (parsed as Record<string, unknown>)['security'];
  if (!security || typeof security !== 'object') return undefined;
  return sanitizeAdminKey((security as Record<string, unknown>)['admin_key']);
}

export async function detectLocalAdminKey(
  options: DetectLocalAdminKeyOptions = {}
): Promise<LocalAdminKeyDetection> {
  const env = options.env ?? process.env;
  const envKey = env?.['OPTA_ADMIN_KEY'];
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return { key: envKey.trim(), source: 'env' };
  }

  const readFile: ReadFileFn =
    options.readFile ??
    (async (path: string, encoding: 'utf8') => {
      return await fsReadFile(path, encoding);
    });
  const userHome = options.homedir?.() ?? homedir();
  const visited = new Set<string>();
  const candidates = [
    ...(options.configCandidates ?? []),
    ...DEFAULT_LOCAL_CONFIG_PATHS,
  ].filter((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);

  for (const rawPath of candidates) {
    const resolvedPath = expandHomePath(rawPath, userHome);
    if (!resolvedPath || visited.has(resolvedPath)) continue;
    visited.add(resolvedPath);
    try {
      const contents = await readFile(resolvedPath, 'utf8');
      const parsed = YAML.parse(contents);
      const key = extractAdminKey(parsed);
      if (key) {
        return { key, source: 'local-config', path: resolvedPath };
      }
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT') {
        continue;
      }
      // Malformed files are ignored — try next candidate.
      continue;
    }
  }

  return { key: undefined, source: 'none' };
}

function normalizeLoopbackCandidate(host?: string): string {
  const normalized = normalizeAdminKeyHost(host ?? '');
  if (!normalized) return '';
  if (normalized.startsWith('[')) {
    const closing = normalized.indexOf(']');
    if (closing > 0) {
      return normalized.slice(1, closing);
    }
    return normalized.slice(1);
  }
  return normalized;
}

function stripPortSuffix(host: string): string {
  const colonMatches = host.match(/:/g);
  if (colonMatches && colonMatches.length > 1) {
    return host;
  }
  const lastColon = host.lastIndexOf(':');
  if (lastColon === -1) return host;
  const candidatePort = host.slice(lastColon + 1);
  return /^\d+$/.test(candidatePort) ? host.slice(0, lastColon) : host;
}

export function isLoopbackHost(host?: string): boolean {
  const normalized = normalizeLoopbackCandidate(host);
  if (!normalized) return true;
  const hostWithoutPort = stripPortSuffix(normalized);
  if (hostWithoutPort === 'localhost') return true;
  if (hostWithoutPort === '::1' || hostWithoutPort === '0:0:0:0:0:0:0:1') return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(hostWithoutPort)) return true;
  return false;
}
