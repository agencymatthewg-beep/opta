import { describe, expect, it, vi } from 'vitest';
import type { BrowserRunCorpusSummary, BrowserRunCorpusEntry } from '../../src/browser/run-corpus.js';
import {
  DEFAULT_BROWSER_ADAPTATION_CONFIG,
  normalizeBrowserAdaptationConfig,
  deriveBrowserRunCorpusAdaptationHint,
  loadBrowserRunCorpusAdaptationHint,
  type BrowserAdaptationConfig,
} from '../../src/browser/adaptation.js';

vi.mock('../../src/browser/run-corpus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/browser/run-corpus.js')>();
  return {
    ...actual,
    readLatestBrowserRunCorpusSummary: vi.fn(),
  };
});

function makeEntry(overrides: Partial<BrowserRunCorpusEntry> = {}): BrowserRunCorpusEntry {
  return {
    sessionId: overrides.sessionId ?? 'session-1',
    status: 'closed',
    runtime: 'playwright',
    updatedAt: '2026-02-23T20:00:00.000Z',
    actionCount: overrides.actionCount ?? 10,
    artifactCount: 2,
    failureCount: overrides.failureCount ?? 0,
    regressionScore: overrides.regressionScore ?? 0,
    regressionSignal: overrides.regressionSignal ?? 'none',
    regressionPairCount: 1,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<BrowserRunCorpusSummary> = {}): BrowserRunCorpusSummary {
  return {
    schemaVersion: 1,
    generatedAt: '2026-02-23T21:00:00.000Z',
    windowHours: 168,
    assessedSessionCount: overrides.assessedSessionCount ?? 5,
    regressionSessionCount: overrides.regressionSessionCount ?? 0,
    investigateSessionCount: overrides.investigateSessionCount ?? 0,
    meanRegressionScore: overrides.meanRegressionScore ?? 0,
    maxRegressionScore: overrides.maxRegressionScore ?? 0,
    entries: overrides.entries ?? [makeEntry()],
    ...overrides,
  };
}

describe('DEFAULT_BROWSER_ADAPTATION_CONFIG', () => {
  it('has correct default values', () => {
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.enabled).toBe(false);
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.minAssessedSessions).toBe(3);
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.regressionPressureThreshold).toBe(0.35);
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.meanRegressionScoreThreshold).toBe(0.25);
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.failureRateThreshold).toBe(0.2);
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.investigateWeight).toBe(0.5);
    expect(DEFAULT_BROWSER_ADAPTATION_CONFIG.intentRoutePenalty).toBe(2);
  });
});

describe('normalizeBrowserAdaptationConfig', () => {
  it('returns defaults when input is undefined', () => {
    const result = normalizeBrowserAdaptationConfig(undefined);
    expect(result).toEqual(DEFAULT_BROWSER_ADAPTATION_CONFIG);
  });

  it('returns defaults when input is empty object', () => {
    const result = normalizeBrowserAdaptationConfig({});
    expect(result).toEqual(DEFAULT_BROWSER_ADAPTATION_CONFIG);
  });

  it('preserves enabled=true', () => {
    const result = normalizeBrowserAdaptationConfig({ enabled: true });
    expect(result.enabled).toBe(true);
  });

  it('forces enabled to false for non-true values', () => {
    // undefined defaults to false
    const result = normalizeBrowserAdaptationConfig({ enabled: undefined });
    expect(result.enabled).toBe(false);
  });

  it('clamps minAssessedSessions to at least 1', () => {
    expect(normalizeBrowserAdaptationConfig({ minAssessedSessions: 0 }).minAssessedSessions).toBe(1);
    expect(normalizeBrowserAdaptationConfig({ minAssessedSessions: -5 }).minAssessedSessions).toBe(1);
  });

  it('floors fractional minAssessedSessions', () => {
    expect(normalizeBrowserAdaptationConfig({ minAssessedSessions: 3.9 }).minAssessedSessions).toBe(3);
  });

  it('clamps thresholds to [0,1] range', () => {
    const result = normalizeBrowserAdaptationConfig({
      regressionPressureThreshold: 1.5,
      meanRegressionScoreThreshold: -0.5,
      failureRateThreshold: 2.0,
      investigateWeight: -1,
    });
    expect(result.regressionPressureThreshold).toBe(1);
    expect(result.meanRegressionScoreThreshold).toBe(0);
    expect(result.failureRateThreshold).toBe(1);
    expect(result.investigateWeight).toBe(0);
  });

  it('rounds thresholds to 4 decimal places', () => {
    const result = normalizeBrowserAdaptationConfig({
      regressionPressureThreshold: 0.123456789,
    });
    expect(result.regressionPressureThreshold).toBe(0.1235);
  });

  it('handles NaN/Infinity in thresholds by returning 0', () => {
    const result = normalizeBrowserAdaptationConfig({
      regressionPressureThreshold: NaN,
      meanRegressionScoreThreshold: Infinity,
      failureRateThreshold: -Infinity,
    });
    expect(result.regressionPressureThreshold).toBe(0);
    expect(result.meanRegressionScoreThreshold).toBe(0);
    expect(result.failureRateThreshold).toBe(0);
  });

  it('clamps intentRoutePenalty to at least 0 and floors', () => {
    expect(normalizeBrowserAdaptationConfig({ intentRoutePenalty: -3 }).intentRoutePenalty).toBe(0);
    expect(normalizeBrowserAdaptationConfig({ intentRoutePenalty: 5.8 }).intentRoutePenalty).toBe(5);
  });
});

