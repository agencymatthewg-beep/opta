import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertWithinCwd } from '../../src/core/tools/executors.js';

describe('assertWithinCwd', () => {
  it('allows paths inside cwd', () => {
    expect(() => assertWithinCwd(resolve(process.cwd(), 'package.json'))).not.toThrow();
  });

  it('allows exact cwd', () => {
    expect(() => assertWithinCwd(process.cwd())).not.toThrow();
  });

  it('blocks outside paths', () => {
    expect(() => assertWithinCwd(resolve(process.cwd(), '..', '..'))).toThrow(
      'Path traversal blocked'
    );
  });

  it('blocks fake prefix paths', () => {
    expect(() => assertWithinCwd(`${process.cwd()}-other`)).toThrow('Path traversal blocked');
  });
});
