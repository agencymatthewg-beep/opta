import { describe, it, expect } from 'vitest';
import { DEFAULT_IGNORE_DIRS, DEFAULT_IGNORE_GLOBS, toGlobIgnore } from '../../src/utils/ignore.js';

describe('DEFAULT_IGNORE_DIRS', () => {
  it('includes standard directories', () => {
    expect(DEFAULT_IGNORE_DIRS).toContain('node_modules');
    expect(DEFAULT_IGNORE_DIRS).toContain('.git');
    expect(DEFAULT_IGNORE_DIRS).toContain('dist');
    expect(DEFAULT_IGNORE_DIRS).toContain('coverage');
    expect(DEFAULT_IGNORE_DIRS).toContain('.next');
  });
});

describe('DEFAULT_IGNORE_GLOBS', () => {
  it('includes glob patterns', () => {
    expect(DEFAULT_IGNORE_GLOBS).toContain('node_modules/**');
    expect(DEFAULT_IGNORE_GLOBS).toContain('*.lock');
  });
});

describe('toGlobIgnore', () => {
  it('converts dir names to glob patterns', () => {
    expect(toGlobIgnore(['node_modules', 'dist'])).toEqual(['node_modules/**', 'dist/**']);
  });
});
