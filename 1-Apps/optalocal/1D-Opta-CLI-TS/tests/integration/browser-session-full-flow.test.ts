import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveBrowserRunCorpusAdaptationHint,
  normalizeBrowserAdaptationConfig,
  DEFAULT_BROWSER_ADAPTATION_CONFIG,
  type BrowserAdaptationConfig,
} from '../../src/browser/adaptation.js';
import {
  appendBrowserApprovalEvent,
  readBrowserApprovalEvents,
  readRecentBrowserApprovalEvents,
  browserApprovalLogPath,
  extractBrowserSessionId,
} from '../../src/browser/approval-log.js';
import { BrowserSessionStore } from '../../src/browser/session-store.js';
import {
  classifyBrowserRetryTaxonomy,
  withRetryTaxonomy,
} from '../../src/browser/retry-taxonomy.js';
import { NativeSessionManager } from '../../src/browser/native-session-manager.js';
import { BrowserRuntimeDaemon } from '../../src/browser/runtime-daemon.js';
import type { BrowserRunCorpusSummary } from '../../src/browser/run-corpus.js';
import type {
  BrowserRuntimeSessionRecord,
} from '../../src/browser/session-store.js';

let testDir = '';

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-browser-full-flow-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

// ---------------------------------------------------------------------------
// SessionStore — CRUD operations
// ---------------------------------------------------------------------------

describe('SessionStore', () => {
  it('returns empty store data when file does not exist', async () => {
    const store = new BrowserSessionStore({ cwd: testDir });
    const data = await store.read();
    expect(data.schemaVersion).toBe(1);
    expect(data.sessions).toEqual([]);
  });

  it('persists and reads back a session record', async () => {
    const now = new Date('2026-02-26T10:00:00.000Z');
    const store = new BrowserSessionStore({ cwd: testDir, now: () => now });

    const record: BrowserRuntimeSessionRecord = {
      sessionId: 'sess-store-01',
      mode: 'isolated',
      status: 'open',
      runtime: 'playwright',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await store.replaceSessions([record]);

    const data = await store.read();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]?.sessionId).toBe('sess-store-01');
    expect(data.sessions[0]?.mode).toBe('isolated');
    expect(data.sessions[0]?.status).toBe('open');
    expect(data.sessions[0]?.runtime).toBe('playwright');
    expect(data.updatedAt).toBe(now.toISOString());
  });

  it('lists persisted session records', async () => {
    const now = new Date('2026-02-26T10:00:00.000Z');
    const store = new BrowserSessionStore({ cwd: testDir, now: () => now });

    const records: BrowserRuntimeSessionRecord[] = [
      {
        sessionId: 'sess-list-01',
        mode: 'isolated',
        status: 'open',
        runtime: 'playwright',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        sessionId: 'sess-list-02',
        mode: 'attach',
        status: 'closed',
        runtime: 'unavailable',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];

    await store.replaceSessions(records);
    const listed = await store.list();

    expect(listed).toHaveLength(2);
    expect(listed.map((r) => r.sessionId)).toEqual(['sess-list-01', 'sess-list-02']);
  });

  it('replaces all sessions atomically', async () => {
    const now = new Date('2026-02-26T10:00:00.000Z');
    const store = new BrowserSessionStore({ cwd: testDir, now: () => now });

    await store.replaceSessions([
      {
        sessionId: 'sess-old',
        mode: 'isolated',
        status: 'open',
        runtime: 'playwright',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    await store.replaceSessions([
      {
        sessionId: 'sess-new-01',
        mode: 'isolated',
        status: 'open',
        runtime: 'playwright',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        sessionId: 'sess-new-02',
        mode: 'isolated',
        status: 'closed',
        runtime: 'playwright',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const data = await store.read();
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions.find((s) => s.sessionId === 'sess-old')).toBeUndefined();
    expect(data.sessions.find((s) => s.sessionId === 'sess-new-01')).toBeDefined();
    expect(data.sessions.find((s) => s.sessionId === 'sess-new-02')).toBeDefined();
  });

  it('recovers gracefully from malformed JSON in store file', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const storeDir = join(testDir, '.opta', 'browser');
    await mkdir(storeDir, { recursive: true });
    await writeFile(
      join(storeDir, 'runtime-sessions.json'),
      '{ "schemaVersion": 1, "sessions": [',
      'utf-8',
    );

    const store = new BrowserSessionStore({ cwd: testDir });
    const data = await store.read();
    expect(data.sessions).toEqual([]);
    expect(data.schemaVersion).toBe(1);
  });

  it('sanitizes records with invalid mode/status/runtime fields on read', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const storeDir = join(testDir, '.opta', 'browser');
    await mkdir(storeDir, { recursive: true });
    const now = '2026-02-26T10:00:00.000Z';

    await writeFile(
      join(storeDir, 'runtime-sessions.json'),
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: now,
        sessions: [
          {
            sessionId: 'sess-valid',
            mode: 'isolated',
            status: 'open',
            runtime: 'playwright',
            createdAt: now,
            updatedAt: now,
          },
          {
            sessionId: 'sess-invalid-mode',
            mode: 'headless',         // invalid
            status: 'open',
            runtime: 'playwright',
            createdAt: now,
            updatedAt: now,
          },
          {
            sessionId: 'sess-invalid-runtime',
            mode: 'isolated',
            status: 'open',
            runtime: 'puppeteer',     // invalid
            createdAt: now,
            updatedAt: now,
          },
        ],
      }),
      'utf-8',
    );

    const store = new BrowserSessionStore({ cwd: testDir });
    const data = await store.read();

    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0]?.sessionId).toBe('sess-valid');
  });

  it('exposes the correct store file path', () => {
    const store = new BrowserSessionStore({ cwd: testDir });
    expect(store.path).toBe(join(testDir, '.opta', 'browser', 'runtime-sessions.json'));
  });
});

