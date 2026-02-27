import { sanitizeTerminalText, visibleTextWidth } from './text.js';

export interface FitTextOptions {
  ellipsis?: string;
  pad?: boolean;
  padDirection?: 'left' | 'right';
  sanitize?: boolean;
}

function normalizeWidth(width: number): number {
  if (!Number.isFinite(width)) return 0;
  return Math.max(0, Math.floor(width));
}

function truncateToWidth(text: string, width: number, ellipsis: string): string {
  const targetWidth = normalizeWidth(width);
  if (targetWidth <= 0) return '';

  if (visibleTextWidth(text) <= targetWidth) return text;

  const ellipsisWidth = Math.max(0, visibleTextWidth(ellipsis));
  if (ellipsisWidth >= targetWidth) {
    let tiny = '';
    for (const ch of ellipsis) {
      if (visibleTextWidth(tiny + ch) > targetWidth) break;
      tiny += ch;
    }
    return tiny;
  }

  const contentWidth = targetWidth - ellipsisWidth;
  let out = '';
  for (const ch of text) {
    if (visibleTextWidth(out + ch) > contentWidth) break;
    out += ch;
  }
  return out + ellipsis;
}

/**
 * Pad text to an exact visible width.
 * Does not truncate if input already exceeds width.
 */
export function padToWidth(
  input: string,
  width: number,
  char = ' ',
  direction: 'left' | 'right' = 'right',
): string {
  const targetWidth = normalizeWidth(width);
  if (targetWidth <= 0) return '';

  const fill = visibleTextWidth(char) === 1 ? char : ' ';
  const current = visibleTextWidth(input);
  if (current >= targetWidth) return input;

  const pad = fill.repeat(targetWidth - current);
  return direction === 'left' ? `${pad}${input}` : `${input}${pad}`;
}

/**
 * Fit text into a fixed width using terminal-visible width rules.
 */
export function fitTextToWidth(input: string, width: number, options: FitTextOptions = {}): string {
  const targetWidth = normalizeWidth(width);
  if (targetWidth <= 0) return '';

  const {
    ellipsis = '…',
    pad = false,
    padDirection = 'right',
    sanitize = true,
  } = options;

  const base = sanitize ? sanitizeTerminalText(input) : input;
  const trimmed = truncateToWidth(base, targetWidth, ellipsis);
  return pad ? padToWidth(trimmed, targetWidth, ' ', padDirection) : trimmed;
}

/**
 * Estimate wrapped terminal rows for a block of text at a fixed width.
 */
export function estimateWrappedLines(text: string, width: number): number {
  if (!text) return 0;

  const safeWidth = Math.max(1, normalizeWidth(width));
  const lines = sanitizeTerminalText(text).split('\n');
  let total = 0;

  for (const line of lines) {
    total += Math.max(1, Math.ceil(visibleTextWidth(line) / safeWidth));
  }

  return total;
}
