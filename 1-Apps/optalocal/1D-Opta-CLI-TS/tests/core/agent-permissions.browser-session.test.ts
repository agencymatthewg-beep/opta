import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveToolDecisions } from '../../src/core/agent-permissions.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { createHookManager } from '../../src/hooks/integration.js';

const runtimeDaemon = vi.hoisted(() => {
  const daemon = {
    start: vi.fn(),
    health: vi.fn(),
    openSession: vi.fn(),
  };
  return {
    daemon,
    getSharedBrowserRuntimeDaemon: vi.fn(async () => daemon),
  };
});

vi.mock('../../src/browser/runtime-daemon.js', () => ({
  getSharedBrowserRuntimeDaemon: runtimeDaemon.getSharedBrowserRuntimeDaemon,
}));

function makeRuntimeHealth(
  sessionIds: Array<string | { sessionId: string; currentUrl?: string }>,
) {
  const normalized = sessionIds.map((entry) => (
    typeof entry === 'string'
      ? { sessionId: entry, currentUrl: undefined }
      : entry
  ));
  return {
    running: true,
    paused: false,
    killed: false,
    maxSessions: 3,
    sessionCount: normalized.length,
    recoveredSessionIds: [],
    profilePrune: {
      enabled: false,
      inFlight: false,
    },
    sessions: normalized.map((session) => ({
      sessionId: session.sessionId,
      mode: 'isolated' as const,
      status: 'open' as const,
      runtime: 'playwright' as const,
      currentUrl: session.currentUrl,
      updatedAt: '2026-02-24T00:00:00.000Z',
    })),
  };
}

function makeOpenSessionResult(sessionId: string) {
  return {
    ok: true,
    action: {
      id: 'action-open-1',
      sessionId,
      type: 'openSession' as const,
      createdAt: '2026-02-24T00:00:00.000Z',
      input: {},
    },
    data: {
      id: sessionId,
      mode: 'isolated' as const,
      status: 'open' as const,
      runtime: 'playwright' as const,
      createdAt: '2026-02-24T00:00:00.000Z',
      updatedAt: '2026-02-24T00:00:00.000Z',
      artifactsDir: '.opta/browser/sessions',
    },
  };
}

function makeConfig() {
  const config = structuredClone(DEFAULT_CONFIG);
  config.browser.enabled = true;
  config.policy.gateAllAutonomy = false;
  config.policy.audit.enabled = false;
  return config;
}

beforeEach(() => {
  vi.clearAllMocks();
  runtimeDaemon.daemon.start.mockResolvedValue(undefined);
  runtimeDaemon.daemon.health.mockReturnValue(makeRuntimeHealth([]));
  runtimeDaemon.daemon.openSession.mockResolvedValue(makeOpenSessionResult('sess-auto-001'));
});

