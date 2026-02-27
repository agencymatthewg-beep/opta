import { describe, it, expect } from 'vitest';
import { captureConsoleOutput } from '../../src/tui/capture.js';

describe('captureConsoleOutput', () => {
  it('captures logs and sanitizes unsafe terminal control sequences', async () => {
    const { result, output } = await captureConsoleOutput(async () => {
      console.log('\u001B[31m  first\u001B[0m');
      console.error('second\u0007');
      return 7;
    });

    expect(result).toBe(7);
    expect(output).toBe('  first\nsecond');
  });
});
