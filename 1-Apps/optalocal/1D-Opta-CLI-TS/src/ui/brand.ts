import chalk from 'chalk';

const OPTA_WORD_RE = /\bopta\b/gi;
const OPTA_PURPLE = '#a855f7';
export const OPTA_BRAND_NAME = 'Opta' as const;
export const OPTA_BRAND_GLYPH = '◉' as const;

export function optaWord(text: string = OPTA_BRAND_NAME): string {
  // Avoid bold here: ANSI bold reset (\x1b[22m) can cancel surrounding dim
  // styles, causing mixed-tone artifacts in muted status/system rows.
  return chalk.hex(OPTA_PURPLE)(text);
}

export function optaLockup(text: string = OPTA_BRAND_NAME): string {
  return `${OPTA_BRAND_GLYPH} ${text}`;
}

export function colorizeOptaWord(text: string): string {
  return text.replace(OPTA_WORD_RE, (match) => optaWord(match));
}