describe('resolveToolDecisions browser session preflight', () => {
  it('scans runtime and prompts to spawn browser when no active sessions exist', async () => {
    const config = makeConfig();
    const onPermissionRequest = vi
      .fn()
      .mockResolvedValueOnce('allow')
      .mockResolvedValueOnce('allow');

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-1',
          name: 'browser_navigate',
          args: JSON.stringify({ url: 'https://example.com' }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: { onPermissionRequest },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(onPermissionRequest).toHaveBeenNthCalledWith(
      1,
      'browser_open',
      expect.objectContaining({
        __opta_spawn_prompt: true,
        __opta_spawn_trigger_tool: 'browser_navigate',
        __opta_session_scan_count: 0,
      }),
    );
    expect(onPermissionRequest).toHaveBeenNthCalledWith(
      2,
      'browser_navigate',
      expect.objectContaining({
        session_id: 'sess-auto-001',
        url: 'https://example.com',
      }),
    );
    expect(runtimeDaemon.daemon.openSession).toHaveBeenCalledTimes(1);
    expect(runtimeDaemon.daemon.start).toHaveBeenCalledTimes(1);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);
    const args = JSON.parse(decisions[0]?.executionArgsJson ?? '{}') as Record<string, unknown>;
    expect(args['session_id']).toBe('sess-auto-001');
  });

  it('spawns attach browser sessions using configured wsEndpoint when attach mode is enabled', async () => {
    const config = makeConfig();
    config.browser.attach.enabled = true;
    config.browser.attach.wsEndpoint = 'ws://127.0.0.1:9222/devtools/browser/mock';
    const onPermissionRequest = vi
      .fn()
      .mockResolvedValueOnce('allow')
      .mockResolvedValueOnce('allow');

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-attach-1',
          name: 'browser_navigate',
          args: JSON.stringify({ url: 'https://example.com' }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: { onPermissionRequest },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(onPermissionRequest).toHaveBeenNthCalledWith(
      1,
      'browser_open',
      expect.objectContaining({
        mode: 'attach',
        ws_endpoint: 'ws://127.0.0.1:9222/devtools/browser/mock',
      }),
    );
    expect(runtimeDaemon.daemon.openSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'attach',
        wsEndpoint: 'ws://127.0.0.1:9222/devtools/browser/mock',
      }),
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);
  });

  it('denies browser spawn when attach mode is enabled but wsEndpoint is missing', async () => {
    const config = makeConfig();
    config.browser.attach.enabled = true;
    config.browser.attach.wsEndpoint = '';
    const onPermissionRequest = vi.fn();

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-attach-missing-endpoint',
          name: 'browser_navigate',
          args: JSON.stringify({ url: 'https://example.com' }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: { onPermissionRequest },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(onPermissionRequest).not.toHaveBeenCalled();
    expect(runtimeDaemon.daemon.openSession).not.toHaveBeenCalled();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(false);
    expect(decisions[0]?.denialReason).toContain('browser.attach.wsEndpoint');
  });

  it('denies the tool call when the user declines browser spawn prompt', async () => {
    const config = makeConfig();
    const onPermissionRequest = vi.fn().mockResolvedValue('deny');

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-2',
          name: 'browser_navigate',
          args: JSON.stringify({ url: 'https://example.com' }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: { onPermissionRequest },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(onPermissionRequest).toHaveBeenCalledTimes(1);
    expect(onPermissionRequest).toHaveBeenCalledWith(
      'browser_open',
      expect.objectContaining({ __opta_spawn_prompt: true }),
    );
    expect(runtimeDaemon.daemon.openSession).not.toHaveBeenCalled();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(false);
    expect(decisions[0]?.denialReason).toContain('declined spawning');
  });

  it('reuses an existing open browser session when available', async () => {
    const config = makeConfig();
    runtimeDaemon.daemon.health.mockReturnValue(makeRuntimeHealth(['sess-existing-001']));
    const onPermissionRequest = vi.fn().mockResolvedValue('allow');

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-3',
          name: 'browser_navigate',
          args: JSON.stringify({ url: 'https://example.com' }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: { onPermissionRequest },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(onPermissionRequest).toHaveBeenCalledTimes(1);
    expect(onPermissionRequest).toHaveBeenCalledWith(
      'browser_navigate',
      expect.objectContaining({ session_id: 'sess-existing-001' }),
    );
    expect(runtimeDaemon.daemon.openSession).not.toHaveBeenCalled();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);
    const args = JSON.parse(decisions[0]?.executionArgsJson ?? '{}') as Record<string, unknown>;
    expect(args['session_id']).toBe('sess-existing-001');
  });

  it('re-checks host/origin on sensitive browser actions using active session URL context', async () => {
    const config = makeConfig();
    config.browser.globalAllowedHosts = ['example.com'];
    config.browser.policy.allowedHosts = ['*'];
    config.permissions.browser_click = 'allow';
    runtimeDaemon.daemon.health.mockReturnValue(makeRuntimeHealth([
      { sessionId: 'sess-existing-002', currentUrl: 'https://blocked.example.com/admin' },
    ]));
    const onPermissionRequest = vi.fn();

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-4',
          name: 'browser_click',
          args: JSON.stringify({
            session_id: 'sess-existing-002',
            selector: 'button[data-action="delete-account"]',
          }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: { onPermissionRequest },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(onPermissionRequest).not.toHaveBeenCalled();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(false);
    expect(decisions[0]?.denialReason).toContain('allowlist mismatch');
  });

  it('denies shell-based browser automation commands when browser tools are enabled', async () => {
    const config = makeConfig();
    config.permissions.run_command = 'allow';

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-shell-01',
          name: 'run_command',
          args: JSON.stringify({
            command: 'osascript -e \'tell application "Safari" to activate\'',
          }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: process.cwd(),
          model: config.model.default,
        },
      },
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(false);
    expect(decisions[0]?.denialReason).toContain('Denied shell browser automation command');
  });
});
