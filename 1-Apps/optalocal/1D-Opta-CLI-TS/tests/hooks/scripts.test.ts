import { describe, it, expect } from 'vitest';
import { existsSync, accessSync, constants, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HOOKS_DIR = resolve(import.meta.dirname, '../../.opta/hooks');

describe('built-in hook scripts', () => {
  const scripts = ['block-rm.sh', 'auto-lint.sh', 'auto-test.sh'];

  for (const script of scripts) {
    const path = resolve(HOOKS_DIR, script);

    it(`${script} exists`, () => {
      expect(existsSync(path)).toBe(true);
    });

    it(`${script} is executable`, () => {
      expect(() => accessSync(path, constants.X_OK)).not.toThrow();
    });

    it(`${script} starts with shebang`, () => {
      const content = readFileSync(path, 'utf8');
      expect(content.startsWith('#!/bin/bash')).toBe(true);
    });
  }

  it('block-rm.sh checks OPTA_TOOL_ARGS for destructive rm', () => {
    const content = readFileSync(resolve(HOOKS_DIR, 'block-rm.sh'), 'utf8');
    expect(content).toContain('OPTA_TOOL_ARGS');
    expect(content).toContain('rm');
    expect(content).toContain('exit 1');
  });

  it('auto-lint.sh runs eslint or ruff based on extension', () => {
    const content = readFileSync(resolve(HOOKS_DIR, 'auto-lint.sh'), 'utf8');
    expect(content).toContain('eslint');
    expect(content).toContain('OPTA_TOOL_ARGS');
  });

  it('auto-test.sh runs tests for TypeScript files', () => {
    const content = readFileSync(resolve(HOOKS_DIR, 'auto-test.sh'), 'utf8');
    expect(content).toContain('npm test');
    expect(content).toContain('OPTA_TOOL_ARGS');
  });
});
