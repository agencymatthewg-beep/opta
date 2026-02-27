import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import {
  ensureBrowserSessionForTriggeredPrompt,
  hasBrowserTriggerWord,
} from '../../src/browser/trigger-session.js';

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

function makeConfig() {
  const config = structuredClone(DEFAULT_CONFIG);
  config.browser.enabled = true;
  config.browser.runtime.enabled = true;
  config.browser.mode = 'isolated';
  return config;
}

function makeHealth(sessions: Array<{ sessionId: string; runtime?: 'playwright' | 'unavailable' }>) {
  return {
    running: true,
    paused: false,
    killed: false,
    maxSessions: 3,
    sessionCount: sessions.length,
    recoveredSessionIds: [],
    profilePrune: {
      enabled: false,
      inFlight: false,
    },
    sessions: sessions.map((session) => ({
      sessionId: session.sessionId,
      mode: 'isolated' as const,
      status: 'open' as const,
      runtime: session.runtime ?? 'playwright',
      updatedAt: '2026-02-25T00:00:00.000Z',
      currentUrl: undefined,
    })),
  };
}

function makeOpenResult(sessionId: string) {
  return {
    ok: true,
    action: {
      id: 'action-open-1',
      sessionId,
      type: 'openSession' as const,
      createdAt: '2026-02-25T00:00:00.000Z',
      input: {},
    },
    data: {
      id: sessionId,
      mode: 'isolated' as const,
      status: 'open' as const,
      runtime: 'playwright' as const,
      createdAt: '2026-02-25T00:00:00.000Z',
      updatedAt: '2026-02-25T00:00:00.000Z',
      artifactsDir: '.opta/browser/sessions',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  runtimeDaemon.daemon.start.mockResolvedValue(undefined);
  runtimeDaemon.daemon.health.mockReturnValue(makeHealth([]));
  runtimeDaemon.daemon.openSession.mockResolvedValue(makeOpenResult('sess-new-001'));
});

describe('hasBrowserTriggerWord', () => {
  it('matches browser as a whole word case-insensitively', () => {
    expect(hasBrowserTriggerWord('Open Browser and inspect this page')).toBe(true);
  });

  it('does not match partial words', () => {
    expect(hasBrowserTriggerWord('Use browserize helper')).toBe(false);
  });
});

describe('ensureBrowserSessionForTriggeredPrompt', () => {
  it('short-circuits when prompt has no browser trigger', async () => {
    const result = await ensureBrowserSessionForTriggeredPrompt({
      prompt: 'Refactor the parser',
      config: makeConfig(),
    });

    expect(result.triggered).toBe(false);
    expect(runtimeDaemon.getSharedBrowserRuntimeDaemon).not.toHaveBeenCalled();
  });

  it('reuses preferred active session when available', async () => {
    runtimeDaemon.daemon.health.mockReturnValue(makeHealth([
      { sessionId: 'sess-a' },
      { sessionId: 'sess-b' },
    ]));

    const result = await ensureBrowserSessionForTriggeredPrompt({
      prompt: 'Browser: continue from current tab',
      config: makeConfig(),
      preferredSessionId: 'sess-b',
    });

    expect(result.ok).toBe(true);
    expect(result.reused).toBe(true);
    expect(result.sessionId).toBe('sess-b');
    expect(runtimeDaemon.daemon.openSession).not.toHaveBeenCalled();
  });

  it('reuses first active session when no preferred session exists', async () => {
    runtimeDaemon.daemon.health.mockReturnValue(makeHealth([
      { sessionId: 'sess-first' },
      { sessionId: 'sess-second' },
    ]));

    const result = await ensureBrowserSessionForTriggeredPrompt({
      prompt: 'browser please',
      config: makeConfig(),
    });

    expect(result.ok).toBe(true);
    expect(result.reused).toBe(true);
    expect(result.sessionId).toBe('sess-first');
    expect(runtimeDaemon.daemon.openSession).not.toHaveBeenCalled();
  });

  it('opens a new visible session when no active session exists', async () => {
    runtimeDaemon.daemon.health.mockReturnValue(makeHealth([]));
    runtimeDaemon.daemon.openSession.mockResolvedValue(makeOpenResult('sess-visible-001'));

    const result = await ensureBrowserSessionForTriggeredPrompt({
      prompt: 'Open browser and do checkout flow',
      config: makeConfig(),
    });

    expect(result.ok).toBe(true);
    expect(result.reused).toBe(false);
    expect(result.sessionId).toBe('sess-visible-001');
    expect(runtimeDaemon.daemon.openSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'isolated',
        headless: false,
      }),
    );
  });

  it('returns an error when browser runtime is disabled', async () => {
    const config = makeConfig();
    config.browser.runtime.enabled = false;

    const result = await ensureBrowserSessionForTriggeredPrompt({
      prompt: 'browser go to docs',
      config,
    });

    expect(result.triggered).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('browser runtime is disabled');
    expect(runtimeDaemon.getSharedBrowserRuntimeDaemon).not.toHaveBeenCalled();
  });
});
