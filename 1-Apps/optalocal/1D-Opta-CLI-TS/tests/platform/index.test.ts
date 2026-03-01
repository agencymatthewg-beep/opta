import { describe, expect, it } from 'vitest';
import {
  homedir,
  isBinaryAvailable,
  isLinux,
  isMacOS,
  isWindows,
  pathSep,
  shellArgs,
} from '../../src/platform/index.js';

describe('platform helpers', () => {
  it('detects exactly one platform family', () => {
    const flags = [isWindows, isMacOS, isLinux].filter(Boolean);
    expect(flags).toHaveLength(1);
  });

  it('returns non-empty home directory', () => {
    expect(homedir().length).toBeGreaterThan(0);
  });

  it('returns expected path separator', () => {
    expect(['/', '\\']).toContain(pathSep);
  });

  it('returns shell command tuple for current OS', () => {
    const [shell, flag] = shellArgs();
    if (isWindows) {
      expect(shell).toBe('cmd');
      expect(flag).toBe('/c');
    } else {
      expect(shell).toBe('sh');
      expect(flag).toBe('-c');
    }
  });

  it('finds node executable', async () => {
    await expect(isBinaryAvailable('node')).resolves.toBe(true);
  });

  it('returns false for non-existent executable', async () => {
    await expect(isBinaryAvailable('opta_nonexistent_binary_xyz_1234')).resolves.toBe(false);
  });
});
