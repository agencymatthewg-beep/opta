import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --- Mocks ---

const MOCK_CONFIG = {
  connection: { host: '192.168.188.11', port: 1234, protocol: 'http' },
  model: { default: 'test-model', contextLimit: 32768 },
  defaultMode: 'safe',
  permissions: { read_file: 'allow', edit_file: 'ask' },
  safety: { maxToolCalls: 30, compactAt: 0.7, circuitBreaker: {} },
  git: { autoCommit: true, checkpoints: true },
  mcp: { servers: {} },
  search: { searxngUrl: 'http://192.168.188.10:8888' },
  background: { maxConcurrent: 5, defaultTimeout: 300000, maxBufferSize: 1048576, killOnSessionEnd: true },
  hooks: [],
  lsp: { enabled: true, servers: {}, timeout: 10000 },
  subAgent: { enabled: true, maxDepth: 2, maxConcurrent: 1, defaultBudget: {}, inheritMode: true },
  context: { exportMap: true },
  tui: { default: false },
};

const mockLoadConfig = vi.fn().mockResolvedValue(MOCK_CONFIG);

vi.mock('../../src/core/config.js', () => ({
  loadConfig: mockLoadConfig,
}));

let output: string[] = [];
let errorOutput: string[] = [];
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  output = [];
  errorOutput = [];
  mockLoadConfig.mockResolvedValue(MOCK_CONFIG);
  logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    output.push(args.map(String).join(' '));
  });
  errorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errorOutput.push(args.map(String).join(' '));
  });
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

// --- checkNode ---

describe('checkNode', () => {
  it('passes for Node.js >= 20', async () => {
    const { checkNode } = await import('../../src/commands/doctor.js');
    const result = await checkNode();
    expect(result.status).toBe('pass');
    expect(result.message).toContain('Node.js');
    expect(result.name).toBe('Node.js');
  });
});

// --- checkLmxConnection ---

describe('checkLmxConnection', () => {
  it('returns pass when LMX is reachable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.endsWith('/healthz')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'ok' }),
          text: () => Promise.resolve('ok'),
        } as unknown as Response;
      }
      if (url.endsWith('/readyz')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({ models_loaded: 1 }),
          text: () => Promise.resolve('ready'),
        } as unknown as Response;
      }
      if (url.endsWith('/admin/models')) {
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            loaded: [{
              id: 'model-1',
              loaded: true,
              memory_gb: 1,
              loaded_at: 0,
              use_batching: false,
              request_count: 0,
              last_used_at: 0,
            }],
            count: 1,
          }),
          text: () => Promise.resolve('ok'),
        } as unknown as Response;
      }
      return {
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('not found'),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const { checkLmxConnection } = await import('../../src/commands/doctor.js');
    const result = await checkLmxConnection('localhost', 1234);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('LMX connected');
    expect(result.message).toContain('1 model loaded');

    globalThis.fetch = originalFetch;
  });

  it('returns fail when LMX is unreachable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { checkLmxConnection } = await import('../../src/commands/doctor.js');
    const result = await checkLmxConnection('localhost', 1234);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('unreachable');

    globalThis.fetch = originalFetch;
  });

  it('includes api key and fallback host guidance when unreachable', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { checkLmxConnection } = await import('../../src/commands/doctor.js');
    const result = await checkLmxConnection('localhost', 1234, undefined, ['mono512.local']);

    expect(result.status).toBe('fail');
    expect(result.detail).toContain('connection.apiKey');
    expect(result.detail).toContain('mono512.local');

    globalThis.fetch = originalFetch;
  });

  it('returns fail when LMX returns non-200', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    }) as unknown as typeof fetch;

    const { checkLmxConnection } = await import('../../src/commands/doctor.js');
    const result = await checkLmxConnection('localhost', 1234);

    expect(result.status).toBe('fail');
    expect(result.message).toContain('503');

    globalThis.fetch = originalFetch;
  });
});

// --- checkActiveModel ---

