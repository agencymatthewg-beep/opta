import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

const PEEKABOO_BIN = 'peekaboo';
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_STREAM_CONTEXT_CHARS = 600;
const HOTKEY_MODIFIER_KEYS = new Set(['cmd', 'command', 'shift', 'alt', 'option', 'ctrl', 'control', 'fn']);
const TOKEN_KEYWORDS = [
  'token',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'secret',
  'password',
  'authorization',
  'x-opta-screen-token',
  'session',
];

export interface PeekabooErrorDetails {
  action: string;
  timeoutMs: number;
  context?: Record<string, unknown>;
  exitCode?: number;
  signal?: string;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
}

interface PeekabooRunOptions {
  timeoutMs?: number;
  action: string;
  context?: Record<string, unknown>;
}

export class PeekabooActionError extends Error {
  readonly details: PeekabooErrorDetails;

  constructor(message: string, details: PeekabooErrorDetails, cause?: unknown) {
    super(message, { cause });
    this.name = 'PeekabooActionError';
    this.details = details;
  }
}

function redactSensitiveSegments(value: string): string {
  let redacted = value;

  redacted = redacted.replace(
    /(authorization\s*:\s*bearer\s+)([A-Za-z0-9._~+/=-]+)/gi,
    '$1[REDACTED]',
  );

  for (const keyword of TOKEN_KEYWORDS) {
    const pairPattern = new RegExp(`(${keyword}\\s*[:=]\\s*)([^\\s,;]+)`, 'gi');
    redacted = redacted.replace(pairPattern, '$1[REDACTED]');

    const queryPattern = new RegExp(`([?&]${keyword}=)([^&#\\s]+)`, 'gi');
    redacted = redacted.replace(queryPattern, '$1[REDACTED]');

    const jsonPattern = new RegExp(`("${keyword}"\\s*:\\s*")([^"]+)(")`, 'gi');
    redacted = redacted.replace(jsonPattern, '$1[REDACTED]$3');
  }

  redacted = redacted.replace(/(bearer\s+)([A-Za-z0-9._~+/=-]+)/gi, '$1[REDACTED]');
  return redacted;
}

export function redactPeekabooSensitiveText(value: string): string {
  return redactSensitiveSegments(value);
}

function sanitizeStream(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const redacted = redactPeekabooSensitiveText(trimmed);
  if (redacted.length <= MAX_STREAM_CONTEXT_CHARS) {
    return redacted;
  }
  return `${redacted.slice(0, MAX_STREAM_CONTEXT_CHARS)}…`;
}

function toOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function summarizeError(
  error: unknown,
  options: Required<PeekabooRunOptions>,
): PeekabooActionError {
  const details: PeekabooErrorDetails = {
    action: options.action,
    timeoutMs: options.timeoutMs,
    context: options.context,
  };

  if (error && typeof error === 'object') {
    const maybeError = error as Record<string, unknown>;
    details.exitCode = toOptionalNumber(maybeError['exitCode']);
    details.signal = toOptionalString(maybeError['signal']);
    details.timedOut = maybeError['timedOut'] === true;
    details.stdout = sanitizeStream(maybeError['stdout']);
    details.stderr = sanitizeStream(maybeError['stderr']);
  }

  const message = [
    `Peekaboo action failed: ${JSON.stringify({
      action: details.action,
      timeoutMs: details.timeoutMs,
      context: details.context ?? {},
      exitCode: details.exitCode ?? null,
      signal: details.signal ?? null,
      timedOut: details.timedOut === true,
      stdout: details.stdout ?? null,
      stderr: details.stderr ?? null,
    })}`,
  ].join(' ');

  return new PeekabooActionError(message, details, error);
}

async function runPeekaboo(args: string[], options: PeekabooRunOptions): Promise<void> {
  const resolved: Required<PeekabooRunOptions> = {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    action: options.action,
    context: options.context ?? {},
  };
  try {
    await execa(PEEKABOO_BIN, args, {
      timeout: resolved.timeoutMs,
      reject: true,
    });
  } catch (error) {
    throw summarizeError(error, resolved);
  }
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Peekaboo ${field} must be non-empty.`);
  }
  return trimmed;
}

function normalizeKeyName(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower === 'command') return 'cmd';
  if (lower === 'option') return 'alt';
  if (lower === 'control') return 'ctrl';
  return lower;
}

function parseHotkeyKeys(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  const parse = (parts: string[]): string | null => {
    const normalized = parts
      .map((part) => normalizeKeyName(part))
      .filter(Boolean);
    if (normalized.length < 2) return null;
    if (!normalized.some((part) => HOTKEY_MODIFIER_KEYS.has(part))) return null;
    return normalized.join(',');
  };

  if (input.includes('+')) {
    return parse(input.split('+'));
  }
  if (input.includes(',')) {
    return parse(input.split(','));
  }

  const spaced = input.split(/\s+/);
  if (spaced.length > 1) {
    return parse(spaced);
  }

  return null;
}

export async function isPeekabooAvailable(): Promise<boolean> {
  try {
    await runPeekaboo(['--help'], {
      timeoutMs: 1_500,
      action: 'availability-check',
    });
    return true;
  } catch {
    return false;
  }
}

export async function capturePeekabooScreenPng(appName?: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'opta-peekaboo-'));
  const imagePath = join(dir, 'screen.png');

  try {
    const args: string[] = ['image'];
    if (appName) args.push('--app', appName);
    args.push('--path', imagePath, '--format', 'png');
    await runPeekaboo(args, {
      timeoutMs: 15_000,
      action: 'screen-capture',
      context: {
        appName: appName ?? 'all-windows',
        format: 'png',
      },
    });
    return await readFile(imagePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function peekabooClickLabel(label: string): Promise<void> {
  const normalizedLabel = requireNonEmpty(label, 'click label');
  await runPeekaboo(['click', normalizedLabel], {
    timeoutMs: 8_000,
    action: 'click-label',
    context: {
      labelLength: normalizedLabel.length,
    },
  });
}

export async function peekabooTypeText(text: string): Promise<void> {
  const normalizedText = requireNonEmpty(text, 'text input');
  await runPeekaboo(['type', normalizedText], {
    timeoutMs: 8_000,
    action: 'type',
    context: {
      chars: normalizedText.length,
    },
  });
}

export async function peekabooPressKey(key: string): Promise<void> {
  const normalizedKey = requireNonEmpty(key, 'key input');
  const hotkeyKeys = parseHotkeyKeys(normalizedKey);
  if (hotkeyKeys) {
    await runPeekaboo(['hotkey', '--keys', hotkeyKeys], {
      timeoutMs: 8_000,
      action: 'press-key',
      context: {
        mode: 'hotkey',
        keyCount: hotkeyKeys.split(',').length,
      },
    });
    return;
  }

  const pressKeys = normalizedKey
    .split(/\s+/)
    .map((part) => normalizeKeyName(part))
    .filter(Boolean);
  await runPeekaboo(['press', ...pressKeys], {
    timeoutMs: 8_000,
    action: 'press-key',
    context: {
      mode: 'press',
      keyCount: pressKeys.length,
    },
  });
}