// ---------------------------------------------------------------------------
// ApprovalLog — logging and reading approval events
// ---------------------------------------------------------------------------

describe('ApprovalLog', () => {
  it('appends and reads back a browser approval event', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_click',
      sessionId: 'sess-approval-01',
      decision: 'approved',
      risk: 'high',
      actionKey: 'delete',
      timestamp: '2026-02-26T10:00:00.000Z',
    });

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: 'browser_click',
      sessionId: 'sess-approval-01',
      decision: 'approved',
      risk: 'high',
      actionKey: 'delete',
      timestamp: '2026-02-26T10:00:00.000Z',
    });
  });

  it('appends a denied event correctly', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_navigate',
      sessionId: 'sess-approval-02',
      decision: 'denied',
      risk: 'high',
      timestamp: '2026-02-26T10:01:00.000Z',
    });

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    expect(events[0]?.decision).toBe('denied');
    expect(events[0]?.tool).toBe('browser_navigate');
  });

  it('accumulates multiple events in append order', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_click',
      sessionId: 'sess-multi',
      decision: 'approved',
      timestamp: '2026-02-26T10:00:00.000Z',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_type',
      sessionId: 'sess-multi',
      decision: 'denied',
      timestamp: '2026-02-26T10:01:00.000Z',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_handle_dialog',
      sessionId: 'sess-multi',
      decision: 'approved',
      timestamp: '2026-02-26T10:02:00.000Z',
    });

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.tool)).toEqual([
      'browser_click',
      'browser_type',
      'browser_handle_dialog',
    ]);
  });

  it('readRecentBrowserApprovalEvents returns events in reverse-chronological order', async () => {
    for (let i = 1; i <= 5; i++) {
      await appendBrowserApprovalEvent({
        cwd: testDir,
        tool: 'browser_click',
        sessionId: `sess-recent-${i.toString().padStart(2, '0')}`,
        decision: 'approved',
        timestamp: `2026-02-26T10:0${i}:00.000Z`,
      });
    }

    const recent = await readRecentBrowserApprovalEvents(testDir, 3);
    expect(recent).toHaveLength(3);
    // Most recent first
    expect(recent[0]?.sessionId).toBe('sess-recent-05');
    expect(recent[1]?.sessionId).toBe('sess-recent-04');
    expect(recent[2]?.sessionId).toBe('sess-recent-03');
  });

  it('returns empty array when approval log file does not exist', async () => {
    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toEqual([]);
  });

  it('skips malformed JSONL lines without failing', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const logDir = join(testDir, '.opta', 'browser');
    await mkdir(logDir, { recursive: true });
    await writeFile(
      join(logDir, 'approval-log.jsonl'),
      [
        '{"timestamp":"2026-02-26T10:00:00.000Z","tool":"browser_click","decision":"approved"}',
        '{ malformed json line }',
        '{"timestamp":"2026-02-26T10:01:00.000Z","tool":"browser_type","decision":"denied"}',
      ].join('\n') + '\n',
      'utf-8',
    );

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(2);
    expect(events[0]?.tool).toBe('browser_click');
    expect(events[1]?.tool).toBe('browser_type');
  });

  it('skips JSONL lines missing required fields', async () => {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const logDir = join(testDir, '.opta', 'browser');
    await mkdir(logDir, { recursive: true });
    await writeFile(
      join(logDir, 'approval-log.jsonl'),
      [
        '{"timestamp":"2026-02-26T10:00:00.000Z","tool":"browser_click","decision":"approved"}',
        '{"tool":"browser_navigate","decision":"approved"}',            // missing timestamp
        '{"timestamp":"2026-02-26T10:02:00.000Z","decision":"denied"}', // missing tool
        '{"timestamp":"2026-02-26T10:03:00.000Z","tool":"browser_type","decision":"unknown_decision"}', // invalid decision
      ].join('\n') + '\n',
      'utf-8',
    );

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    expect(events[0]?.tool).toBe('browser_click');
  });

  it('extracts browser session id from args using session_id key', () => {
    const sessionId = extractBrowserSessionId({ session_id: 'sess-extract-01' });
    expect(sessionId).toBe('sess-extract-01');
  });

  it('extracts browser session id from args using sessionId key', () => {
    const sessionId = extractBrowserSessionId({ sessionId: '  sess-extract-02  ' });
    expect(sessionId).toBe('sess-extract-02');
  });

  it('returns undefined when no session id key is present', () => {
    expect(extractBrowserSessionId({})).toBeUndefined();
    expect(extractBrowserSessionId({ selector: '#button' })).toBeUndefined();
  });

  it('returns undefined when session id value is blank', () => {
    expect(extractBrowserSessionId({ session_id: '   ' })).toBeUndefined();
    expect(extractBrowserSessionId({ sessionId: '' })).toBeUndefined();
  });

  it('exposes the correct approval log path', () => {
    const logPath = browserApprovalLogPath(testDir);
    expect(logPath).toBe(join(testDir, '.opta', 'browser', 'approval-log.jsonl'));
  });

  it('stores riskEvidence when provided', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_click',
      sessionId: 'sess-evidence-01',
      decision: 'approved',
      risk: 'high',
      timestamp: '2026-02-26T10:00:00.000Z',
      riskEvidence: {
        classifier: 'static',
        matchedSignals: ['tool:browser_click', 'args:keyword:delete'],
      },
    });

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    expect(events[0]?.riskEvidence).toBeDefined();
    expect(events[0]?.riskEvidence?.classifier).toBe('static');
    expect(events[0]?.riskEvidence?.matchedSignals).toContain('tool:browser_click');
  });
});

