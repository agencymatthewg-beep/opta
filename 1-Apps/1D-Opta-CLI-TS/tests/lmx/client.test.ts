import { describe, it, expect } from 'vitest';
import { lookupContextLimit, LmxClient } from '../../src/lmx/client.js';

describe('lookupContextLimit', () => {
  it('returns known limit for glm-4.7-flash', () => {
    expect(lookupContextLimit('glm-4.7-flash')).toBe(128_000);
  });

  it('returns known limit for qwen2.5-72b', () => {
    expect(lookupContextLimit('qwen2.5-72b')).toBe(32_768);
  });

  it('matches case-insensitively', () => {
    expect(lookupContextLimit('GLM-4.7-Flash')).toBe(128_000);
    expect(lookupContextLimit('Qwen2.5-72B')).toBe(32_768);
  });

  it('matches partial model IDs', () => {
    expect(lookupContextLimit('some-prefix-qwen2.5-72b-q4')).toBe(32_768);
  });

  it('returns 32768 for unknown models', () => {
    expect(lookupContextLimit('unknown-model-xyz')).toBe(32_768);
  });

  it('returns known limit for wizardlm', () => {
    expect(lookupContextLimit('wizardlm')).toBe(4_096);
  });

  it('returns known limit for gemma-3-4b', () => {
    expect(lookupContextLimit('gemma-3-4b')).toBe(8_192);
  });
});

describe('LmxClient', () => {
  it('constructs with host and port', () => {
    const client = new LmxClient({ host: '192.168.188.11', port: 8000 });
    expect(client).toBeDefined();
  });

  it('constructs with optional adminKey', () => {
    const client = new LmxClient({
      host: '192.168.188.11',
      port: 8000,
      adminKey: 'test-key',
    });
    expect(client).toBeDefined();
  });

  it('rejects health check against unreachable host', async () => {
    const client = new LmxClient({ host: '127.0.0.1', port: 1 });
    await expect(client.health()).rejects.toThrow();
  });
});
