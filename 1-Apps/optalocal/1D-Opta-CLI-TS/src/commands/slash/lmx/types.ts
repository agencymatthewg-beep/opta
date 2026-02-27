/**
 * Shared types, constants, and utility functions for LMX slash commands.
 */

import chalk from 'chalk';
import { formatTagLabel } from '../../../core/model-display.js';
import type { ModelFormat } from '../../../core/model-display.js';
import type { SlashContext } from '../types.js';

export const STABLE_MODEL_LOAD_TIMEOUT_MS = 300_000;
export const FAST_SLASH_REQUEST_OPTS = { timeoutMs: 5_000, maxRetries: 0 } as const;

/** Colored format tag -- mirrors commands/models.ts fmtTag() */
export function fmtTag(format: ModelFormat): string {
  switch (format) {
    case 'MLX': return chalk.hex('#a855f7')(formatTagLabel(format));
    case 'GGUF': return chalk.yellow(formatTagLabel(format));
    case 'CLOUD': return chalk.blue(formatTagLabel(format));
    default: return chalk.dim(formatTagLabel(format));
  }
}

export function parseSlashArgs(raw: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`|([^\s]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(raw)) !== null) {
    const captured = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    tokens.push(captured.replace(/\\(["'`\\])/g, '$1'));
  }

  return tokens;
}

export function parseBooleanLiteral(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
}

export function renderJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

export function readNumber(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

export function readBoolean(record: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }
    if (typeof value === 'string') {
      const parsed = parseBooleanLiteral(value);
      if (parsed !== undefined) return parsed;
    }
  }
  return undefined;
}

export function readArray(record: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function classifyOutcome(raw: string | undefined): 'success' | 'failure' | 'unknown' {
  if (!raw) return 'unknown';
  const value = raw.trim().toLowerCase();
  if (['ok', 'pass', 'passed', 'success', 'compatible'].includes(value)) return 'success';
  if (['fail', 'failed', 'failure', 'error', 'incompatible'].includes(value)) return 'failure';
  return 'unknown';
}

export function adminEndpointUrl(ctx: SlashContext, path: string): string {
  return `http://${ctx.config.connection.host}:${ctx.config.connection.port}${path}`;
}

export async function fetchAdminText(ctx: SlashContext, path: string, timeoutMs: number): Promise<string> {
  const headers: Record<string, string> = {};
  if (ctx.config.connection.adminKey?.trim()) {
    headers['X-Admin-Key'] = ctx.config.connection.adminKey.trim();
  }
  const response = await fetch(adminEndpointUrl(ctx, path), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}
