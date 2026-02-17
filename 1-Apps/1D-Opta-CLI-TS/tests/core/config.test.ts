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

  it('has git defaults', () => {
    expect(DEFAULT_CONFIG.git.autoCommit).toBe(true);
    expect(DEFAULT_CONFIG.git.checkpoints).toBe(true);
  });

  it('validates partial git config', () => {
    const config = OptaConfigSchema.parse({
      git: { autoCommit: false },
    });
    expect(config.git.autoCommit).toBe(false);
    expect(config.git.checkpoints).toBe(true); // default preserved
  });

  it('rejects invalid permission values', () => {
    expect(() =>
      OptaConfigSchema.parse({
        permissions: { read_file: 'execute' },
      })
    ).toThrow();
  });

  it('has insight defaults', () => {
    expect(DEFAULT_CONFIG.insights.enabled).toBe(true);
  });

  it('can disable insights', () => {
    const config = OptaConfigSchema.parse({ insights: { enabled: false } });
    expect(config.insights.enabled).toBe(false);
  });

  it('has connection retry defaults', () => {
    expect(DEFAULT_CONFIG.connection.retry.maxRetries).toBe(3);
    expect(DEFAULT_CONFIG.connection.retry.backoffMs).toBe(1000);
    expect(DEFAULT_CONFIG.connection.retry.backoffMultiplier).toBe(2);
  });
});

describe('MCP config schema', () => {
  it('defaults to empty servers object', () => {
    const config = OptaConfigSchema.parse({});
    expect(config.mcp).toEqual({ servers: {} });
  });

  it('accepts stdio server config', () => {
    const config = OptaConfigSchema.parse({
      mcp: {
        servers: {
          filesystem: {
            transport: 'stdio',
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
            env: { DEBUG: '1' },
          },
        },
      },
    });
    expect(config.mcp.servers['filesystem']).toEqual({
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: { DEBUG: '1' },
    });
  });

  it('accepts http server config', () => {
    const config = OptaConfigSchema.parse({
      mcp: {
        servers: {
          remote: {
            transport: 'http',
            url: 'https://mcp.example.com/sse',
          },
        },
      },
    });
    expect(config.mcp.servers['remote']).toEqual({
      transport: 'http',
      url: 'https://mcp.example.com/sse',
    });
  });

  it('rejects invalid transport type', () => {
    expect(() =>
      OptaConfigSchema.parse({
        mcp: {
          servers: {
            bad: {
              transport: 'grpc',
              command: 'foo',
            },
          },
        },
      })
    ).toThrow();
  });
});

describe('hooks config schema', () => {
  it('parses hooks from config', () => {
    const c = OptaConfigSchema.parse({
      hooks: [{ event: 'tool.pre', command: 'echo hi', matcher: 'edit_file' }],
    });
    expect(c.hooks).toHaveLength(1);
    expect(c.hooks[0]!.event).toBe('tool.pre');
    expect(c.hooks[0]!.command).toBe('echo hi');
    expect(c.hooks[0]!.matcher).toBe('edit_file');
  });

  it('rejects invalid event name', () => {
    expect(() =>
      OptaConfigSchema.parse({
        hooks: [{ event: 'invalid', command: 'x' }],
      })
    ).toThrow();
  });

  it('defaults to empty array', () => {
    expect(OptaConfigSchema.parse({}).hooks).toEqual([]);
  });

  it('accepts all valid event types', () => {
    const events = ['session.start', 'session.end', 'tool.pre', 'tool.post', 'compact', 'error'];
    const hooks = events.map((event) => ({ event, command: 'echo test' }));
    const c = OptaConfigSchema.parse({ hooks });
    expect(c.hooks).toHaveLength(6);
  });

  it('validates timeout constraints', () => {
    // Valid timeout
    const c = OptaConfigSchema.parse({
      hooks: [{ event: 'tool.pre', command: 'echo hi', timeout: 5000 }],
    });
    expect(c.hooks[0]!.timeout).toBe(5000);

    // Too low
    expect(() =>
      OptaConfigSchema.parse({
        hooks: [{ event: 'tool.pre', command: 'echo hi', timeout: 50 }],
      })
    ).toThrow();

    // Too high
    expect(() =>
      OptaConfigSchema.parse({
        hooks: [{ event: 'tool.pre', command: 'echo hi', timeout: 100000 }],
      })
    ).toThrow();
  });

  it('accepts background flag', () => {
    const c = OptaConfigSchema.parse({
      hooks: [{ event: 'session.end', command: 'git commit', background: true }],
    });
    expect(c.hooks[0]!.background).toBe(true);
  });
});
