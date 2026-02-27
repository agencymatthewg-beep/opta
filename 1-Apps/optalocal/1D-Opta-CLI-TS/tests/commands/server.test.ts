import { describe, it, expect } from 'vitest';

describe('server mode', () => {
  it('should be importable', async () => {
    const mod = await import('../../src/commands/server.js');
    expect(mod.startServer).toBeDefined();
  });

  it('should export createServerHandler', async () => {
    const mod = await import('../../src/commands/server.js');
    expect(mod.createServerHandler).toBeDefined();
  });

  it('should handle /health endpoint', async () => {
    const { createServerHandler } = await import('../../src/commands/server.js');
    const handler = createServerHandler({ model: 'test-model', host: 'localhost', port: 1234 });

    // Simulate a health request
    const result = handler.handleHealth();
    expect(result.status).toBe('ok');
    expect(result.model).toBe('test-model');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('should use VERSION from version module instead of hardcoded string', async () => {
    const { createServerHandler } = await import('../../src/commands/server.js');
    const { VERSION } = await import('../../src/core/version.js');
    const handler = createServerHandler({ model: 'test-model', host: 'localhost', port: 1234 });

    const result = handler.handleHealth();
    expect(result.version).toBe(VERSION);
    // Ensure it matches semver pattern (not a stale hardcoded value)
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should validate chat request body', async () => {
    const { createServerHandler } = await import('../../src/commands/server.js');
    const handler = createServerHandler({ model: 'test-model', host: 'localhost', port: 1234 });

    // Missing message field
    const result = handler.validateChatRequest({});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('message');
  });

  it('should accept valid chat request body', async () => {
    const { createServerHandler } = await import('../../src/commands/server.js');
    const handler = createServerHandler({ model: 'test-model', host: 'localhost', port: 1234 });

    const result = handler.validateChatRequest({ message: 'hello' });
    expect(result.valid).toBe(true);
    expect(result.message).toBe('hello');
  });

  it('should accept chat request with optional session_id', async () => {
    const { createServerHandler } = await import('../../src/commands/server.js');
    const handler = createServerHandler({ model: 'test-model', host: 'localhost', port: 1234 });

    const result = handler.validateChatRequest({ message: 'hello', session_id: 'abc123' });
    expect(result.valid).toBe(true);
    expect(result.sessionId).toBe('abc123');
  });
});
