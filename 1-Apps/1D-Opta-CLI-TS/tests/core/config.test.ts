import { describe, it, expect } from 'vitest';
import { OptaConfigSchema, DEFAULT_CONFIG } from '../../src/core/config.js';

describe('config', () => {
  it('produces valid defaults', () => {
    expect(DEFAULT_CONFIG.connection.host).toBe('192.168.188.11');
    expect(DEFAULT_CONFIG.connection.port).toBe(1234);
    expect(DEFAULT_CONFIG.connection.protocol).toBe('http');
    expect(DEFAULT_CONFIG.model.default).toBe('');
    expect(DEFAULT_CONFIG.model.contextLimit).toBe(32768);
    expect(DEFAULT_CONFIG.safety.maxToolCalls).toBe(30);
    expect(DEFAULT_CONFIG.safety.compactAt).toBe(0.7);
  });

  it('has correct default permissions', () => {
    expect(DEFAULT_CONFIG.permissions['read_file']).toBe('allow');
    expect(DEFAULT_CONFIG.permissions['edit_file']).toBe('ask');
    expect(DEFAULT_CONFIG.permissions['run_command']).toBe('ask');
    expect(DEFAULT_CONFIG.permissions['ask_user']).toBe('allow');
  });

  it('validates partial config with defaults', () => {
    const config = OptaConfigSchema.parse({
      connection: { host: '10.0.0.1' },
    });
    expect(config.connection.host).toBe('10.0.0.1');
    expect(config.connection.port).toBe(1234); // default preserved
    expect(config.model.default).toBe(''); // default preserved
  });

  it('rejects invalid permission values', () => {
    expect(() =>
      OptaConfigSchema.parse({
        permissions: { read_file: 'execute' },
      })
    ).toThrow();
  });
});