describe('checkActiveModel', () => {
  it('warns when no model is configured', async () => {
    const { checkActiveModel } = await import('../../src/commands/doctor.js');
    const result = await checkActiveModel('', 'localhost', 1234);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('No default model');
  });

  it('passes when model is configured and found', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ loaded: [{ id: 'qwen2.5-72b' }] }),
    }) as unknown as typeof fetch;

    const { checkActiveModel } = await import('../../src/commands/doctor.js');
    const result = await checkActiveModel('qwen2.5-72b', 'localhost', 1234);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('qwen2.5-72b');

    globalThis.fetch = originalFetch;
  });

  it('warns when model is configured but not loaded', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ loaded: [{ id: 'other-model' }] }),
    }) as unknown as typeof fetch;

    const { checkActiveModel } = await import('../../src/commands/doctor.js');
    const result = await checkActiveModel('missing-model', 'localhost', 1234);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('not found');

    globalThis.fetch = originalFetch;
  });
});

// --- checkConfig ---

describe('checkConfig', () => {
  it('passes with valid config', async () => {
    const { checkConfig } = await import('../../src/commands/doctor.js');
    const result = await checkConfig();

    expect(result.status).toBe('pass');
    expect(result.message).toBe('Config valid');
  });
});

// --- checkOpis ---

describe('checkOpis', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-doctor-opis-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('warns when APP.md is missing', async () => {
    const { checkOpis } = await import('../../src/commands/doctor.js');
    const result = await checkOpis(testDir);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('not initialized');
  });

  it('passes when APP.md exists', async () => {
    await writeFile(join(testDir, 'APP.md'), '# My Project');

    const { checkOpis } = await import('../../src/commands/doctor.js');
    const result = await checkOpis(testDir);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('OPIS initialized');
    expect(result.message).toContain('1 doc');
  });

  it('counts OPIS docs in docs/ directory', async () => {
    await writeFile(join(testDir, 'APP.md'), '# My Project');
    await mkdir(join(testDir, 'docs'), { recursive: true });
    await writeFile(join(testDir, 'docs', 'ARCHITECTURE.md'), '# Arch');
    await writeFile(join(testDir, 'docs', 'GUARDRAILS.md'), '# Guard');

    const { checkOpis } = await import('../../src/commands/doctor.js');
    const result = await checkOpis(testDir);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('3 docs');
  });
});

// --- checkGit ---

describe('checkGit', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-doctor-git-'));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('warns when not a git repo', async () => {
    const { checkGit } = await import('../../src/commands/doctor.js');
    const result = await checkGit(testDir);

    expect(result.status).toBe('warn');
    expect(result.message).toContain('Not a git repository');
  });

  it('passes when .git exists', async () => {
    await mkdir(join(testDir, '.git'), { recursive: true });

    // Mock execa to avoid real git calls
    vi.doMock('execa', () => ({
      execaCommand: vi.fn().mockResolvedValue({ stdout: '' }),
    }));

    // Re-import to pick up mock
    const { checkGit } = await import('../../src/commands/doctor.js');
    const result = await checkGit(testDir);

    expect(result.status).toBe('pass');
    expect(result.message).toContain('Git repository');
  });
});

// --- checkDiskUsage ---

describe('checkDiskUsage', () => {
  it('returns pass with session count', async () => {
    const { checkDiskUsage } = await import('../../src/commands/doctor.js');
    const result = await checkDiskUsage();

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Sessions');
    expect(result.message).toContain('Sessions:');
  });
});

describe('checkDiskHeadroom', () => {
  it('passes when minimum required space is tiny', async () => {
    const { checkDiskHeadroom } = await import('../../src/commands/doctor.js');
    const result = await checkDiskHeadroom(1);

    expect(result.status).toBe('pass');
    expect(result.name).toBe('Disk Headroom');
    expect(result.message).toContain('available');
  });

  it('fails when required space exceeds available headroom', async () => {
    const { checkDiskHeadroom } = await import('../../src/commands/doctor.js');
    const result = await checkDiskHeadroom(Number.MAX_SAFE_INTEGER);

    expect(result.status).toBe('fail');
    expect(result.name).toBe('Disk Headroom');
    expect(result.message).toContain('below required');
  });
});

// --- checkMcpServers ---

describe('checkMcpServers', () => {
  it('passes with no servers configured', async () => {
    const { checkMcpServers } = await import('../../src/commands/doctor.js');
    const result = await checkMcpServers({});

    expect(result.status).toBe('pass');
    expect(result.message).toContain('No MCP servers');
  });
});

// --- runDoctor --fix ---

