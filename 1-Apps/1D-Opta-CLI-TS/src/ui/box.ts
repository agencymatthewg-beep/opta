import chalk from 'chalk';
import { getTheme } from './theme.js';

// --- Box Drawing ---

const BOX = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', ml: '├', mr: '┤' };

/**
 * Render a bordered box with a title and content lines.
 * Width auto-sizes to the longest line (min 40), capped at terminal width.
 */
export function box(title: string, lines: string[], { width: fixedWidth }: { width?: number } = {}): string {
  const stripped = lines.map(stripAnsi);
  const titleLen = stripAnsi(title).length;
  const maxContent = Math.max(...stripped.map(l => l.length), 0);
  const termWidth = process.stdout.columns || 80;
  const width = fixedWidth ?? Math.min(
    Math.max(maxContent + 4, titleLen + 6, 40),
    termWidth - 4
  );
  const inner = width - 2;

  const out: string[] = [];
  // Top border with title (uses theme primary for title accent)
  const theme = getTheme();
  const titlePart = title ? ` ${title} ` : '';
  const topFill = inner - stripAnsi(titlePart).length;
  out.push(chalk.dim(BOX.tl + BOX.h) + theme.primary.bold(titlePart) + chalk.dim(BOX.h.repeat(Math.max(topFill, 0)) + BOX.tr));

  // Content lines
  for (let i = 0; i < lines.length; i++) {
    const pad = inner - stripped[i]!.length;
    out.push(chalk.dim(BOX.v) + ' ' + lines[i] + ' '.repeat(Math.max(pad - 1, 0)) + chalk.dim(BOX.v));
  }

  // Bottom border
  out.push(chalk.dim(BOX.bl + BOX.h.repeat(inner) + BOX.br));

  return out.join('\n');
}

/**
 * Render a horizontal divider with optional label.
 */
export function divider(label?: string, width = 40): string {
  if (!label) return chalk.dim(BOX.h.repeat(width));
  const fill = width - label.length - 2;
  return chalk.dim(BOX.ml + BOX.h) + chalk.dim(` ${label} `) + chalk.dim(BOX.h.repeat(Math.max(fill - 3, 0)) + BOX.mr);
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
  const bar = theme.info('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const color = pct > 85 ? theme.error : pct > 70 ? theme.warning : chalk.dim;
  return `${bar} ${color(`${pct}%`)}`;
}

// --- Formatting Helpers ---

/**
 * Format a token count with K suffix.
 */
export function fmtTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

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

// --- ANSI Stripping ---

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}
