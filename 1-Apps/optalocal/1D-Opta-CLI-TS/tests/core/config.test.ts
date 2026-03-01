import { describe, it, expect } from 'vitest';
import { OptaConfigSchema, DEFAULT_CONFIG } from '../../src/core/config.js';

describe('config', () => {
  it('produces valid defaults', () => {
    expect(DEFAULT_CONFIG.connection.host).toBe('localhost');
    expect(DEFAULT_CONFIG.connection.fallbackHosts).toEqual([]);
    expect(DEFAULT_CONFIG.connection.port).toBe(1234);
    expect(DEFAULT_CONFIG.connection.protocol).toBe('http');
    expect(DEFAULT_CONFIG.connection.apiKey).toBeUndefined();
    expect(DEFAULT_CONFIG.search.searxngUrl).toBe('http://localhost:8081');
    expect(DEFAULT_CONFIG.model.default).toBe('');
    expect(DEFAULT_CONFIG.model.contextLimit).toBe(32768);
    expect(DEFAULT_CONFIG.autonomy.level).toBe(2);
    expect(DEFAULT_CONFIG.autonomy.mode).toBe('execution');
    expect(DEFAULT_CONFIG.autonomy.enforceProfile).toBe(true);
    expect(DEFAULT_CONFIG.autonomy.objectiveReassessment).toBe(true);
    expect(DEFAULT_CONFIG.computerControl.foreground.enabled).toBe(false);
    expect(DEFAULT_CONFIG.computerControl.foreground.requireDangerousMode).toBe(true);
    expect(DEFAULT_CONFIG.computerControl.foreground.allowScreenActions).toBe(false);
    expect(DEFAULT_CONFIG.computerControl.background.enabled).toBe(true);
    expect(DEFAULT_CONFIG.computerControl.background.allowBrowserSessionHosting).toBe(true);
    expect(DEFAULT_CONFIG.computerControl.background.allowScreenStreaming).toBe(true);
    expect(DEFAULT_CONFIG.computerControl.background.maxHostedBrowserSessions).toBe(5);
    expect(DEFAULT_CONFIG.safety.maxToolCalls).toBe(30);
    expect(DEFAULT_CONFIG.safety.compactAt).toBe(0.7);
    expect(DEFAULT_CONFIG.journal.enabled).toBe(true);
    expect(DEFAULT_CONFIG.journal.sessionLogsDir).toBe('12-Session-Logs');
    expect(DEFAULT_CONFIG.journal.updateLogsDir).toBe('updates');
    expect(DEFAULT_CONFIG.journal.timezone).toBe('local');
    expect(DEFAULT_CONFIG.tui.triggerModes.length).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.tui.skillRuntime.dynamicLoading).toBe(true);
    expect(DEFAULT_CONFIG.tui.skillRuntime.unloadInactive).toBe(true);
    expect(DEFAULT_CONFIG.tui.responseIntentTone).toBe('technical');
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
    expect(config.connection.fallbackHosts).toEqual([]);
    expect(config.connection.port).toBe(1234); // default preserved
    expect(config.model.default).toBe(''); // default preserved
    expect(config.autonomy.level).toBe(2);
    expect(config.autonomy.mode).toBe('execution');
  });

  it('accepts fallback host list for LMX endpoint failover', () => {
    const config = OptaConfigSchema.parse({
      connection: {
        host: 'mono512',
        fallbackHosts: ['192.168.188.11', 'mono512.local'],
      },
    });
    expect(config.connection.host).toBe('mono512');
    expect(config.connection.fallbackHosts).toEqual(['192.168.188.11', 'mono512.local']);
  });

  it('accepts optional LMX connection api key', () => {
    const config = OptaConfigSchema.parse({
      connection: {
        apiKey: 'lmx-key',
      },
    });
    expect(config.connection.apiKey).toBe('lmx-key');
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

  it('accepts tui trigger and skill runtime overrides', () => {
    const config = OptaConfigSchema.parse({
      tui: {
        triggerModes: [
          {
            word: 'audit',
            modeHint: 'review',
            priority: 900,
            capabilities: ['review'],
            skills: ['code-reviewer'],
          },
        ],
        skillRuntime: {
          dynamicLoading: true,
          unloadInactive: false,
          ttlMinutes: 45,
          maxActiveSkills: 40,
        },
        responseIntentTone: 'product',
      },
    });

    expect(config.tui.triggerModes).toEqual([
      {
        word: 'audit',
        modeHint: 'review',
        priority: 900,
        capabilities: ['review'],
        skills: ['code-reviewer'],
      },
    ]);
    expect(config.tui.skillRuntime).toEqual({
      dynamicLoading: true,
      unloadInactive: false,
      ttlMinutes: 45,
      maxActiveSkills: 40,
    });
    expect(config.tui.responseIntentTone).toBe('product');
  });

  it('rejects invalid response intent tone', () => {
    expect(() => OptaConfigSchema.parse({
      tui: {
        responseIntentTone: 'casual',
      },
    })).toThrow();
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

  it('has correct SSH config defaults', () => {
    expect(DEFAULT_CONFIG.connection.ssh.user).toBe('opta');
    expect(DEFAULT_CONFIG.connection.ssh.identityFile).toBe('~/.ssh/id_ed25519');
    expect(DEFAULT_CONFIG.connection.ssh.connectTimeoutSec).toBe(20);
    expect(DEFAULT_CONFIG.connection.ssh.lmxPath).toBe('/Users/Shared/312/Opta/1-Apps/1M-Opta-LMX');
    expect(DEFAULT_CONFIG.connection.ssh.pythonPath).toBe('/Users/opta/.mlx-env/bin/python');
  });

  it('has research defaults with all providers', () => {
    expect(DEFAULT_CONFIG.research.enabled).toBe(true);
    expect(DEFAULT_CONFIG.research.defaultProvider).toBe('auto');
    expect(DEFAULT_CONFIG.research.alwaysIncludeDocumentation).toBe(true);
    expect(DEFAULT_CONFIG.research.providers.tavily.enabled).toBe(false);
    expect(DEFAULT_CONFIG.research.providers.gemini.enabled).toBe(false);
    expect(DEFAULT_CONFIG.research.providers.exa.enabled).toBe(false);
    expect(DEFAULT_CONFIG.research.providers.brave.enabled).toBe(false);
    expect(DEFAULT_CONFIG.research.providers.groq.enabled).toBe(false);
  });

  it('has browser defaults for dual-mode foundation', () => {
    expect(DEFAULT_CONFIG.browser.enabled).toBe(false);
    expect(DEFAULT_CONFIG.browser.mode).toBe('isolated');
    expect(DEFAULT_CONFIG.browser.autoInvoke).toBe(false);
    expect(DEFAULT_CONFIG.browser.attach.enabled).toBe(false);
    expect(DEFAULT_CONFIG.browser.attach.requireApproval).toBe(true);
    expect(DEFAULT_CONFIG.browser.screenshotPolicy).toBe('on-demand');
    expect(DEFAULT_CONFIG.browser.runtime.enabled).toBe(true);
    expect(DEFAULT_CONFIG.browser.runtime.persistSessions).toBe(true);
    expect(DEFAULT_CONFIG.browser.runtime.persistProfileContinuity).toBe(false);
    expect(DEFAULT_CONFIG.browser.runtime.maxSessions).toBe(3);
    expect(DEFAULT_CONFIG.browser.runtime.profileRetentionDays).toBe(30);
    expect(DEFAULT_CONFIG.browser.runtime.maxPersistedProfiles).toBe(200);
    expect(DEFAULT_CONFIG.browser.runtime.profilePruneIntervalHours).toBe(24);
    expect(DEFAULT_CONFIG.browser.runtime.runCorpus.enabled).toBe(true);
    expect(DEFAULT_CONFIG.browser.runtime.runCorpus.windowHours).toBe(168);
    expect(DEFAULT_CONFIG.browser.policy.requireApprovalForHighRisk).toBe(true);
    expect(DEFAULT_CONFIG.browser.policy.allowedHosts).toEqual(['*']);
    expect(DEFAULT_CONFIG.browser.artifacts.enabled).toBe(true);
    expect(DEFAULT_CONFIG.browser.artifacts.screenshots).toBe('on_step');
    expect(DEFAULT_CONFIG.browser.artifacts.retention.enabled).toBe(false);
    expect(DEFAULT_CONFIG.browser.artifacts.retention.retentionDays).toBe(30);
    expect(DEFAULT_CONFIG.browser.artifacts.retention.maxPersistedSessions).toBe(200);
    expect(DEFAULT_CONFIG.browser.artifacts.retention.pruneIntervalHours).toBe(24);
  });

  it('accepts browser runtime retention policy overrides', () => {
    const config = OptaConfigSchema.parse({
      browser: {
        runtime: {
          profileRetentionDays: 90,
          maxPersistedProfiles: 500,
          profilePruneIntervalHours: 12,
          runCorpus: {
            enabled: false,
            windowHours: 72,
          },
        },
      },
    });
    expect(config.browser.runtime.profileRetentionDays).toBe(90);
    expect(config.browser.runtime.maxPersistedProfiles).toBe(500);
    expect(config.browser.runtime.profilePruneIntervalHours).toBe(12);
    expect(config.browser.runtime.runCorpus.enabled).toBe(false);
    expect(config.browser.runtime.runCorpus.windowHours).toBe(72);
  });

  it('accepts browser artifact retention policy overrides', () => {
    const config = OptaConfigSchema.parse({
      browser: {
        artifacts: {
          retention: {
            enabled: true,
            retentionDays: 45,
            maxPersistedSessions: 250,
            pruneIntervalHours: 6,
          },
        },
      },
    });
    expect(config.browser.artifacts.retention.enabled).toBe(true);
    expect(config.browser.artifacts.retention.retentionDays).toBe(45);
    expect(config.browser.artifacts.retention.maxPersistedSessions).toBe(250);
    expect(config.browser.artifacts.retention.pruneIntervalHours).toBe(6);
  });

  it('has learning defaults for hybrid capture governance', () => {
    expect(DEFAULT_CONFIG.learning.enabled).toBe(true);
    expect(DEFAULT_CONFIG.learning.captureLevel).toBe('exhaustive');
    expect(DEFAULT_CONFIG.learning.governor.mode).toBe('hybrid');
    expect(DEFAULT_CONFIG.learning.governor.autoCalibrate).toBe(true);
    expect(DEFAULT_CONFIG.learning.includeUnverified).toBe(true);
  });

  it('has policy defaults for full fail-closed governance', () => {
    expect(DEFAULT_CONFIG.policy.enabled).toBe(true);
    expect(DEFAULT_CONFIG.policy.mode).toBe('full');
    expect(DEFAULT_CONFIG.policy.gateAllAutonomy).toBe(true);
    expect(DEFAULT_CONFIG.policy.failureMode).toBe('closed');
    expect(DEFAULT_CONFIG.policy.audit.enabled).toBe(true);
  });

  it('accepts provider-specific research key configuration', () => {
    const config = OptaConfigSchema.parse({
      research: {
        providers: {
          tavily: {
            enabled: true,
            apiKey: 'tvly-dev-key',
            timeoutMs: 22000,
          },
        },
      },
    });
    expect(config.research.providers.tavily.enabled).toBe(true);
    expect(config.research.providers.tavily.apiKey).toBe('tvly-dev-key');
    expect(config.research.providers.tavily.timeoutMs).toBe(22000);
  });

  it('rejects invalid research default provider', () => {
    expect(() =>
      OptaConfigSchema.parse({
        research: { defaultProvider: 'bing' },
      })
    ).toThrow();
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