describe('runDoctor --fix', () => {
  it('calls ensureDaemonRunning when daemon check fails and fix:true', async () => {
    const ensureDaemonRunningMock = vi.fn().mockResolvedValue({ pid: 42, port: 9999 });

    // Mock lifecycle so isDaemonRunning returns false (daemon is not running)
    vi.doMock('../../src/daemon/lifecycle.js', () => ({
      readDaemonState: vi.fn().mockResolvedValue(null),
      isDaemonRunning: vi.fn().mockResolvedValue(false),
      ensureDaemonRunning: ensureDaemonRunningMock,
    }));

    // Suppress fetch calls for LMX checks
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({ fix: true });

    expect(ensureDaemonRunningMock).toHaveBeenCalledTimes(1);

    globalThis.fetch = originalFetch;
    vi.doUnmock('../../src/daemon/lifecycle.js');
  });

  it('does NOT call fix functions when fix:false even if checks fail', async () => {
    const ensureDaemonRunningMock = vi.fn().mockResolvedValue({ pid: 42, port: 9999 });

    vi.doMock('../../src/daemon/lifecycle.js', () => ({
      readDaemonState: vi.fn().mockResolvedValue(null),
      isDaemonRunning: vi.fn().mockResolvedValue(false),
      ensureDaemonRunning: ensureDaemonRunningMock,
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({ fix: false });

    // fix() should not be invoked when fix option is false
    expect(ensureDaemonRunningMock).not.toHaveBeenCalled();

    globalThis.fetch = originalFetch;
    vi.doUnmock('../../src/daemon/lifecycle.js');
  });

  it('checks without fix functions still produce output under --fix', async () => {
    vi.doMock('../../src/daemon/lifecycle.js', () => ({
      readDaemonState: vi.fn().mockResolvedValue(null),
      isDaemonRunning: vi.fn().mockResolvedValue(false),
      ensureDaemonRunning: vi.fn().mockResolvedValue({ pid: 99, port: 9999 }),
    }));

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({ fix: true });

    const text = output.join('\n');
    // Node.js check always passes and has no fix — it must still appear in output
    expect(text).toContain('Node.js');

    globalThis.fetch = originalFetch;
    vi.doUnmock('../../src/daemon/lifecycle.js');
  });
});

// --- runDoctor (integration) ---

describe('runDoctor', () => {
  it('outputs text format by default', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({});

    const text = output.join('\n');
    expect(text).toContain('Opta Doctor');
    expect(text).toContain('Node.js');
    expect(text).toContain('passed');

    globalThis.fetch = originalFetch;
  });

  it('outputs JSON when --format json is set', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({ format: 'json' });

    const text = output.join('\n');
    const parsed = JSON.parse(text);

    expect(parsed).toHaveProperty('version');
    expect(parsed).toHaveProperty('checks');
    expect(parsed).toHaveProperty('summary');
    expect(Array.isArray(parsed.checks)).toBe(true);
    // runDoctor runs 13 checks: Node, LMX Connection, LMX Discovery, Active Model,
    // Config, Config Dirs, OPIS, MCP, Git, Daemon, Sessions, Disk Headroom, Account
    expect(parsed.checks.length).toBe(13);
    expect(parsed.summary).toHaveProperty('passed');
    expect(parsed.summary).toHaveProperty('warnings');
    expect(parsed.summary).toHaveProperty('failures');

    globalThis.fetch = originalFetch;
  });

  it('JSON output contains no ANSI escape codes', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({ format: 'json' });

    const text = output.join('\n');
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/\x1b\[/);

    globalThis.fetch = originalFetch;
  });

  it('includes all 10 checks in results', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const { runDoctor } = await import('../../src/commands/doctor.js');
    await runDoctor({ format: 'json' });

    const text = output.join('\n');
    const parsed = JSON.parse(text);

    const names = parsed.checks.map((c: { name: string }) => c.name);
    expect(names).toContain('Node.js');
    expect(names).toContain('LMX Connection');
    expect(names).toContain('Active Model');
    expect(names).toContain('Config');
    expect(names).toContain('OPIS');
    expect(names).toContain('MCP');
    expect(names).toContain('Git');
    expect(names).toContain('Sessions');
    expect(names).toContain('Disk Headroom');
    expect(names).toContain('Account');

    globalThis.fetch = originalFetch;
  });
});
