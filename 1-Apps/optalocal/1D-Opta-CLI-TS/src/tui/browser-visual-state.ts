import { useEffect, useState } from 'react';
import type { BrowserRiskLevel } from '../browser/policy-engine.js';
import type { BrowserRuntimeHealth } from '../browser/runtime-daemon.js';
import { TUI_COLORS } from './palette.js';

const MOTION_FRAME_MS = 140;

const BROWSER_STATE_FRAMES = {
  offline: ['◌', '○', '◌', '○'],
  paused: ['▯', '▮', '▯', '▮'],
  blocked: ['◆', '◇', '◆', '◇'],
  active: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  busy: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  healthy: ['◎', '◉', '●', '◉'],
  degraded: ['◐', '◓', '◑', '◒'],
} as const;

export type BrowserVisualStateKind = keyof typeof BROWSER_STATE_FRAMES;

export interface BrowserVisualPendingItem {
  risk: BrowserRiskLevel;
}

export interface BrowserVisualStateInput {
  browserHealth: BrowserRuntimeHealth | null | undefined;
  pendingApprovals: BrowserVisualPendingItem[];
  busy: boolean;
  /** The Playwright tool name currently executing (e.g. 'browser_navigate'). When set, the state shows 'active'. */
  activeTool?: string;
}

export interface BrowserVisualState {
  kind: BrowserVisualStateKind;
  label: string;
  reason: string;
  color: string;
  pendingTotal: number;
  pendingHigh: number;
  pendingMedium: number;
  pendingLow: number;
  pruneError: string | null;
  /** The Playwright tool currently executing, populated when kind === 'active'. */
  activeTool?: string;
}

function summarizePendingApprovals(pending: BrowserVisualPendingItem[]): {
  total: number;
  high: number;
  medium: number;
  low: number;
} {
  return pending.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item.risk === 'high') summary.high += 1;
      else if (item.risk === 'medium') summary.medium += 1;
      else summary.low += 1;
      return summary;
    },
    { total: 0, high: 0, medium: 0, low: 0 },
  );
}

function extractPruneError(browserHealth: BrowserRuntimeHealth | null | undefined): string | null {
  if (!browserHealth?.profilePrune) return null;
  const prune = browserHealth.profilePrune;
  if (prune.lastStatus === 'error') {
    return prune.lastError?.trim() || 'profile prune failed';
  }
  return null;
}

export function deriveBrowserVisualState({
  browserHealth,
  pendingApprovals,
  busy,
  activeTool,
}: BrowserVisualStateInput): BrowserVisualState {
  const pending = summarizePendingApprovals(pendingApprovals);
  const pruneError = extractPruneError(browserHealth);

  if (!browserHealth || browserHealth.killed || !browserHealth.running) {
    return {
      kind: 'offline',
      label: 'offline',
      reason: browserHealth?.killed ? 'runtime killed' : 'runtime unavailable',
      color: TUI_COLORS.danger,
      pendingTotal: pending.total,
      pendingHigh: pending.high,
      pendingMedium: pending.medium,
      pendingLow: pending.low,
      pruneError,
    };
  }

  if (browserHealth.paused) {
    return {
      kind: 'paused',
      label: 'paused',
      reason: 'runtime paused',
      color: TUI_COLORS.warning,
      pendingTotal: pending.total,
      pendingHigh: pending.high,
      pendingMedium: pending.medium,
      pendingLow: pending.low,
      pruneError,
    };
  }

  if (pending.high > 0) {
    return {
      kind: 'blocked',
      label: 'blocked',
      reason: `${pending.high} high-risk approval${pending.high === 1 ? '' : 's'} pending`,
      color: TUI_COLORS.danger,
      pendingTotal: pending.total,
      pendingHigh: pending.high,
      pendingMedium: pending.medium,
      pendingLow: pending.low,
      pruneError,
    };
  }

  if (activeTool) {
    const toolShort = activeTool.replace(/^browser_/, '');
    return {
      kind: 'active',
      label: 'active',
      reason: `executing: ${toolShort}`,
      color: TUI_COLORS.accent,
      pendingTotal: pending.total,
      pendingHigh: pending.high,
      pendingMedium: pending.medium,
      pendingLow: pending.low,
      pruneError,
      activeTool,
    };
  }

  if (busy) {
    return {
      kind: 'busy',
      label: 'busy',
      reason: 'runtime refresh in progress',
      color: TUI_COLORS.info,
      pendingTotal: pending.total,
      pendingHigh: pending.high,
      pendingMedium: pending.medium,
      pendingLow: pending.low,
      pruneError,
    };
  }

  if (pruneError || pending.medium > 0) {
    return {
      kind: 'degraded',
      label: 'degraded',
      reason: pruneError
        ? 'profile prune error'
        : `${pending.medium} medium-risk approval${pending.medium === 1 ? '' : 's'} pending`,
      color: TUI_COLORS.warning,
      pendingTotal: pending.total,
      pendingHigh: pending.high,
      pendingMedium: pending.medium,
      pendingLow: pending.low,
      pruneError,
    };
  }

  return {
    kind: 'healthy',
    label: 'healthy',
    reason: 'runtime healthy',
    color: TUI_COLORS.success,
    pendingTotal: pending.total,
    pendingHigh: pending.high,
    pendingMedium: pending.medium,
    pendingLow: pending.low,
    pruneError,
  };
}

export function browserVisualMotionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env['VITEST'] !== 'true' && env['NODE_ENV'] !== 'test';
}

export function browserVisualGlyph(kind: BrowserVisualStateKind, tick: number): string {
  const frames = BROWSER_STATE_FRAMES[kind];
  const index = Math.abs(tick) % frames.length;
  return frames[index] ?? '◌';
}

export function useBrowserVisualTick(active: boolean): number {
  const enabled = active && browserVisualMotionEnabled();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setTick((previous) => previous + 1), MOTION_FRAME_MS);
    (timer as unknown as { unref?: () => void }).unref?.();
    return () => clearInterval(timer);
  }, [enabled]);

  return enabled ? tick : 0;
}
