import { describe, expect, it } from 'vitest';
import { posix, win32 } from 'node:path';
import { isPathWithinBase } from '../../src/platform/path-safety.js';

describe('isPathWithinBase (POSIX)', () => {
  it('allows identical base and target paths', () => {
    expect(isPathWithinBase('/repo/project', '/repo/project', posix)).toBe(true);
  });

  it('allows nested paths under the base', () => {
    expect(isPathWithinBase('/repo/project/src/index.ts', '/repo/project', posix)).toBe(true);
  });

  it('rejects sibling prefix paths', () => {
    expect(isPathWithinBase('/repo/project-evil/file.ts', '/repo/project', posix)).toBe(false);
  });

  it('rejects parent traversal', () => {
    expect(isPathWithinBase('/repo/other/file.ts', '/repo/project', posix)).toBe(false);
  });
});

describe('isPathWithinBase (Windows)', () => {
  it('allows nested paths on the same drive', () => {
    expect(isPathWithinBase('C:\\repo\\project\\src\\index.ts', 'C:\\repo\\project', win32)).toBe(
      true
    );
  });

  it('rejects sibling prefix paths', () => {
    expect(isPathWithinBase('C:\\repo\\project-evil\\file.ts', 'C:\\repo\\project', win32)).toBe(
      false
    );
  });

  it('rejects cross-drive targets', () => {
    expect(isPathWithinBase('D:\\repo\\project\\file.ts', 'C:\\repo\\project', win32)).toBe(
      false
    );
  });

  it('rejects parent traversal paths', () => {
    expect(isPathWithinBase('C:\\repo\\other\\file.ts', 'C:\\repo\\project', win32)).toBe(false);
  });
});