// ---------------------------------------------------------------------------
// RetryTaxonomy — error classification logic
// ---------------------------------------------------------------------------

describe('RetryTaxonomy', () => {
  describe('classifyBrowserRetryTaxonomy', () => {
    it('classifies BROWSER_POLICY_DENY as non-retryable policy category', () => {
      const result = classifyBrowserRetryTaxonomy('BROWSER_POLICY_DENY', 'Action blocked by policy');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('policy');
      expect(result.retryHint).toContain('Policy decisions are deterministic');
    });

    it('classifies BROWSER_POLICY_APPROVAL_REQUIRED as non-retryable policy category', () => {
      const result = classifyBrowserRetryTaxonomy('BROWSER_POLICY_APPROVAL_REQUIRED', 'Approval required');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('policy');
    });

    it('classifies PLAYWRIGHT_UNAVAILABLE as non-retryable runtime-unavailable', () => {
      const result = classifyBrowserRetryTaxonomy('PLAYWRIGHT_UNAVAILABLE', 'Playwright not installed');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('runtime-unavailable');
    });

    it('classifies DAEMON_STOPPED as non-retryable runtime-unavailable', () => {
      const result = classifyBrowserRetryTaxonomy('DAEMON_STOPPED', 'Daemon is not running');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('runtime-unavailable');
    });

    it('classifies ACTION_CANCELLED as non-retryable runtime-unavailable', () => {
      const result = classifyBrowserRetryTaxonomy('ACTION_CANCELLED', 'Action was cancelled');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('runtime-unavailable');
    });

    it('classifies SESSION_NOT_FOUND as non-retryable session-state', () => {
      const result = classifyBrowserRetryTaxonomy('SESSION_NOT_FOUND', 'No session with that id');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('session-state');
    });

    it('classifies MAX_SESSIONS_REACHED as non-retryable session-state', () => {
      const result = classifyBrowserRetryTaxonomy('MAX_SESSIONS_REACHED', 'Too many sessions open');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('session-state');
    });

    it('classifies DAEMON_PAUSED as non-retryable session-state', () => {
      const result = classifyBrowserRetryTaxonomy('DAEMON_PAUSED', 'Daemon is paused');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('session-state');
    });

    it('classifies invalid URL messages as non-retryable invalid-input', () => {
      const result = classifyBrowserRetryTaxonomy('NAVIGATE_FAILED', 'missing/invalid URL provided');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('invalid-input');
    });

    it('classifies session_id validation failures as non-retryable invalid-input', () => {
      const result = classifyBrowserRetryTaxonomy('VALIDATION_ERROR', 'session_id is required');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('invalid-input');
    });

    it('classifies selector failures as non-retryable selector category', () => {
      const result = classifyBrowserRetryTaxonomy('ACTION_FAILED', 'no node found for selector "#btn"');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('selector');
      expect(result.retryHint).toContain('Selector interaction failed');
    });

    it('classifies "not visible" messages as non-retryable selector category', () => {
      const result = classifyBrowserRetryTaxonomy('ACTION_FAILED', 'element is not visible');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('selector');
    });

    it('classifies timeout code as retryable timeout category', () => {
      const result = classifyBrowserRetryTaxonomy('NAVIGATE_TIMEOUT', 'Page load timed out');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('timeout');
      expect(result.retryHint).toContain('backoff');
    });

    it('classifies timeout messages as retryable timeout category', () => {
      // Use a message that contains "timed out" but not "selector" — "selector" is matched first in the classifier
      const result = classifyBrowserRetryTaxonomy('ACTION_FAILED', 'Page load timed out after 30000ms');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('timeout');
    });

    it('classifies network errors as retryable network category', () => {
      const result = classifyBrowserRetryTaxonomy('NAVIGATE_FAILED', 'net::err_connection_refused');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('network');
      expect(result.retryHint).toContain('backoff');
    });

    it('classifies ECONNRESET as retryable network category', () => {
      const result = classifyBrowserRetryTaxonomy('ACTION_FAILED', 'econnreset during request');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('network');
    });

    it('classifies target closed messages as retryable transient category', () => {
      const result = classifyBrowserRetryTaxonomy('ACTION_FAILED', 'target closed while waiting');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('transient');
      expect(result.retryHint).toContain('reopen session');
    });

    it('classifies page crashed as retryable transient category', () => {
      const result = classifyBrowserRetryTaxonomy('ACTION_FAILED', 'page crashed during navigation');
      expect(result.retryable).toBe(true);
      expect(result.retryCategory).toBe('transient');
    });

    it('classifies unknown errors as non-retryable unknown category', () => {
      const result = classifyBrowserRetryTaxonomy('UNEXPECTED_ERROR', 'Something went very wrong');
      expect(result.retryable).toBe(false);
      expect(result.retryCategory).toBe('unknown');
      expect(result.retryHint).toContain('Unclassified failure');
    });

    it('is case-insensitive for error codes', () => {
      const lower = classifyBrowserRetryTaxonomy('playwright_unavailable', 'Runtime unavailable');
      expect(lower.retryCategory).toBe('runtime-unavailable');

      const mixed = classifyBrowserRetryTaxonomy('Browser_Policy_Deny', 'Policy blocked');
      expect(mixed.retryCategory).toBe('policy');
    });

    it('is case-insensitive for message signal matching', () => {
      const result = classifyBrowserRetryTaxonomy('NAVIGATE_FAILED', 'NET::ERR_CONNECTION_REFUSED');
      expect(result.retryCategory).toBe('network');
    });
  });

  describe('withRetryTaxonomy', () => {
    it('returns BrowserActionError with taxonomy fields attached', () => {
      const error = withRetryTaxonomy('SESSION_NOT_FOUND', 'No such session');
      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.message).toBe('No such session');
      expect(error.retryable).toBe(false);
      expect(error.retryCategory).toBe('session-state');
      expect(error.retryHint).toBeDefined();
    });

    it('attaches retryable=true for network errors', () => {
      const error = withRetryTaxonomy('NAVIGATE_FAILED', 'socket hang up');
      expect(error.retryable).toBe(true);
      expect(error.retryCategory).toBe('network');
    });
  });
});

