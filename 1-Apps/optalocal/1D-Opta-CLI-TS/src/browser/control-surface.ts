import type { OptaConfig } from '../core/config.js';
import { getSharedBrowserRuntimeDaemon, type BrowserRuntimeHealth } from './runtime-daemon.js';

export const BROWSER_CONTROL_ACTIONS = [
  'status',
  'start',
  'pause',
  'resume',
  'stop',
  'kill',
] as const;
export type BrowserControlAction = (typeof BROWSER_CONTROL_ACTIONS)[number];

export interface BrowserControlResult {
  ok: boolean;
  action: BrowserControlAction;
  message: string;
  health: BrowserRuntimeHealth;
}

export async function runBrowserControlAction(
  action: BrowserControlAction,
  config: OptaConfig
): Promise<BrowserControlResult> {
  const daemon = await getSharedBrowserRuntimeDaemon({
    cwd: process.cwd(),
    maxSessions: config.browser.runtime.maxSessions,
    persistSessions: config.browser.runtime.persistSessions,
    persistProfileContinuity: config.browser.runtime.persistProfileContinuity,
    profileRetentionPolicy: {
      retentionDays: config.browser.runtime.profileRetentionDays,
      maxPersistedProfiles: config.browser.runtime.maxPersistedProfiles,
    },
    profilePruneIntervalMs: config.browser.runtime.profilePruneIntervalHours * 60 * 60 * 1_000,
    artifactPrune: {
      enabled: config.browser.artifacts.retention.enabled,
      policy: {
        retentionDays: config.browser.artifacts.retention.retentionDays,
        maxPersistedSessions: config.browser.artifacts.retention.maxPersistedSessions,
      },
      intervalMs: config.browser.artifacts.retention.pruneIntervalHours * 60 * 60 * 1_000,
    },
    runCorpusRefresh: {
      enabled: config.browser.runtime.runCorpus.enabled,
      windowHours: config.browser.runtime.runCorpus.windowHours,
    },
  });
  const healthBefore = daemon.health();

  switch (action) {
    case 'status': {
      return {
        ok: true,
        action,
        message: 'Browser runtime status retrieved.',
        health: healthBefore,
      };
    }
    case 'start': {
      if (healthBefore.running) {
        return {
          ok: true,
          action,
          message: 'Browser runtime already running.',
          health: healthBefore,
        };
      }
      await daemon.start();
      return {
        ok: true,
        action,
        message: 'Browser runtime started.',
        health: daemon.health(),
      };
    }
    case 'pause':
      if (!healthBefore.running) {
        return {
          ok: false,
          action,
          message: 'Browser runtime is not running.',
          health: healthBefore,
        };
      }
      daemon.pause();
      return {
        ok: true,
        action,
        message: 'Browser runtime paused.',
        health: daemon.health(),
      };
    case 'resume':
      if (!healthBefore.running) {
        return {
          ok: false,
          action,
          message: 'Browser runtime is not running.',
          health: healthBefore,
        };
      }
      daemon.resume();
      return {
        ok: true,
        action,
        message: 'Browser runtime resumed.',
        health: daemon.health(),
      };
    case 'stop':
      await daemon.stop({ closeSessions: true });
      return {
        ok: true,
        action,
        message: healthBefore.running
          ? 'Browser runtime stopped and sessions closed.'
          : 'Browser runtime already stopped.',
        health: daemon.health(),
      };
    case 'kill':
      await daemon.kill();
      return {
        ok: true,
        action,
        message: healthBefore.killed
          ? 'Browser runtime already killed.'
          : 'Browser runtime killed.',
        health: daemon.health(),
      };
    default:
      return {
        ok: false,
        action,
        message: `Unknown browser control action: ${String(action)}`,
        health: daemon.health(),
      };
  }
}
