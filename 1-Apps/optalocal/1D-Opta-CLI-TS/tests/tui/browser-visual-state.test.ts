import { describe, expect, it } from 'vitest';
import type { BrowserRuntimeHealth } from '../../src/browser/runtime-daemon.js';
import {
  browserVisualGlyph,
  browserVisualMotionEnabled,
  deriveBrowserVisualState,
} from '../../src/tui/browser-visual-state.js';

function makeHealth(overrides: Partial<BrowserRuntimeHealth> = {}): BrowserRuntimeHealth {
  return {
    running: true,
    paused: false,
    killed: false,
    maxSessions: 3,
    sessionCount: 1,
    recoveredSessionIds: [],
    profilePrune: {
      enabled: true,
      inFlight: false,
      intervalMs: 3_600_000,
      lastStatus: 'success',
    },
    sessions: [],
    ...overrides,
  };
}

describe('browser-visual-state', () => {
  it('derives offline when runtime health is unavailable', () => {
    const state = deriveBrowserVisualState({
      browserHealth: null,
      pendingApprovals: [],
      busy: false,
    });

    expect(state.kind).toBe('offline');
    expect(state.reason).toContain('unavailable');
  });

  it('derives paused when runtime is paused', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth({ paused: true }),
      pendingApprovals: [],
      busy: false,
    });

    expect(state.kind).toBe('paused');
  });

  it('derives blocked when high-risk approvals are pending', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth(),
      pendingApprovals: [{ risk: 'high' }],
      busy: false,
    });

    expect(state.kind).toBe('blocked');
    expect(state.pendingHigh).toBe(1);
  });

  it('derives active when an LLM browser tool is executing', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth(),
      pendingApprovals: [],
      busy: false,
      activeTool: 'browser_navigate',
    });

    expect(state.kind).toBe('active');
    expect(state.activeTool).toBe('browser_navigate');
    expect(state.reason).toContain('navigate');
  });

  it('active state takes priority over busy', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth(),
      pendingApprovals: [],
      busy: true,
      activeTool: 'browser_click',
    });

    expect(state.kind).toBe('active');
    expect(state.activeTool).toBe('browser_click');
  });

  it('derives busy while runtime refresh is active', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth(),
      pendingApprovals: [],
      busy: true,
    });

    expect(state.kind).toBe('busy');
  });

  it('derives degraded when prune health has an error', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth({
        profilePrune: {
          enabled: true,
          inFlight: false,
          lastStatus: 'error',
          lastError: 'disk full',
        },
      }),
      pendingApprovals: [],
      busy: false,
    });

    expect(state.kind).toBe('degraded');
    expect(state.pruneError).toBe('disk full');
  });

  it('derives healthy when runtime is running without risk pressure', () => {
    const state = deriveBrowserVisualState({
      browserHealth: makeHealth(),
      pendingApprovals: [{ risk: 'low' }],
      busy: false,
    });

    expect(state.kind).toBe('healthy');
  });

  it('keeps motion deterministic in test env and cycles glyph frames by tick', () => {
    expect(browserVisualMotionEnabled({ VITEST: 'true', NODE_ENV: 'test' })).toBe(false);
    expect(browserVisualGlyph('busy', 0)).toBe('⠋');
    expect(browserVisualGlyph('busy', 1)).not.toBe(browserVisualGlyph('busy', 0));
    expect(browserVisualGlyph('busy', 10)).toBe('⠋');
  });
});
