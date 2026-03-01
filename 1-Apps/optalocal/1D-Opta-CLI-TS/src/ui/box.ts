import chalk from 'chalk';
import { getTheme } from './theme.js';
import { formatTokens } from '../utils/tokens.js';
import { stripAnsi, visibleTextWidth } from '../utils/text.js';
import { padToWidth } from '../utils/terminal-layout.js';

// --- Box Drawing ---

const BOX = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', ml: '├', mr: '┤' };

/**
 * Render a bordered box with a title and content lines.
 * Width auto-sizes to the longest line (min 40), capped at terminal width.
 */
export function box(title: string, lines: string[], { width: fixedWidth }: { width?: number } = {}): string {
  const titleLen = visibleTextWidth(title);
  const maxContent = Math.max(...lines.map(l => visibleTextWidth(stripAnsi(l))), 0);
  const reportedWidth = (process.stdout.columns && process.stdout.columns > 0)
    ? process.stdout.columns
    : Number(process.env.COLUMNS || 0) || 0;
  const termWidth = reportedWidth >= 20 ? reportedWidth : 80;
  const maxWidth = Math.max(10, termWidth - 4);
  const requestedWidth = fixedWidth ?? Math.max(maxContent + 4, titleLen + 6, 40);
  const width = Math.max(10, Math.min(requestedWidth, maxWidth));
  const inner = width - 2;

  const out: string[] = [];
  // Top border with title (uses theme primary for title accent)
  const theme = getTheme();
  const borderColor = chalk.hex(theme.colors.border);
  const titlePart = title ? ` ${title} ` : '';
  const topFill = inner - visibleTextWidth(titlePart);
  out.push(
    borderColor(BOX.tl) +
    theme.primary.bold(titlePart) +
    borderColor(padToWidth('', Math.max(topFill, 0), BOX.h) + BOX.tr),
  );

  // Content lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fitted = padToWidth(line, Math.max(inner - 1, 0));
    out.push(borderColor(BOX.v) + ' ' + fitted + borderColor(BOX.v));
  }

  // Bottom border
  out.push(borderColor(BOX.bl + padToWidth('', inner, BOX.h) + BOX.br));

  return out.join('\n');
}

/**
 * Render a horizontal divider with optional label.
 */
export function divider(label?: string, width = 40): string {
  const borderColor = chalk.hex(getTheme().colors.border);
  if (!label) return borderColor(padToWidth('', width, BOX.h));
  const fill = width - visibleTextWidth(label) - 2;
  return borderColor(BOX.ml + BOX.h) + chalk.dim(` ${label} `) + borderColor(padToWidth('', Math.max(fill - 3, 0), BOX.h) + BOX.mr);
}

// --- Progress Bar ---

/**
 * Render a visual progress bar.
 * progressBar(0.41, 20) → "████████░░░░░░░░░░░░ 41%"
 */
export function progressBar(ratio: number, width = 20): string {
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * width);
  const empty = width - filled;
  const pct = Math.round(clamped * 100);

  const theme = getTheme();
  const bar = theme.info('█'.repeat(filled)) + chalk.hex(theme.colors.border)('░'.repeat(empty));
  const color = pct > 85 ? theme.error : pct > 70 ? theme.warning : chalk.dim;
  return `${bar} ${color(`${pct}%`)}`;
}

// --- Formatting Helpers ---

/**
 * Format a token count with K suffix.
 * @deprecated Use `formatTokens` from `../utils/tokens.js` directly.
 */
export const fmtTokens = formatTokens;

/**
 * Right-pad a label to align values.
 * kv('Model', 'Qwen2.5-72B', 10) → "Model:    Qwen2.5-72B"
 */
export function kv(key: string, value: string, keyWidth = 10): string {
  const pad = Math.max(keyWidth - key.length, 0);
  return chalk.dim(key + ':') + ' '.repeat(pad + 1) + value;
}

/**
 * Status dot indicator.
 */
export function statusDot(ok: boolean): string {
  const theme = getTheme();
  return ok ? theme.success('●') : theme.error('●');
}
