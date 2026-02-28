import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readRecentBrowserApprovalEvents } from '../../src/browser/approval-log.js';
import { buildBrowserAvailabilityInstruction } from '../../src/browser/intent-router.js';
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

  describe('buildBrowserAvailabilityInstruction', () => {
    it('returns null when neither explicit request nor MCP is enabled', () => {
      expect(buildBrowserAvailabilityInstruction(false, false)).toBeNull();
    });

    it('returns legacy tool list when MCP is disabled but explicit request is true', () => {
      const instruction = buildBrowserAvailabilityInstruction(true, false);
      expect(instruction).not.toBeNull();
      expect(instruction).toContain('browser_open');
      expect(instruction).not.toContain('browser_evaluate');
    });

    it('returns expanded MCP tool list when mcpEnabled is true', () => {
      const instruction = buildBrowserAvailabilityInstruction(false, true);
      expect(instruction).not.toBeNull();
      expect(instruction).toContain('browser_evaluate');
      expect(instruction).toContain('browser_hover');
      expect(instruction).toContain('browser_scroll');
      expect(instruction).not.toContain('browser_open');
    });
  });
});