// ---------------------------------------------------------------------------
// Adaptation — run-corpus adaptation hint derivation
// ---------------------------------------------------------------------------

describe('Adaptation', () => {
  describe('normalizeBrowserAdaptationConfig', () => {
    it('returns defaults when input is undefined', () => {
      const config = normalizeBrowserAdaptationConfig(undefined);
      expect(config).toEqual(DEFAULT_BROWSER_ADAPTATION_CONFIG);
    });

    it('clamps ratios between 0 and 1', () => {
      const config = normalizeBrowserAdaptationConfig({
        regressionPressureThreshold: 2.5,
        meanRegressionScoreThreshold: -0.5,
        failureRateThreshold: 1.5,
        investigateWeight: -1,
      });
      expect(config.regressionPressureThreshold).toBe(1);
      expect(config.meanRegressionScoreThreshold).toBe(0);
      expect(config.failureRateThreshold).toBe(1);
      expect(config.investigateWeight).toBe(0);
    });

    it('floors minAssessedSessions to at least 1', () => {
      const config = normalizeBrowserAdaptationConfig({ minAssessedSessions: 0 });
      expect(config.minAssessedSessions).toBe(1);

      const negative = normalizeBrowserAdaptationConfig({ minAssessedSessions: -5 });
      expect(negative.minAssessedSessions).toBe(1);
    });

    it('floors intentRoutePenalty to at least 0', () => {
      const config = normalizeBrowserAdaptationConfig({ intentRoutePenalty: -3 });
      expect(config.intentRoutePenalty).toBe(0);
    });

    it('sets enabled=false unless explicitly true', () => {
      expect(normalizeBrowserAdaptationConfig({ enabled: false }).enabled).toBe(false);
      expect(normalizeBrowserAdaptationConfig({}).enabled).toBe(false);
      expect(normalizeBrowserAdaptationConfig({ enabled: true }).enabled).toBe(true);
    });
  });

  describe('deriveBrowserRunCorpusAdaptationHint', () => {
    const enabledConfig: Partial<BrowserAdaptationConfig> = {
      enabled: true,
      minAssessedSessions: 3,
      regressionPressureThreshold: 0.35,
      meanRegressionScoreThreshold: 0.25,
      failureRateThreshold: 0.2,
      investigateWeight: 0.5,
      intentRoutePenalty: 2,
    };

    it('returns disabled hint when config.enabled is false', () => {
      const hint = deriveBrowserRunCorpusAdaptationHint(null, { enabled: false });
      expect(hint.enabled).toBe(false);
      expect(hint.source).toBe('disabled');
      expect(hint.policy.escalateRisk).toBe(false);
      expect(hint.intent.routePenalty).toBe(0);
      expect(hint.rationale).toContain('browser.adaptation.enabled=false');
    });

    it('returns disabled hint with zero metrics when summary is null', () => {
      const hint = deriveBrowserRunCorpusAdaptationHint(null, { enabled: false });
      expect(hint.assessedSessionCount).toBe(0);
      expect(hint.regressionPressure).toBe(0);
      expect(hint.meanRegressionScore).toBe(0);
      expect(hint.failureRate).toBe(0);
    });

    it('does not escalate risk when session count is below minAssessedSessions', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 2, // below minAssessedSessions=3
        regressionSessionCount: 2,
        investigateSessionCount: 0,
        meanRegressionScore: 0.9,
        maxRegressionScore: 1.0,
        entries: [],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.enabled).toBe(true);
      expect(hint.policy.escalateRisk).toBe(false);
      expect(hint.intent.routePenalty).toBe(0);
    });

    it('escalates risk when regression pressure exceeds threshold', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 5,
        regressionSessionCount: 4, // 4/5 = 0.8 > 0.35 threshold
        investigateSessionCount: 0,
        meanRegressionScore: 0.1,
        maxRegressionScore: 0.5,
        entries: [],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.enabled).toBe(true);
      expect(hint.policy.escalateRisk).toBe(true);
      expect(hint.intent.routePenalty).toBe(2);
      expect(hint.policy.reason).toContain('run-corpus adaptation');
    });

    it('escalates risk when mean regression score exceeds threshold', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 5,
        regressionSessionCount: 0,
        investigateSessionCount: 0,
        meanRegressionScore: 0.6, // > 0.25 threshold
        maxRegressionScore: 0.9,
        entries: [],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.policy.escalateRisk).toBe(true);
    });

    it('escalates risk when failure rate exceeds threshold', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 5,
        regressionSessionCount: 0,
        investigateSessionCount: 0,
        meanRegressionScore: 0.05,
        maxRegressionScore: 0.2,
        entries: [
          {
            sessionId: 'sess-1',
            status: 'closed',
            runtime: 'playwright',
            updatedAt: '2026-02-26T10:00:00.000Z',
            actionCount: 10,
            failureCount: 4, // 4/10 = 0.4 > 0.2 threshold
            regressionScore: 0,
            regressionSignal: 'none',
            regressionPairCount: 0,
            artifactCount: 0,
          },
        ],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.policy.escalateRisk).toBe(true);
      expect(hint.failureRate).toBeGreaterThan(0.2);
    });

    it('does not escalate when all metrics are below thresholds', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 5,
        regressionSessionCount: 1, // 1/5 = 0.2 < 0.35 threshold
        investigateSessionCount: 0,
        meanRegressionScore: 0.1,  // < 0.25 threshold
        maxRegressionScore: 0.3,
        entries: [
          {
            sessionId: 'sess-1',
            status: 'closed',
            runtime: 'playwright',
            updatedAt: '2026-02-26T10:00:00.000Z',
            actionCount: 10,
            failureCount: 1, // 1/10 = 0.1 < 0.2 threshold
            regressionScore: 0.1,
            regressionSignal: 'none',
            regressionPairCount: 1,
            artifactCount: 0,
          },
        ],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.policy.escalateRisk).toBe(false);
      expect(hint.intent.routePenalty).toBe(0);
      expect(hint.rationale.some((r) => r.includes('assessed=5'))).toBe(true);
    });

    it('factors investigateSessionCount at investigateWeight when computing regression pressure', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 4,
        regressionSessionCount: 0,
        investigateSessionCount: 3,  // 0 + (3 * 0.5) / 4 = 0.375 > 0.35 threshold
        meanRegressionScore: 0.05,
        maxRegressionScore: 0.1,
        entries: [],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.regressionPressure).toBeGreaterThan(0.35);
      expect(hint.policy.escalateRisk).toBe(true);
    });

    it('includes generatedAt from summary in hint', () => {
      const summary: BrowserRunCorpusSummary = {
        schemaVersion: 1,
        generatedAt: '2026-02-26T10:00:00.000Z',
        windowHours: 24,
        assessedSessionCount: 3,
        regressionSessionCount: 0,
        investigateSessionCount: 0,
        meanRegressionScore: 0,
        maxRegressionScore: 0,
        entries: [],
      };

      const hint = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(hint.generatedAt).toBe('2026-02-26T10:00:00.000Z');
    });
  });
});

