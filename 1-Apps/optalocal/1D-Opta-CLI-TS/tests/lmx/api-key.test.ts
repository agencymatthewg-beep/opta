import { afterEach, describe, expect, it } from 'vitest';
import { resolveLmxApiKey } from '../../src/lmx/api-key.js';

const ORIGINAL_OPTA_API_KEY = process.env['OPTA_API_KEY'];

afterEach(() => {
  if (ORIGINAL_OPTA_API_KEY === undefined) {
    delete process.env['OPTA_API_KEY'];
    return;
  }
  process.env['OPTA_API_KEY'] = ORIGINAL_OPTA_API_KEY;
});

describe('resolveLmxApiKey', () => {
  it('uses connection.apiKey when provided', () => {
    delete process.env['OPTA_API_KEY'];
    expect(resolveLmxApiKey({ apiKey: 'cfg-key' })).toBe('cfg-key');
  });

  it('falls back to opta-lmx when connection.apiKey is absent', () => {
    delete process.env['OPTA_API_KEY'];
    expect(resolveLmxApiKey({})).toBe('opta-lmx');
  });

  it('uses OPTA_API_KEY over connection.apiKey', () => {
    process.env['OPTA_API_KEY'] = 'env-key';
    expect(resolveLmxApiKey({ apiKey: 'cfg-key' })).toBe('env-key');
  });
});
