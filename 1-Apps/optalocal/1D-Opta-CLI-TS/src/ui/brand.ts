import chalk from 'chalk';

const OPTA_WORD_RE = /\bopta\b/gi;
const OPTA_PURPLE = '#8b5cf6';

export function optaWord(text = 'Opta'): string {
  // Avoid bold here: ANSI bold reset (\x1b[22m) can cancel surrounding dim
  // styles, causing mixed-tone artifacts in muted status/system rows.
  return chalk.hex(OPTA_PURPLE)(text);
}

export function colorizeOptaWord(text: string): string {
  return text.replace(OPTA_WORD_RE, (match) => optaWord(match));
}