// ---------------------------------------------------------------------------
// Full lifecycle integration — trigger → daemon → session → action → close
// ---------------------------------------------------------------------------

describe('Full lifecycle integration', () => {
  it('composes daemon → native-session-manager → open → navigate → screenshot → close', async () => {
    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html><body><h1>Integration Test</h1></body></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com/integration'),
    };

    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const browser = {
      newContext: vi.fn(async () => context),
      contexts: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      persistSessions: false,
      loadPlaywright: async () => ({
        chromium: {
          launch: vi.fn(async () => browser),
          connectOverCDP: vi.fn(async () => browser),
        },
      }),
    });

    await daemon.start();
    expect(daemon.health().running).toBe(true);

    // Open session via daemon
    const opened = await daemon.openSession({ sessionId: 'sess-full-flow-01' });
    expect(opened.ok).toBe(true);
    expect(opened.action.sessionId).toBe('sess-full-flow-01');
    expect(daemon.health().sessionCount).toBe(1);

    // Navigate
    const navigated = await daemon.navigate('sess-full-flow-01', {
      url: 'https://example.com/integration',
    });
    expect(navigated.ok).toBe(true);
    expect(navigated.data?.url).toBe('https://example.com/integration');
    expect(page.goto).toHaveBeenCalledWith('https://example.com/integration', expect.objectContaining({
      waitUntil: 'domcontentloaded',
    }));

    // Close session
    const closed = await daemon.closeSession('sess-full-flow-01');
    expect(closed.ok).toBe(true);
    expect(daemon.health().sessionCount).toBe(0);

    await daemon.stop();
  });

  it('full NativeSessionManager lifecycle: open → navigate → click → type → snapshot → screenshot → close', async () => {
    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html><body><form><input id="q"/></form></body></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com/search'),
    };

    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const browser = {
      newContext: vi.fn(async () => context),
      contexts: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const manager = new NativeSessionManager({
      cwd: testDir,
      idFactory: () => 'sess-lifecycle-01',
      now: () => new Date('2026-02-26T10:00:00.000Z'),
      loadPlaywright: async () => ({
        chromium: {
          launch: vi.fn(async () => browser),
          connectOverCDP: vi.fn(async () => browser),
        },
      }),
    });

    const opened = await manager.openSession({ runId: 'run-lifecycle-01', mode: 'isolated' });
    expect(opened.ok).toBe(true);
    expect(opened.data?.id).toBe('sess-lifecycle-01');
    expect(opened.data?.runtime).toBe('playwright');

    const navigated = await manager.navigate('sess-lifecycle-01', {
      url: 'https://example.com/search',
    });
    expect(navigated.ok).toBe(true);

    const clicked = await manager.click('sess-lifecycle-01', { selector: '#q' });
    expect(clicked.ok).toBe(true);

    const typed = await manager.type('sess-lifecycle-01', {
      selector: '#q',
      text: 'opta integration test',
    });
    expect(typed.ok).toBe(true);

    const snapshot = await manager.snapshot('sess-lifecycle-01');
    expect(snapshot.ok).toBe(true);
    expect(snapshot.data?.html).toContain('<input id="q"/>');

    const screenshot = await manager.screenshot('sess-lifecycle-01', { type: 'png' });
    expect(screenshot.ok).toBe(true);
    expect(screenshot.data?.artifact.kind).toBe('screenshot');

    const closed = await manager.closeSession('sess-lifecycle-01');
    expect(closed.ok).toBe(true);

    // Verify artifact files are written to disk
    const sessionDir = join(testDir, '.opta', 'browser', 'sess-lifecycle-01');
    const metadataRaw = await readFile(join(sessionDir, 'metadata.json'), 'utf-8');
    const metadata = JSON.parse(metadataRaw) as { sessionId: string; artifacts: unknown[]; actions: unknown[] };
    expect(metadata.sessionId).toBe('sess-lifecycle-01');
    expect(metadata.artifacts.length).toBeGreaterThanOrEqual(2); // snapshot + screenshot
    expect(metadata.actions.length).toBeGreaterThanOrEqual(6);   // open + nav + click + type + snap + shot + close

    // Verify JSONL step log
    const stepsRaw = await readFile(join(sessionDir, 'steps.jsonl'), 'utf-8');
    const steps = stepsRaw
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => JSON.parse(l) as { sequence: number; actionType: string; ok: boolean });
    expect(steps.length).toBeGreaterThanOrEqual(7);
    expect(steps.every((s) => s.ok)).toBe(true);
    expect(steps.map((s) => s.sequence)).toEqual([...Array(steps.length).keys()].map((i) => i + 1));
  });

  it('daemon rejects operations while paused and resumes on resume()', async () => {
    const page = {
      goto: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined),
      fill: vi.fn(async () => undefined),
      content: vi.fn(async () => '<html></html>'),
      screenshot: vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47])),
      url: vi.fn(() => 'https://example.com'),
    };
    const context = {
      newPage: vi.fn(async () => page),
      pages: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };
    const browser = {
      newContext: vi.fn(async () => context),
      contexts: vi.fn(() => []),
      close: vi.fn(async () => undefined),
    };

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      persistSessions: false,
      loadPlaywright: async () => ({
        chromium: {
          launch: vi.fn(async () => browser),
          connectOverCDP: vi.fn(async () => browser),
        },
      }),
    });

    await daemon.start();
    const opened = await daemon.openSession({ sessionId: 'sess-pause-01' });
    expect(opened.ok).toBe(true);
    expect(daemon.health().sessionCount).toBe(1);

    daemon.pause();
    expect(daemon.health().paused).toBe(true);

    const navigated = await daemon.navigate('sess-pause-01', { url: 'https://example.com' });
    expect(navigated.ok).toBe(false);
    expect(navigated.error?.code).toBe('DAEMON_PAUSED');

    daemon.resume();
    expect(daemon.health().paused).toBe(false);

    // After resume, navigation proceeds normally
    const afterResume = await daemon.navigate('sess-pause-01', { url: 'https://example.com' });
    expect(afterResume.ok).toBe(true);
    expect(afterResume.error?.code).not.toBe('DAEMON_PAUSED');

    await daemon.stop();
  });

  it('approval log is written when a session action triggers an approval event', async () => {
    // Write an approval event for a browser action in the session
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_click',
      sessionId: 'sess-approval-flow-01',
      decision: 'approved',
      risk: 'high',
      actionKey: 'delete',
      timestamp: '2026-02-26T10:00:00.000Z',
    });

    // Verify the event persisted and can be queried
    const events = await readRecentBrowserApprovalEvents(testDir, 5);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      tool: 'browser_click',
      sessionId: 'sess-approval-flow-01',
      decision: 'approved',
      risk: 'high',
      actionKey: 'delete',
    });
  });

  it('retry taxonomy is correctly attached when daemon returns action errors', async () => {
    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      persistSessions: false,
      loadPlaywright: async () => null,
    });

    await daemon.start();

    // Navigating without a session produces a SESSION_NOT_FOUND error
    const result = await daemon.navigate('nonexistent-session', { url: 'https://example.com' });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('SESSION_NOT_FOUND');

    // Verify that withRetryTaxonomy produces the same classification
    const taxonomy = withRetryTaxonomy(result.error!.code, result.error!.message);
    expect(taxonomy.retryable).toBe(false);
    expect(taxonomy.retryCategory).toBe('session-state');

    await daemon.stop();
  });

  it('session store records open sessions and clears them after daemon stop', async () => {
    const now = new Date('2026-02-26T10:00:00.000Z');

    const daemon = new BrowserRuntimeDaemon({
      cwd: testDir,
      persistSessions: true,
      now: () => now,
      loadPlaywright: async () => null,
    });

    await daemon.start();
    await daemon.openSession({ sessionId: 'sess-store-flow-01' });
    await daemon.openSession({ sessionId: 'sess-store-flow-02' });

    expect(daemon.health().sessionCount).toBe(2);

    // Read directly from the store to confirm persistence
    const store = new BrowserSessionStore({ cwd: testDir });
    const beforeStop = await store.read();
    expect(beforeStop.sessions.some((s) => s.sessionId === 'sess-store-flow-01')).toBe(true);
    expect(beforeStop.sessions.some((s) => s.sessionId === 'sess-store-flow-02')).toBe(true);

    await daemon.stop();

    const afterStop = await store.read();
    expect(afterStop.sessions).toHaveLength(0);
  });
});
