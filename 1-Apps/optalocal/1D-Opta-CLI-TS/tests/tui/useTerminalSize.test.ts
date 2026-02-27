import { describe, expect, it } from 'vitest';
import { resolveSize } from '../../src/tui/hooks/useTerminalSize.js';

describe('resolveSize', () => {
  it('prefers Ink stdout size over wider process/env candidates', () => {
    const prevColumns = process.env.COLUMNS;
    const prevLines = process.env.LINES;
    process.env.COLUMNS = '240';
    process.env.LINES = '120';

    try {
      const fakeStdout = { columns: 92, rows: 28 } as NodeJS.WriteStream;
      const size = resolveSize(fakeStdout);
      expect(size.width).toBe(92);
      expect(size.height).toBe(28);
    } finally {
      if (prevColumns === undefined) delete process.env.COLUMNS;
      else process.env.COLUMNS = prevColumns;
      if (prevLines === undefined) delete process.env.LINES;
      else process.env.LINES = prevLines;
    }
  });
});
