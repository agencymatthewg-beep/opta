import { describe, expect, it } from 'vitest';
import { estimateWrappedLines, fitTextToWidth, padToWidth } from '../../src/utils/terminal-layout.js';
import { visibleTextWidth } from '../../src/utils/text.js';

describe('fitTextToWidth', () => {
  it('pads shorter content when requested', () => {
    const out = fitTextToWidth('opta', 8, { pad: true });
    expect(out).toBe('opta    ');
    expect(visibleTextWidth(out)).toBe(8);
  });

  it('truncates and adds ellipsis for long content', () => {
    expect(fitTextToWidth('abcdefghijklmnopqrstuvwxyz', 8)).toBe('abcdefg…');
  });

  it('handles wide characters with visible-width truncation', () => {
    const out = fitTextToWidth('你你你你你', 6);
    expect(visibleTextWidth(out)).toBeLessThanOrEqual(6);
  });
});

describe('padToWidth', () => {
  it('pads to an exact visible width', () => {
    const out = padToWidth('abc', 7);
    expect(visibleTextWidth(out)).toBe(7);
  });

  it('supports left padding', () => {
    expect(padToWidth('42', 4, ' ', 'left')).toBe('  42');
  });
});

describe('estimateWrappedLines', () => {
  it('estimates wrapped rows for long lines', () => {
    expect(estimateWrappedLines('x'.repeat(23), 10)).toBe(3);
  });

  it('counts explicit newlines', () => {
    expect(estimateWrappedLines('line1\nline2\nline3', 80)).toBe(3);
  });
});