describe('deriveBrowserRunCorpusAdaptationHint', () => {
  describe('when disabled', () => {
    it('returns disabled hint with source=disabled', () => {
      const result = deriveBrowserRunCorpusAdaptationHint(null, { enabled: false });
      expect(result.enabled).toBe(false);
      expect(result.source).toBe('disabled');
      expect(result.policy.escalateRisk).toBe(false);
      expect(result.intent.routePenalty).toBe(0);
      expect(result.rationale).toEqual(['browser.adaptation.enabled=false']);
    });

    it('returns disabled hint for undefined config', () => {
      const result = deriveBrowserRunCorpusAdaptationHint(null, undefined);
      expect(result.enabled).toBe(false);
      expect(result.source).toBe('disabled');
    });

    it('still computes metrics even when disabled', () => {
      const summary = makeSummary({
        assessedSessionCount: 5,
        regressionSessionCount: 2,
        investigateSessionCount: 1,
        entries: [
          makeEntry({ actionCount: 10, failureCount: 3 }),
          makeEntry({ sessionId: 's2', actionCount: 10, failureCount: 2 }),
        ],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, { enabled: false });
      expect(result.enabled).toBe(false);
      expect(result.assessedSessionCount).toBe(5);
      expect(result.regressionPressure).toBeGreaterThan(0);
      expect(result.failureRate).toBeGreaterThan(0);
    });

    it('passes generatedAt from summary', () => {
      const summary = makeSummary({ generatedAt: '2026-02-24T10:00:00.000Z' });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, { enabled: false });
      expect(result.generatedAt).toBe('2026-02-24T10:00:00.000Z');
    });
  });

  describe('when enabled', () => {
    const enabledConfig: Partial<BrowserAdaptationConfig> = {
      enabled: true,
      minAssessedSessions: 3,
      regressionPressureThreshold: 0.35,
      meanRegressionScoreThreshold: 0.25,
      failureRateThreshold: 0.2,
      investigateWeight: 0.5,
      intentRoutePenalty: 2,
    };

    it('returns enabled with source=run-corpus', () => {
      const summary = makeSummary({ assessedSessionCount: 5 });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.enabled).toBe(true);
      expect(result.source).toBe('run-corpus');
    });

    it('does not escalate when no regressions and enough samples', () => {
      const summary = makeSummary({
        assessedSessionCount: 5,
        regressionSessionCount: 0,
        investigateSessionCount: 0,
        meanRegressionScore: 0,
        entries: [makeEntry({ actionCount: 10, failureCount: 0 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.policy.escalateRisk).toBe(false);
      expect(result.intent.routePenalty).toBe(0);
      expect(result.intent.reason).toBeUndefined();
      expect(result.policy.reason).toBeUndefined();
    });

    it('does not escalate when below minAssessedSessions even with high regression', () => {
      const summary = makeSummary({
        assessedSessionCount: 2, // below threshold of 3
        regressionSessionCount: 2,
        investigateSessionCount: 0,
        meanRegressionScore: 0.9,
        entries: [
          makeEntry({ actionCount: 10, failureCount: 8 }),
          makeEntry({ sessionId: 's2', actionCount: 10, failureCount: 9 }),
        ],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.policy.escalateRisk).toBe(false);
      expect(result.intent.routePenalty).toBe(0);
    });

    it('escalates when regression pressure exceeds threshold', () => {
      const summary = makeSummary({
        assessedSessionCount: 5,
        regressionSessionCount: 3, // 3/5 = 0.6 > 0.35
        investigateSessionCount: 0,
        meanRegressionScore: 0.1,
        entries: [makeEntry({ actionCount: 10, failureCount: 0 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.policy.escalateRisk).toBe(true);
      expect(result.intent.routePenalty).toBe(2);
      expect(result.policy.reason).toContain('run-corpus adaptation');
      expect(result.intent.reason).toContain('run-corpus adaptation');
    });

    it('escalates when mean regression score exceeds threshold', () => {
      const summary = makeSummary({
        assessedSessionCount: 5,
        regressionSessionCount: 0,
        investigateSessionCount: 0,
        meanRegressionScore: 0.3, // > 0.25
        entries: [makeEntry({ actionCount: 10, failureCount: 0 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.policy.escalateRisk).toBe(true);
      expect(result.intent.routePenalty).toBe(2);
    });

    it('escalates when failure rate exceeds threshold', () => {
      const summary = makeSummary({
        assessedSessionCount: 5,
        regressionSessionCount: 0,
        investigateSessionCount: 0,
        meanRegressionScore: 0,
        entries: [
          makeEntry({ actionCount: 10, failureCount: 5 }),
          makeEntry({ sessionId: 's2', actionCount: 10, failureCount: 5 }),
        ],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      // failureRate = 10/20 = 0.5 > 0.2
      expect(result.policy.escalateRisk).toBe(true);
    });

    it('accounts for investigateWeight in regression pressure', () => {
      const summary = makeSummary({
        assessedSessionCount: 10,
        regressionSessionCount: 0,
        investigateSessionCount: 8, // (0 + 8*0.5)/10 = 0.4 > 0.35
        meanRegressionScore: 0,
        entries: [makeEntry({ actionCount: 10, failureCount: 0 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.regressionPressure).toBe(0.4);
      expect(result.policy.escalateRisk).toBe(true);
    });

    it('returns rationale with all parts', () => {
      const summary = makeSummary({ assessedSessionCount: 5 });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, enabledConfig);
      expect(result.rationale.length).toBe(5);
      expect(result.rationale[0]).toContain('assessed=');
      expect(result.rationale[1]).toContain('regressionPressure=');
      expect(result.rationale[2]).toContain('meanRegressionScore=');
      expect(result.rationale[3]).toContain('failureRate=');
      expect(result.rationale[4]).toContain('minAssessedSessions=');
    });
  });

  describe('null summary handling', () => {
    it('returns zero metrics for null summary', () => {
      const result = deriveBrowserRunCorpusAdaptationHint(null, { enabled: true, minAssessedSessions: 1 });
      expect(result.assessedSessionCount).toBe(0);
      expect(result.regressionPressure).toBe(0);
      expect(result.meanRegressionScore).toBe(0);
      expect(result.maxRegressionScore).toBe(0);
      expect(result.failureRate).toBe(0);
    });

    it('generatedAt is undefined for null summary', () => {
      const result = deriveBrowserRunCorpusAdaptationHint(null, { enabled: true });
      expect(result.generatedAt).toBeUndefined();
    });
  });

  describe('failure rate edge cases', () => {
    it('returns 0 failure rate when entries have 0 actions', () => {
      const summary = makeSummary({
        entries: [makeEntry({ actionCount: 0, failureCount: 0 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, { enabled: true });
      expect(result.failureRate).toBe(0);
    });

    it('returns 0 failure rate for empty entries', () => {
      const summary = makeSummary({ entries: [] });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, { enabled: true });
      expect(result.failureRate).toBe(0);
    });

    it('clamps failure rate to 1 even with more failures than actions', () => {
      const summary = makeSummary({
        entries: [makeEntry({ actionCount: 5, failureCount: 10 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, { enabled: true });
      expect(result.failureRate).toBeLessThanOrEqual(1);
    });

    it('handles negative action/failure counts by treating them as 0', () => {
      const summary = makeSummary({
        entries: [makeEntry({ actionCount: -5, failureCount: -3 })],
      });
      const result = deriveBrowserRunCorpusAdaptationHint(summary, { enabled: true });
      expect(result.failureRate).toBe(0);
    });
  });
});

describe('loadBrowserRunCorpusAdaptationHint', () => {
  it('reads summary from disk and derives hint', async () => {
    const { readLatestBrowserRunCorpusSummary } = await import('../../src/browser/run-corpus.js');
    const mockRead = vi.mocked(readLatestBrowserRunCorpusSummary);
    const summary = makeSummary({ assessedSessionCount: 5 });
    mockRead.mockResolvedValue(summary);

    const result = await loadBrowserRunCorpusAdaptationHint('/tmp/test', { enabled: true });
    expect(mockRead).toHaveBeenCalledWith('/tmp/test');
    expect(result.enabled).toBe(true);
    expect(result.source).toBe('run-corpus');
    expect(result.assessedSessionCount).toBe(5);
  });

  it('returns disabled hint when summary is null', async () => {
    const { readLatestBrowserRunCorpusSummary } = await import('../../src/browser/run-corpus.js');
    const mockRead = vi.mocked(readLatestBrowserRunCorpusSummary);
    mockRead.mockResolvedValue(null);

    const result = await loadBrowserRunCorpusAdaptationHint('/tmp/test', { enabled: false });
    expect(result.enabled).toBe(false);
    expect(result.source).toBe('disabled');
  });
});
