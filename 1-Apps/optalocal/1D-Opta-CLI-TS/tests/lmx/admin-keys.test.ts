import { describe, expect, it, vi } from 'vitest';
import {
  normalizeAdminKeyHost,
  parseAdminKeysByHost,
  resolveAdminKeyForHost,
} from '../../src/lmx/admin-keys.js';
import { detectLocalAdminKey, isLoopbackHost } from '../../src/lmx/local-config.js';

describe('admin-keys', () => {
  it('normalizes host keys for lookup', () => {
    expect(normalizeAdminKeyHost(' HTTPS://Opta48.lan:1234/path ')).toBe('opta48.lan:1234');
  });

  it('parses JSON map input', () => {
    const parsed = parseAdminKeysByHost(
      '{"192.168.188.11":"key-a","https://Opta48.lan:1234":"key-b"}'
    );
    expect(parsed).toEqual({
      '192.168.188.11': 'key-a',
      'opta48.lan:1234': 'key-b',
    });
  });

  it('parses host=key CSV input', () => {
    const parsed = parseAdminKeysByHost('192.168.188.11=key-a, opta48.lan:1234=key-b');
    expect(parsed).toEqual({
      '192.168.188.11': 'key-a',
      'opta48.lan:1234': 'key-b',
    });
  });

  it('resolves host-specific key before default', () => {
    const resolved = resolveAdminKeyForHost('192.168.188.11', 1234, {
      defaultAdminKey: 'default-key',
      adminKeysByHost: {
        '192.168.188.11': 'host-key',
      },
    });
    expect(resolved).toBe('host-key');
  });

  it('matches host-only map entries when probe host includes port', () => {
    const resolved = resolveAdminKeyForHost('192.168.188.11:1234', 1234, {
      defaultAdminKey: 'default-key',
      adminKeysByHost: {
        '192.168.188.11': 'host-only-key',
      },
    });
    expect(resolved).toBe('host-only-key');
  });

  describe('detectLocalAdminKey', () => {
    it('prefers OPTA_ADMIN_KEY env before reading local config', async () => {
      const readFile = vi.fn();
      const result = await detectLocalAdminKey({
        env: { OPTA_ADMIN_KEY: '  env-key  ' },
        readFile,
        homedir: () => '/Users/tester',
      });
      expect(result).toEqual({ key: 'env-key', source: 'env' });
      expect(readFile).not.toHaveBeenCalled();
    });

    it('parses security.admin_key from ~/.opta-lmx/config.yaml', async () => {
      const readFile = vi.fn().mockImplementation(async (path: string) => {
        expect(path).toBe('/Users/cli/.opta-lmx/config.yaml');
        return 'security:\n  admin_key: "  yaml-key  "\n';
      });
      const result = await detectLocalAdminKey({
        env: {},
        homedir: () => '/Users/cli',
        readFile,
      });
      expect(result).toEqual({
        key: 'yaml-key',
        source: 'local-config',
        path: '/Users/cli/.opta-lmx/config.yaml',
      });
    });

    it('returns none when config file missing or malformed', async () => {
      const enoent = Object.assign(new Error('missing'), { code: 'ENOENT' });
      const readFile = vi.fn().mockRejectedValue(enoent);
      const result = await detectLocalAdminKey({
        env: {},
        homedir: () => '/Users/ghost',
        readFile,
      });
      expect(result).toEqual({ key: undefined, source: 'none' });
    });
  });

  describe('isLoopbackHost', () => {
    it('detects localhost variants', () => {
      expect(isLoopbackHost('localhost')).toBe(true);
      expect(isLoopbackHost('127.0.0.1')).toBe(true);
      expect(isLoopbackHost('127.32.0.9')).toBe(true);
      expect(isLoopbackHost('::1')).toBe(true);
    });

    it('rejects LAN hosts', () => {
      expect(isLoopbackHost('192.168.1.10')).toBe(false);
      expect(isLoopbackHost('opta48.lan')).toBe(false);
    });
  });
});
