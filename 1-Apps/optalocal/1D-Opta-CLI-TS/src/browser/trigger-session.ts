import type { OptaConfig } from '../core/config.js';
import { getSharedBrowserRuntimeDaemon } from './runtime-daemon.js';
import type { BrowserMode } from './types.js';

export interface BrowserTriggerSessionEnsureResult {
  triggered: boolean;
  ok: boolean;
  sessionId?: string;
  reused?: boolean;
  mode?: BrowserMode;
  message: string;
}

const DEFAULT_TRIGGER_WORDS = ['browser'];
const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(value: string): string {
  return value.replace(REGEX_ESCAPE_PATTERN, '\\$&');
}

function normalizeTriggerWords(words: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of words) {
    const candidate = raw.trim().toLowerCase();
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

export function hasBrowserTriggerWord(
  prompt: string,
  triggerWords: string[] = DEFAULT_TRIGGER_WORDS,
): boolean {
  const normalizedPrompt = prompt.trim();
  if (!normalizedPrompt) return false;

  for (const trigger of normalizeTriggerWords(triggerWords)) {
    const pattern = new RegExp(`\\b${escapeRegex(trigger)}\\b`, 'i');
    if (pattern.test(normalizedPrompt)) {
      return true;
    }
  }

  return false;
}

export async function ensureBrowserSessionForTriggeredPrompt(options: {
  prompt: string;
  config: OptaConfig;
  preferredSessionId?: string;
  triggerWords?: string[];
}): Promise<BrowserTriggerSessionEnsureResult> {
  const triggerWords = options.triggerWords ?? DEFAULT_TRIGGER_WORDS;
  const triggered = hasBrowserTriggerWord(options.prompt, triggerWords);
  if (!triggered) {
    return {
      triggered: false,
      ok: true,
      message: 'No browser trigger word matched.',
    };
  }

  if (options.config.browser.enabled === false) {
    return {
      triggered: true,
      ok: false,
      message: 'Browser trigger detected, but browser feature is disabled (browser.enabled=false).',
    };
  }

  if (options.config.browser.runtime.enabled === false) {
    return {
      triggered: true,
      ok: false,
      message: 'Browser trigger detected, but browser runtime is disabled (browser.runtime.enabled=false).',
    };
  }

  const daemon = await getSharedBrowserRuntimeDaemon({
    cwd: process.cwd(),
    maxSessions: options.config.browser.runtime.maxSessions,
    persistSessions: options.config.browser.runtime.persistSessions,
    persistProfileContinuity: options.config.browser.runtime.persistProfileContinuity,
    profileRetentionPolicy: {
      retentionDays: options.config.browser.runtime.profileRetentionDays,
      maxPersistedProfiles: options.config.browser.runtime.maxPersistedProfiles,
    },
    profilePruneIntervalMs: options.config.browser.runtime.profilePruneIntervalHours * 60 * 60 * 1_000,
    artifactPrune: {
      enabled: options.config.browser.artifacts.retention.enabled,
      policy: {
        retentionDays: options.config.browser.artifacts.retention.retentionDays,
        maxPersistedSessions: options.config.browser.artifacts.retention.maxPersistedSessions,
      },
      intervalMs: options.config.browser.artifacts.retention.pruneIntervalHours * 60 * 60 * 1_000,
    },
    runCorpusRefresh: {
      enabled: options.config.browser.runtime.runCorpus.enabled,
      windowHours: options.config.browser.runtime.runCorpus.windowHours,
    },
  });

  await daemon.start();
  const health = daemon.health();
  const openSessions = health.sessions.filter(
    (session) => session.status === 'open' && session.runtime === 'playwright',
  );

  const preferred = options.preferredSessionId?.trim();
  const reusable = preferred
    ? openSessions.find((session) => session.sessionId === preferred)
    : undefined;
  const selected = reusable ?? openSessions[0];

  if (selected) {
    return {
      triggered: true,
      ok: true,
      sessionId: selected.sessionId,
      reused: true,
      mode: selected.mode,
      message: `Reusing active Opta Browser session ${selected.sessionId}.`,
    };
  }

  const openResult = await daemon.openSession({
    mode: options.config.browser.mode,
    headless: false,
  });
  if (!openResult.ok || !openResult.data) {
    return {
      triggered: true,
      ok: false,
      message: `Browser trigger detected, but Opta Browser could not start: ${openResult.error?.message ?? 'Unknown error'}`,
    };
  }

  return {
    triggered: true,
    ok: true,
    sessionId: openResult.data.id,
    reused: false,
    mode: openResult.data.mode,
    message: `Started visible Opta Browser session ${openResult.data.id}.`,
  };
}
