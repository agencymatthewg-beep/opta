import type { BrowserMode } from './types.js';

export interface PlaywrightMcpServerConfig {
  transport: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface PlaywrightMcpBootstrapOptions {
  command?: string;
  packageName?: string;
  mode?: BrowserMode;
  allowedHosts?: string[];
  blockedOrigins?: string[];
  env?: Record<string, string>;
}

function normalizeList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function createPlaywrightMcpServerConfig(
  options: PlaywrightMcpBootstrapOptions = {},
): PlaywrightMcpServerConfig {
  const mode = options.mode ?? 'isolated';
  const args: string[] = ['-y', options.packageName ?? '@playwright/mcp@latest'];

  if (mode === 'isolated') {
    args.push('--isolated');
  }

  const allowedHosts = normalizeList(options.allowedHosts);
  if (allowedHosts.length > 0) {
    args.push('--allowed-hosts', allowedHosts.join(','));
  }

  const blockedOrigins = normalizeList(options.blockedOrigins);
  if (blockedOrigins.length > 0) {
    args.push('--blocked-origins', blockedOrigins.join(','));
  }

  return {
    transport: 'stdio',
    command: options.command ?? 'npx',
    args,
    env: { ...(options.env ?? {}) },
  };
}
