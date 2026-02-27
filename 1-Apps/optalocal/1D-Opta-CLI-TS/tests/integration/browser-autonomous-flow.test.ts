import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRecentBrowserApprovalEvents } from '../../src/browser/approval-log.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { createHookManager } from '../../src/hooks/integration.js';
import { resolveToolDecisions } from '../../src/core/agent-permissions.js';

let testDir = '';

afterEach(async () => {
  vi.restoreAllMocks();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('browser autonomous flow', () => {
  it('gates high-risk browser actions through approval and passes approved marker to execution', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-approval-'));
    const config = structuredClone(DEFAULT_CONFIG);
    config.policy.gateAllAutonomy = false;
    config.policy.audit.enabled = false;
    config.browser.enabled = true;
    config.browser.policy.requireApprovalForHighRisk = true;

    let promptCount = 0;
    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-01',
          name: 'browser_click',
          args: JSON.stringify({
            session_id: 'sess-int-01',
            selector: 'button[data-action="delete"]',
          }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: {
          onPermissionRequest: async () => {
            promptCount += 1;
            return 'allow';
          },
        },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: testDir,
          model: config.model.default,
        },
      },
    );

    expect(promptCount).toBe(1);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);

    const executionArgs = JSON.parse(decisions[0]?.executionArgsJson ?? '{}') as {
      __browser_approved?: boolean;
    };
    expect(executionArgs.__browser_approved).toBe(true);

    const approvalEvents = await readRecentBrowserApprovalEvents(testDir, 5);
    expect(approvalEvents).toHaveLength(1);
    expect(approvalEvents[0]).toMatchObject({
      tool: 'browser_click',
      sessionId: 'sess-int-01',
      decision: 'approved',
    });
  });

  it('gates browser form submit typing actions and propagates approval markers', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-approval-'));
    const config = structuredClone(DEFAULT_CONFIG);
    config.policy.gateAllAutonomy = false;
    config.policy.audit.enabled = false;
    config.browser.enabled = true;
    config.browser.policy.requireApprovalForHighRisk = true;

    let promptCount = 0;
    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-submit-01',
          name: 'browser_type',
          args: JSON.stringify({
            session_id: 'sess-int-submit-01',
            selector: '#status-input',
            text: 'All set',
            submit: true,
          }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: {
          onPermissionRequest: async () => {
            promptCount += 1;
            return 'allow';
          },
        },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: testDir,
          model: config.model.default,
        },
      },
    );

    expect(promptCount).toBe(1);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);

    const executionArgs = JSON.parse(decisions[0]?.executionArgsJson ?? '{}') as {
      __browser_approved?: boolean;
    };
    expect(executionArgs.__browser_approved).toBe(true);

    const approvalEvents = await readRecentBrowserApprovalEvents(testDir, 5);
    expect(approvalEvents).toHaveLength(1);
    expect(approvalEvents[0]).toMatchObject({
      tool: 'browser_type',
      sessionId: 'sess-int-submit-01',
      decision: 'approved',
    });
  });

  it('logs denied high-risk browser approval requests', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-approval-'));
    const config = structuredClone(DEFAULT_CONFIG);
    config.policy.gateAllAutonomy = false;
    config.policy.audit.enabled = false;
    config.browser.enabled = true;
    config.browser.policy.requireApprovalForHighRisk = true;

    const decisions = await resolveToolDecisions(
      [
        {
          id: 'call-01',
          name: 'browser_click',
          args: JSON.stringify({
            session_id: 'sess-int-02',
            selector: 'button[data-action="delete"]',
          }),
        },
      ],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: {
          onPermissionRequest: async () => 'deny',
        },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: testDir,
          model: config.model.default,
        },
      },
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(false);
    expect(decisions[0]?.denialReason).toContain('User declined');

    const approvalEvents = await readRecentBrowserApprovalEvents(testDir, 5);
    expect(approvalEvents).toHaveLength(1);
    expect(approvalEvents[0]).toMatchObject({
      tool: 'browser_click',
      sessionId: 'sess-int-02',
      decision: 'denied',
    });
  });

  it('enforces browser host block rules at execution time', async () => {
    vi.resetModules();

    const runtimeConfig = structuredClone(DEFAULT_CONFIG);
    runtimeConfig.browser.enabled = true;
    runtimeConfig.browser.policy.allowedHosts = ['example.com'];
    runtimeConfig.browser.policy.blockedOrigins = ['https://blocked.example.com'];
    runtimeConfig.browser.policy.requireApprovalForHighRisk = true;

    vi.doMock('../../src/core/config.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/core/config.js')>(
        '../../src/core/config.js',
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => runtimeConfig),
      };
    });

    const { executeTool, resetBrowserRuntimeForTests } = await import('../../src/core/tools/executors.js');

    await executeTool('browser_open', JSON.stringify({ session_id: 'sess-int-02' }));
    const blockedRaw = await executeTool(
      'browser_navigate',
      JSON.stringify({ session_id: 'sess-int-02', url: 'https://blocked.example.com/admin' }),
    );
    const blocked = JSON.parse(blockedRaw) as { code?: string };

    expect(blocked.code).toBe('BROWSER_POLICY_DENY');
    await resetBrowserRuntimeForTests();
  });

  it('enforces global browser host/origin policy at execution time when policy allowlist is wildcard', async () => {
    vi.resetModules();

    const runtimeConfig = structuredClone(DEFAULT_CONFIG);
    runtimeConfig.browser.enabled = true;
    runtimeConfig.browser.globalAllowedHosts = ['example.com'];
    runtimeConfig.browser.blockedOrigins = ['https://blocked.example.com'];
    runtimeConfig.browser.policy.allowedHosts = ['*'];
    runtimeConfig.browser.policy.blockedOrigins = [];
    runtimeConfig.browser.policy.requireApprovalForHighRisk = true;

    vi.doMock('../../src/core/config.js', async () => {
      const actual = await vi.importActual<typeof import('../../src/core/config.js')>(
        '../../src/core/config.js',
      );
      return {
        ...actual,
        loadConfig: vi.fn(async () => runtimeConfig),
      };
    });

    const { executeTool, resetBrowserRuntimeForTests } = await import('../../src/core/tools/executors.js');

    await executeTool('browser_open', JSON.stringify({ session_id: 'sess-int-03' }));

    const deniedByHostRaw = await executeTool(
      'browser_navigate',
      JSON.stringify({ session_id: 'sess-int-03', url: 'https://other.example.net/dashboard' }),
    );
    const deniedByHost = JSON.parse(deniedByHostRaw) as { code?: string };
    expect(deniedByHost.code).toBe('BROWSER_POLICY_DENY');

    const deniedByOriginRaw = await executeTool(
      'browser_navigate',
      JSON.stringify({ session_id: 'sess-int-03', url: 'https://blocked.example.com/admin' }),
    );
    const deniedByOrigin = JSON.parse(deniedByOriginRaw) as { code?: string };
    expect(deniedByOrigin.code).toBe('BROWSER_POLICY_DENY');

    const allowedRaw = await executeTool(
      'browser_navigate',
      JSON.stringify({ session_id: 'sess-int-03', url: 'https://example.com/home' }),
    );
    const allowed = JSON.parse(allowedRaw) as { code?: string };
    expect(allowed.code).not.toBe('BROWSER_POLICY_DENY');

    const deniedSensitiveClickRaw = await executeTool(
      'browser_click',
      JSON.stringify({
        session_id: 'sess-int-03',
        selector: 'button[data-action="delete-account"]',
        url: 'https://other.example.net/profile',
      }),
    );
    const deniedSensitiveClick = JSON.parse(deniedSensitiveClickRaw) as { code?: string };
    expect(deniedSensitiveClick.code).toBe('BROWSER_POLICY_DENY');

    await resetBrowserRuntimeForTests();
  });

  it('enforces global browser host/origin policy in agent permission resolution', async () => {
    testDir = await mkdtemp(join(tmpdir(), 'opta-browser-approval-'));
    const config = structuredClone(DEFAULT_CONFIG);
    config.policy.gateAllAutonomy = false;
    config.policy.audit.enabled = false;
    config.browser.enabled = true;
    config.browser.globalAllowedHosts = ['example.com'];
    config.browser.blockedOrigins = ['https://blocked.example.com'];
    config.browser.policy.allowedHosts = ['*'];
    config.browser.policy.blockedOrigins = [];
    config.permissions.browser_navigate = 'allow';
    config.autonomy = { ...config.autonomy, level: 3 };

    const deniedByGlobalAllowlist = await resolveToolDecisions(
      [
        {
          id: 'call-global-allowlist-deny',
          name: 'browser_navigate',
          args: JSON.stringify({
            session_id: 'sess-int-global-01',
            url: 'https://other.example.net/dashboard',
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
          cwd: testDir,
          model: config.model.default,
        },
      },
    );

    expect(deniedByGlobalAllowlist).toHaveLength(1);
    expect(deniedByGlobalAllowlist[0]?.approved).toBe(false);
    expect(deniedByGlobalAllowlist[0]?.denialReason).toContain('allowlist mismatch');

    const deniedByGlobalBlockOrigin = await resolveToolDecisions(
      [
        {
          id: 'call-global-origin-deny',
          name: 'browser_navigate',
          args: JSON.stringify({
            session_id: 'sess-int-global-02',
            url: 'https://blocked.example.com/admin',
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
          cwd: testDir,
          model: config.model.default,
        },
      },
    );

    expect(deniedByGlobalBlockOrigin).toHaveLength(1);
    expect(deniedByGlobalBlockOrigin[0]?.approved).toBe(false);
    expect(deniedByGlobalBlockOrigin[0]?.denialReason).toContain('blocked origin');

    const allowedByGlobalAllowlist = await resolveToolDecisions(
      [
        {
          id: 'call-global-allowlist-allow',
          name: 'browser_navigate',
          args: JSON.stringify({
            session_id: 'sess-int-global-03',
            url: 'https://example.com/home',
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
          cwd: testDir,
          model: config.model.default,
        },
      },
    );

    expect(allowedByGlobalAllowlist).toHaveLength(1);
    expect(allowedByGlobalAllowlist[0]?.approved).toBe(true);
  });
});
