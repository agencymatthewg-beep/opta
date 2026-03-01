import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execa } from 'execa';

const PEEKABOO_BIN = 'peekaboo';
const DEFAULT_TIMEOUT_MS = 8_000;
const HOTKEY_MODIFIER_KEYS = new Set(['cmd', 'command', 'shift', 'alt', 'option', 'ctrl', 'control', 'fn']);

async function runPeekaboo(args: string[], timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  await execa(PEEKABOO_BIN, args, {
    timeout: timeoutMs,
    reject: true,
  });
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
    await runPeekaboo(['--help'], 1_500);
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
    await runPeekaboo(args, 15_000);
    return await readFile(imagePath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function peekabooClickLabel(label: string): Promise<void> {
  const normalizedLabel = requireNonEmpty(label, 'click label');
  await runPeekaboo(['click', normalizedLabel], 8_000);
}

export async function peekabooTypeText(text: string): Promise<void> {
  const normalizedText = requireNonEmpty(text, 'text input');
  await runPeekaboo(['type', normalizedText], 8_000);
}

export async function peekabooPressKey(key: string): Promise<void> {
  const normalizedKey = requireNonEmpty(key, 'key input');
  const hotkeyKeys = parseHotkeyKeys(normalizedKey);
  if (hotkeyKeys) {
    await runPeekaboo(['hotkey', '--keys', hotkeyKeys], 8_000);
    return;
  }

  const pressKeys = normalizedKey
    .split(/\s+/)
    .map((part) => normalizeKeyName(part))
    .filter(Boolean);
  await runPeekaboo(['press', ...pressKeys], 8_000);
}
