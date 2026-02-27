import { describe, expect, it } from 'vitest';
import { colorizeOptaWord, optaWord } from '../../src/ui/brand.js';

describe('brand text colorization', () => {
  it('does not emit bold reset sequences that break dim text', () => {
    const colored = optaWord('Opta');
    expect(colored).not.toContain('\u001b[22m');
    expect(colored).toContain('Opta');
  });

  it('preserves surrounding content while replacing case-insensitive Opta matches', () => {
    const colored = colorizeOptaWord('opta CLI makes OPTA faster');
    expect(colored).toMatch(/opta|Opta|OPTA/);
    expect(colored).toContain('CLI');
    expect(colored).toContain('faster');
  });
});
