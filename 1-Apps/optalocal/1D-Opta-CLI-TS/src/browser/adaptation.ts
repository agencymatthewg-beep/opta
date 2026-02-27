import {
  readLatestBrowserRunCorpusSummary,
  type BrowserRunCorpusSummary,
} from './run-corpus.js';
import { clamp } from '../utils/common.js';

export interface BrowserAdaptationConfig {
  enabled: boolean;
  minAssessedSessions: number;
  regressionPressureThreshold: number;
  meanRegressionScoreThreshold: number;
  failureRateThreshold: number;
  investigateWeight: number;
  intentRoutePenalty: number;
}

export interface BrowserPolicyAdaptationHint {
  escalateRisk: boolean;
  reason?: string;
  regressionPressure: number;
  meanRegressionScore: number;
  failureRate: number;
}

export interface BrowserIntentAdaptationHint {
  routePenalty: number;
  reason?: string;
  regressionPressure: number;
  meanRegressionScore: number;
  failureRate: number;
}

export interface BrowserRunCorpusAdaptationHint {
  enabled: boolean;
  source: 'disabled' | 'run-corpus';
  generatedAt?: string;
  assessedSessionCount: number;
  regressionPressure: number;
  meanRegressionScore: number;
  maxRegressionScore: number;
  failureRate: number;
  intent: BrowserIntentAdaptationHint;
  policy: BrowserPolicyAdaptationHint;
  rationale: string[];
}

export const DEFAULT_BROWSER_ADAPTATION_CONFIG: BrowserAdaptationConfig = {
  enabled: false,
  minAssessedSessions: 3,
  regressionPressureThreshold: 0.35,
  meanRegressionScoreThreshold: 0.25,
  failureRateThreshold: 0.2,
  investigateWeight: 0.5,
  intentRoutePenalty: 2,
};

function normalizedRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number(clamp(value, 0, 1).toFixed(4));
}

function toSafeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function aggregateFailureRate(summary: BrowserRunCorpusSummary | null): number {
  if (!summary || summary.entries.length === 0) return 0;
  const totals = summary.entries.reduce(
    (state, entry) => {
      state.actions += Math.max(entry.actionCount, 0);
      state.failures += Math.max(entry.failureCount, 0);
      return state;
    },
    { actions: 0, failures: 0 },
  );

  if (totals.actions <= 0) return 0;
  return normalizedRatio(totals.failures / totals.actions);
}

export function normalizeBrowserAdaptationConfig(
  input: Partial<BrowserAdaptationConfig> | undefined,
): BrowserAdaptationConfig {
  const fallback = DEFAULT_BROWSER_ADAPTATION_CONFIG;
  return {
    enabled: input?.enabled === true,
    minAssessedSessions: Math.max(1, Math.floor(input?.minAssessedSessions ?? fallback.minAssessedSessions)),
    regressionPressureThreshold: normalizedRatio(input?.regressionPressureThreshold ?? fallback.regressionPressureThreshold),
    meanRegressionScoreThreshold: normalizedRatio(input?.meanRegressionScoreThreshold ?? fallback.meanRegressionScoreThreshold),
    failureRateThreshold: normalizedRatio(input?.failureRateThreshold ?? fallback.failureRateThreshold),
    investigateWeight: normalizedRatio(input?.investigateWeight ?? fallback.investigateWeight),
    intentRoutePenalty: Math.max(0, Math.floor(input?.intentRoutePenalty ?? fallback.intentRoutePenalty)),
  };
}

export function deriveBrowserRunCorpusAdaptationHint(
  summary: BrowserRunCorpusSummary | null,
  configInput: Partial<BrowserAdaptationConfig> | undefined,
): BrowserRunCorpusAdaptationHint {
  const config = normalizeBrowserAdaptationConfig(configInput);

  const assessedSessionCount = summary?.assessedSessionCount ?? 0;
  const regressionPressure = assessedSessionCount > 0
    ? normalizedRatio(
      (
        (summary?.regressionSessionCount ?? 0)
        + ((summary?.investigateSessionCount ?? 0) * config.investigateWeight)
      )
      / assessedSessionCount,
    )
    : 0;
  const meanRegressionScore = normalizedRatio(toSafeNumber(summary?.meanRegressionScore ?? 0));
  const maxRegressionScore = normalizedRatio(toSafeNumber(summary?.maxRegressionScore ?? 0));
  const failureRate = aggregateFailureRate(summary);

  if (!config.enabled) {
    return {
      enabled: false,
      source: 'disabled',
      assessedSessionCount,
      generatedAt: summary?.generatedAt,
      regressionPressure,
      meanRegressionScore,
      maxRegressionScore,
      failureRate,
      intent: {
        routePenalty: 0,
        regressionPressure,
        meanRegressionScore,
        failureRate,
      },
      policy: {
        escalateRisk: false,
        regressionPressure,
        meanRegressionScore,
        failureRate,
      },
      rationale: ['browser.adaptation.enabled=false'],
    };
  }

  const enoughSamples = assessedSessionCount >= config.minAssessedSessions;
  const pressureExceeded = regressionPressure >= config.regressionPressureThreshold;
  const meanExceeded = meanRegressionScore >= config.meanRegressionScoreThreshold;
  const failureExceeded = failureRate >= config.failureRateThreshold;
  const escalate = enoughSamples && (pressureExceeded || meanExceeded || failureExceeded);
  const reasonParts: string[] = [
    `assessed=${assessedSessionCount}`,
    `regressionPressure=${regressionPressure.toFixed(4)}>=${config.regressionPressureThreshold.toFixed(4)}:${String(pressureExceeded)}`,
    `meanRegressionScore=${meanRegressionScore.toFixed(4)}>=${config.meanRegressionScoreThreshold.toFixed(4)}:${String(meanExceeded)}`,
    `failureRate=${failureRate.toFixed(4)}>=${config.failureRateThreshold.toFixed(4)}:${String(failureExceeded)}`,
    `minAssessedSessions=${config.minAssessedSessions}:${String(enoughSamples)}`,
  ];

  const reason = `run-corpus adaptation (${reasonParts.join('; ')})`;

  return {
    enabled: true,
    source: 'run-corpus',
    generatedAt: summary?.generatedAt,
    assessedSessionCount,
    regressionPressure,
    meanRegressionScore,
    maxRegressionScore,
    failureRate,
    intent: {
      routePenalty: escalate ? config.intentRoutePenalty : 0,
      reason: escalate ? reason : undefined,
      regressionPressure,
      meanRegressionScore,
      failureRate,
    },
    policy: {
      escalateRisk: escalate,
      reason: escalate ? reason : undefined,
      regressionPressure,
      meanRegressionScore,
      failureRate,
    },
    rationale: reasonParts,
  };
}

export async function loadBrowserRunCorpusAdaptationHint(
  cwd: string,
  configInput: Partial<BrowserAdaptationConfig> | undefined,
): Promise<BrowserRunCorpusAdaptationHint> {
  const summary = await readLatestBrowserRunCorpusSummary(cwd);
  return deriveBrowserRunCorpusAdaptationHint(summary, configInput);
}
