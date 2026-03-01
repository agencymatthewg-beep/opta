import { describe, it, expect } from 'vitest';
import {
  formatAssistantDisplayText,
  sanitizeTerminalText,
  sanitizeTerminalTokenChunk,
  stripAnsi,
  trimDisplayTail,
  visibleTextWidth,
} from '../../src/utils/text.js';

describe('sanitizeTerminalText', () => {
  it('strips ANSI escape sequences', () => {
    const input = '\u001B[32mhello\u001B[0m world';
    expect(sanitizeTerminalText(input)).toBe('hello world');
  });

  it('keeps CRLF as newline and preserves lone carriage returns as spaces', () => {
    const input = 'line1\r\nline2\roverwrite\u0007';
    expect(sanitizeTerminalText(input)).toBe('line1\nline2 overwrite');
  });

  it('does not expand repeated carriage returns into blank lines', () => {
    const input = 'progress 1%\rprogress 2%\rprogress 3%';
    expect(sanitizeTerminalText(input)).toBe('progress 1% progress 2% progress 3%');
  });

  it('normalizes space-only lines and runaway blank lines', () => {
    const input = 'line 1\n' + ' '.repeat(200) + '\n\n\n\n\n\nline 2';
    expect(sanitizeTerminalText(input)).toBe('line 1\n\n\nline 2');
  });

  it('trims trailing line whitespace without removing indentation', () => {
    const input = '  keep indent   \nnext\t\t   ';
    expect(sanitizeTerminalText(input)).toBe('  keep indent\nnext');
  });

  it('normalizes tabs and strips zero-width chars that break terminal layout', () => {
    const input = 'tool\tstatus\u200Bline';
    expect(sanitizeTerminalText(input)).toBe('tool  statusline');
  });
});

describe('formatAssistantDisplayText', () => {
  it('moves inline markdown headings onto separate lines', () => {
    const input = 'Summary ## Major Updates ### Models';
    const output = formatAssistantDisplayText(input);
    expect(output).toContain('Summary\n\n## Major Updates\n\n### Models');
  });

  it('expands dense dash-separated lists into bullets', () => {
    const input = 'Key updates: Alpha - Beta - Gamma';
    const output = formatAssistantDisplayText(input);
    expect(output).toContain('Key updates:\n- Alpha\n- Beta\n- Gamma');
  });

  it('preserves fenced code blocks verbatim', () => {
    const input = 'Notes\n```md\nA - B - C\n```\nDone';
    const output = formatAssistantDisplayText(input);
    expect(output).toContain('```md\nA - B - C\n```');
  });

  it('keeps streaming mode conservative for dash-heavy lines', () => {
    const input = 'Key updates: Alpha - Beta - Gamma';
    const output = formatAssistantDisplayText(input, { streaming: true });
    expect(output).toContain('Key updates: Alpha - Beta - Gamma');
    expect(output).not.toContain('\n- Alpha');
  });

  it('splits very long dense prose lines for stable terminal rendering', () => {
    const input = 'Result summary: stepOneComplete,stepTwoComplete,stepThreeComplete,stepFourComplete,stepFiveComplete,stepSixComplete. NextPhaseBeginsImmediatelyWithNoSpacingOrBreaks and this should not stay as one huge line.';
    const output = formatAssistantDisplayText(input);
    expect(output).toContain('\n');
    expect(output).toContain('step One Complete');
  });
});

describe('sanitizeTerminalTokenChunk', () => {
  it('preserves edge whitespace needed for streamed token concatenation', () => {
    expect(sanitizeTerminalTokenChunk('my ')).toBe('my ');
    expect(sanitizeTerminalTokenChunk(' connection')).toBe(' connection');
  });

  it('still strips ANSI and control characters', () => {
    expect(sanitizeTerminalTokenChunk('\u001B[32mok\u001B[0m\u0007')).toBe('ok');
  });

  it('normalizes tabs and strips zero-width formatting chars', () => {
    expect(sanitizeTerminalTokenChunk('a\tb\u2060c')).toBe('a  bc');
  });
});

describe('stripAnsi', () => {
  it('removes ANSI styling but keeps control chars unchanged', () => {
    expect(stripAnsi('\u001B[31mX\u001B[0m\r\n')).toBe('X\r\n');
  });
});

describe('trimDisplayTail', () => {
  it('keeps leading indentation but trims trailing whitespace', () => {
    const input = '  aligned line\nnext line   \n\n';
    expect(trimDisplayTail(input)).toBe('  aligned line\nnext line');
  });
});

describe('visibleTextWidth', () => {
  it('counts wide glyphs as 2 columns', () => {
    expect(visibleTextWidth('A你B')).toBe(4);
  });

  it('ignores ANSI and control chars', () => {
    expect(visibleTextWidth('\u001B[32mok\u001B[0m\u0007')).toBe(2);
  });
});
