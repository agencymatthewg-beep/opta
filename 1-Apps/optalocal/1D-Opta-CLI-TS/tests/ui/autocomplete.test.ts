import { describe, it, expect } from 'vitest';
import { fuzzyMatch, getCompletions } from '../../src/ui/autocomplete.js';

describe('fuzzy match', () => {
  it('should match substring', () => {
    expect(fuzzyMatch('agent', 'src/core/agent.ts')).toBe(true);
    expect(fuzzyMatch('xyz', 'src/core/agent.ts')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(fuzzyMatch('Agent', 'src/core/agent.ts')).toBe(true);
  });
});

describe('getCompletions', () => {
  it('should return file matches for @ trigger', () => {
    const files = ['src/core/agent.ts', 'src/core/tools.ts', 'src/ui/box.ts'];
    const results = getCompletions('ag', files);
    expect(results).toContain('src/core/agent.ts');
    expect(results).not.toContain('src/ui/box.ts');
  });

  it('should limit results', () => {
    const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
    const results = getCompletions('file', files, 10);
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('should prioritize basename matches', () => {
    const files = ['src/deep/nested/agent.ts', 'agent.ts', 'src/core/agent-utils.ts'];
    const results = getCompletions('agent', files);
    // Exact basename match should come first (shortest path)
    expect(results[0]).toBe('agent.ts');
  });

  it('should return empty for no matches', () => {
    const files = ['src/core/agent.ts', 'src/core/tools.ts'];
    const results = getCompletions('zzz', files);
    expect(results).toHaveLength(0);
  });
});
