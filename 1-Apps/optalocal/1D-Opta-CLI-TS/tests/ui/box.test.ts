import { describe, it, expect } from 'vitest';
import { box } from '../../src/ui/box.js';
import { stripAnsi, visibleTextWidth } from '../../src/utils/text.js';

describe('box', () => {
  it('keeps all rendered rows at equal visible width', () => {
    const output = box('Title', [
      '\u001B[32mgreen\u001B[0m text',
      '你你 wide chars',
    ], { width: 44 });

    const lines = output.split('\n').map(stripAnsi);
    const widths = lines.map(visibleTextWidth);
    expect(new Set(widths).size).toBe(1);
  });

  it('respects explicit width argument', () => {
    const output = box('X', ['y'], { width: 40 });
    const firstLineWidth = visibleTextWidth(stripAnsi(output.split('\n')[0] ?? ''));
    expect(firstLineWidth).toBe(40);
  });

  it('clamps width to detected terminal width', () => {
    const stdoutWithCols = process.stdout as NodeJS.WriteStream & { columns?: number };
    const prevCols = stdoutWithCols.columns;
    stdoutWithCols.columns = 30;
    try {
      const output = box('X', ['y'], { width: 80 });
      const firstLineWidth = visibleTextWidth(stripAnsi(output.split('\n')[0] ?? ''));
      expect(firstLineWidth).toBe(26); // term width 30 minus outer padding budget 4
    } finally {
      stdoutWithCols.columns = prevCols;
    }
  });
});
