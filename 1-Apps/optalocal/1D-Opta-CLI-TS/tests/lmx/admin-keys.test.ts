import { describe, expect, it } from 'vitest';
import {
  normalizeAdminKeyHost,
  parseAdminKeysByHost,
  resolveAdminKeyForHost,
} from '../../src/lmx/admin-keys.js';

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
});
