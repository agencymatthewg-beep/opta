import { access, readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import {
  BROWSER_SESSION_METADATA_FILE,
  BROWSER_SESSION_RECORDINGS_FILE,
  BROWSER_SESSION_STEPS_FILE,
  BROWSER_VISUAL_DIFF_MANIFEST_FILE,
  browserSessionMetadataPath,
  browserSessionRecordingsPath,
  browserSessionStepsPath,
  browserSessionVisualDiffManifestPath,
} from './artifacts.js';
import type {
  BrowserArtifactMetadata,
  BrowserSessionMetadata,
  BrowserSessionRecordingEntry,
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserVisualDiffManifestEntry,
} from './types.js';

export interface BrowserArtifactCompletenessCounts {
  metadataActions: number;
  metadataArtifacts: number;
  stepEntries: number;
  recordingEntries: number;
  visualDiffEntries: number;
  stepArtifactRefs: number;
  recordingArtifactRefs: number;
  visualDiffArtifactRefs: number;
}

export interface BrowserArtifactCompletenessResult {
  ok: boolean;
  sessionId: string;
  missingFiles: string[];
  issues: string[];
  counts: BrowserArtifactCompletenessCounts;
}

export interface BrowserBenchmarkMetrics {
  successRate: number;
  medianActionLatencyMs: number;
  recoveryMs: number;
}

export interface BrowserBenchmarkThresholds {
  minSuccessRate: number;
  maxMedianActionLatencyMs: number;
  maxRecoveryMs: number;
}

export interface BrowserBenchmarkThresholdResult {
  ok: boolean;
  failures: string[];
  metrics: BrowserBenchmarkMetrics;
  thresholds: BrowserBenchmarkThresholds;
}

export interface BrowserBenchmarkTelemetryIngestionResult {
  ok: boolean;
  sessionId: string;
  issues: string[];
  actionCount: number;
  successCount: number;
  failureCount: number;
  latencySamplesMs: number[];
  recoverySamplesMs: number[];
  metrics: BrowserBenchmarkMetrics;
}

export interface BrowserBenchmarkThresholdFeedResult extends BrowserBenchmarkThresholdResult {
  sessionId: string;
  ingestion: BrowserBenchmarkTelemetryIngestionResult;
}

export const DEFAULT_BROWSER_BENCHMARK_THRESHOLDS: BrowserBenchmarkThresholds = {
  minSuccessRate: 0.95,
  maxMedianActionLatencyMs: 1200,
  maxRecoveryMs: 3000,
};

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sumArtifactRefs(entries: Array<{ artifactIds: string[] }>): number {
  return entries.reduce((sum, entry) => sum + entry.artifactIds.length, 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[midpoint] ?? 0;
  return ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2;
}

function flattenArtifactIds(entries: Array<{ artifactIds: string[] }>): string[] {
  return entries.flatMap((entry) => entry.artifactIds);
}

function flattenArtifactPaths(entries: Array<{ artifactPaths: string[] }>): string[] {
  return entries.flatMap((entry) => entry.artifactPaths);
}

function resolveMetadataArtifactPath(cwd: string, artifact: BrowserArtifactMetadata): string {
  if (artifact.absolutePath.trim().length > 0) {
    return artifact.absolutePath;
  }
  return isAbsolute(artifact.relativePath)
    ? artifact.relativePath
    : join(cwd, artifact.relativePath);
}

function compareStringSets(
  expected: string[],
  actual: string[],
  expectedLabel: string,
  actualLabel: string,
  issues: string[]
): void {
  const missing = expected.filter((value) => !actual.includes(value));
  const unexpected = actual.filter((value) => !expected.includes(value));

  if (missing.length > 0 || unexpected.length > 0) {
    const missingList = missing.length > 0 ? missing.join(', ') : 'none';
    const unexpectedList = unexpected.length > 0 ? unexpected.join(', ') : 'none';
    issues.push(
      `${actualLabel} does not match ${expectedLabel} (missing: ${missingList}; unexpected: ${unexpectedList}).`
    );
  }
}

function verifySequence(
  sourceLabel: string,
  entries: Array<{ sequence: number }>,
  issues: string[]
): void {
  for (let index = 0; index < entries.length; index += 1) {
    const expectedSequence = index + 1;
    const actualSequence = entries[index]?.sequence;
    if (actualSequence !== expectedSequence) {
      issues.push(
        `${sourceLabel} has non-contiguous sequence at index ${index} (expected ${expectedSequence}, got ${String(actualSequence)}).`
      );
      return;
    }
  }
}

function verifySessionIds(
  sourceLabel: string,
  entries: Array<{ sessionId: string }>,
  expectedSessionId: string,
  issues: string[]
): void {
  for (const [index, entry] of entries.entries()) {
    if (entry.sessionId !== expectedSessionId) {
      issues.push(
        `${sourceLabel} entry ${index} has sessionId ${entry.sessionId} but expected ${expectedSessionId}.`
      );
      return;
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return false;
    throw error;
  }
}

function parseJsonl<T>(raw: string, sourceLabel: string, issues: string[]): T[] {
  const entries: T[] = [];
  const lines = raw.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) continue;

    try {
      entries.push(JSON.parse(line) as T);
    } catch {
      issues.push(`${sourceLabel} contains invalid JSON at line ${index + 1}.`);
      return [];
    }
  }

  return entries;
}

function parseTimestampMs(label: string, timestamp: string, issues: string[]): number | null {
  const value = Date.parse(timestamp);
  if (Number.isFinite(value)) return value;
  issues.push(`${label} has invalid timestamp "${timestamp}".`);
  return null;
}

function toCounts(
  metadata: BrowserSessionMetadata | null,
  steps: BrowserSessionStepRecord[],
  recordings: BrowserSessionRecordingEntry[],
  visualDiffEntries: BrowserVisualDiffManifestEntry[]
): BrowserArtifactCompletenessCounts {
  return {
    metadataActions: metadata?.actions.length ?? 0,
    metadataArtifacts: metadata?.artifacts.length ?? 0,
    stepEntries: steps.length,
    recordingEntries: recordings.length,
    visualDiffEntries: visualDiffEntries.length,
    stepArtifactRefs: sumArtifactRefs(steps),
    recordingArtifactRefs: sumArtifactRefs(recordings),
    visualDiffArtifactRefs: sumArtifactRefs(visualDiffEntries),
  };
}

function compareActionCounts(
  metadata: BrowserSessionMetadata | null,
  steps: BrowserSessionStepRecord[],
  recordings: BrowserSessionRecordingEntry[],
  visualDiffEntries: BrowserVisualDiffManifestEntry[],
  issues: string[]
): void {
  const metadataActions = metadata?.actions.length;

  if (metadataActions !== undefined && metadataActions !== steps.length) {
    issues.push(
      `metadata.json action count (${metadataActions}) does not match steps.jsonl count (${steps.length}).`
    );
  }

  if (metadataActions !== undefined && metadataActions !== recordings.length) {
    issues.push(
      `metadata.json action count (${metadataActions}) does not match recordings.json count (${recordings.length}).`
    );
  }

  if (steps.length !== recordings.length) {
    issues.push(
      `steps.jsonl count (${steps.length}) does not match recordings.json count (${recordings.length}).`
    );
  }

  if (steps.length !== visualDiffEntries.length) {
    issues.push(
      `steps.jsonl count (${steps.length}) does not match visual-diff-manifest.jsonl count (${visualDiffEntries.length}).`
    );
  }
}

function compareArtifactReferenceCounts(
  metadata: BrowserSessionMetadata | null,
  counts: BrowserArtifactCompletenessCounts,
  issues: string[]
): void {
  if (!metadata) return;

  if (counts.stepArtifactRefs !== counts.metadataArtifacts) {
    issues.push(
      `steps.jsonl artifact reference count (${counts.stepArtifactRefs}) does not match metadata.json artifact count (${counts.metadataArtifacts}).`
    );
  }

  if (counts.recordingArtifactRefs !== counts.metadataArtifacts) {
    issues.push(
      `recordings.json artifact reference count (${counts.recordingArtifactRefs}) does not match metadata.json artifact count (${counts.metadataArtifacts}).`
    );
  }

  if (counts.visualDiffArtifactRefs !== counts.metadataArtifacts) {
    issues.push(
      `visual-diff-manifest.jsonl artifact reference count (${counts.visualDiffArtifactRefs}) does not match metadata.json artifact count (${counts.metadataArtifacts}).`
    );
  }
}

async function verifyArtifactPathsExist(
  cwd: string,
  metadata: BrowserSessionMetadata | null,
  steps: BrowserSessionStepRecord[],
  recordings: BrowserSessionRecordingEntry[],
  visualDiffEntries: BrowserVisualDiffManifestEntry[],
  issues: string[]
): Promise<void> {
  if (metadata) {
    for (const artifact of metadata.artifacts) {
      const absolutePath = resolveMetadataArtifactPath(cwd, artifact);
      if (!(await fileExists(absolutePath))) {
        issues.push(`metadata.json artifact file is missing: ${absolutePath}.`);
      }
    }
  }

  const referencedPaths = uniqueSorted([
    ...flattenArtifactPaths(steps),
    ...flattenArtifactPaths(recordings),
    ...flattenArtifactPaths(visualDiffEntries),
  ]);

  for (const relativePath of referencedPaths) {
    const absolutePath = isAbsolute(relativePath) ? relativePath : join(cwd, relativePath);
    if (!(await fileExists(absolutePath))) {
      issues.push(`Referenced artifact path does not exist: ${relativePath}.`);
    }
  }
}

export async function validateBrowserSessionArtifactCompleteness(
  cwd: string,
  sessionId: string
): Promise<BrowserArtifactCompletenessResult> {
  const missingFiles: string[] = [];
  const issues: string[] = [];

  const metadataPath = browserSessionMetadataPath(cwd, sessionId);
  const stepsPath = browserSessionStepsPath(cwd, sessionId);
  const recordingsPath = browserSessionRecordingsPath(cwd, sessionId);
  const visualDiffPath = browserSessionVisualDiffManifestPath(cwd, sessionId);

  const requiredFiles = [
    { label: BROWSER_SESSION_METADATA_FILE, path: metadataPath },
    { label: BROWSER_SESSION_STEPS_FILE, path: stepsPath },
    { label: BROWSER_SESSION_RECORDINGS_FILE, path: recordingsPath },
    { label: BROWSER_VISUAL_DIFF_MANIFEST_FILE, path: visualDiffPath },
  ];

  const filePresence = new Map<string, boolean>();
  for (const file of requiredFiles) {
    const exists = await fileExists(file.path);
    filePresence.set(file.label, exists);
    if (!exists) {
      missingFiles.push(file.label);
      issues.push(`Missing required artifact file: ${file.label}.`);
    }
  }

  let metadata: BrowserSessionMetadata | null = null;
  let steps: BrowserSessionStepRecord[] = [];
  let recordings: BrowserSessionRecordingEntry[] = [];
  let visualDiffEntries: BrowserVisualDiffManifestEntry[] = [];

  if (filePresence.get(BROWSER_SESSION_METADATA_FILE)) {
    try {
      const parsed = JSON.parse(
        await readFile(metadataPath, 'utf-8')
      ) as Partial<BrowserSessionMetadata>;
      if (!Array.isArray(parsed.actions) || !Array.isArray(parsed.artifacts)) {
        issues.push('metadata.json must include "actions" and "artifacts" arrays.');
      } else {
        metadata = parsed as BrowserSessionMetadata;
      }
    } catch {
      issues.push('metadata.json is not valid JSON.');
    }
  }

  if (filePresence.get(BROWSER_SESSION_STEPS_FILE)) {
    try {
      steps = parseJsonl<BrowserSessionStepRecord>(
        await readFile(stepsPath, 'utf-8'),
        'steps.jsonl',
        issues
      );
    } catch {
      issues.push('steps.jsonl could not be read.');
    }
  }

  if (filePresence.get(BROWSER_SESSION_RECORDINGS_FILE)) {
    try {
      const parsed = JSON.parse(
        await readFile(recordingsPath, 'utf-8')
      ) as Partial<BrowserSessionRecordingIndex>;
      if (!Array.isArray(parsed.recordings)) {
        issues.push('recordings.json must include a "recordings" array.');
      } else {
        recordings = parsed.recordings;
      }
    } catch {
      issues.push('recordings.json is not valid JSON.');
    }
  }

  if (filePresence.get(BROWSER_VISUAL_DIFF_MANIFEST_FILE)) {
    try {
      visualDiffEntries = parseJsonl<BrowserVisualDiffManifestEntry>(
        await readFile(visualDiffPath, 'utf-8'),
        'visual-diff-manifest.jsonl',
        issues
      );
    } catch {
      issues.push('visual-diff-manifest.jsonl could not be read.');
    }
  }

  const counts = toCounts(metadata, steps, recordings, visualDiffEntries);

  if (metadata && metadata.sessionId !== sessionId) {
    issues.push(
      `metadata.json sessionId ${metadata.sessionId} does not match expected sessionId ${sessionId}.`
    );
  }

  verifySessionIds('steps.jsonl', steps, sessionId, issues);
  verifySessionIds('recordings.json', recordings, sessionId, issues);
  verifySessionIds('visual-diff-manifest.jsonl', visualDiffEntries, sessionId, issues);

  verifySequence('steps.jsonl', steps, issues);
  verifySequence('recordings.json', recordings, issues);
  verifySequence('visual-diff-manifest.jsonl', visualDiffEntries, issues);

  compareActionCounts(metadata, steps, recordings, visualDiffEntries, issues);
  compareArtifactReferenceCounts(metadata, counts, issues);

  const metadataArtifactIds = uniqueSorted(
    metadata?.artifacts.map((artifact) => artifact.id) ?? []
  );
  const stepArtifactIds = uniqueSorted(flattenArtifactIds(steps));
  const recordingArtifactIds = uniqueSorted(flattenArtifactIds(recordings));
  const visualArtifactIds = uniqueSorted(flattenArtifactIds(visualDiffEntries));

  if (metadata) {
    compareStringSets(
      metadataArtifactIds,
      stepArtifactIds,
      'metadata.json artifact IDs',
      'steps.jsonl artifact IDs',
      issues
    );
    compareStringSets(
      metadataArtifactIds,
      recordingArtifactIds,
      'metadata.json artifact IDs',
      'recordings.json artifact IDs',
      issues
    );
    compareStringSets(
      metadataArtifactIds,
      visualArtifactIds,
      'metadata.json artifact IDs',
      'visual-diff-manifest.jsonl artifact IDs',
      issues
    );
  }

  compareStringSets(
    stepArtifactIds,
    recordingArtifactIds,
    'steps.jsonl artifact IDs',
    'recordings.json artifact IDs',
    issues
  );
  compareStringSets(
    stepArtifactIds,
    visualArtifactIds,
    'steps.jsonl artifact IDs',
    'visual-diff-manifest.jsonl artifact IDs',
    issues
  );

  const metadataArtifactPaths = uniqueSorted(
    metadata?.artifacts.map((artifact) => artifact.relativePath) ?? []
  );
  const stepArtifactPaths = uniqueSorted(flattenArtifactPaths(steps));
  const recordingArtifactPaths = uniqueSorted(flattenArtifactPaths(recordings));
  const visualArtifactPaths = uniqueSorted(flattenArtifactPaths(visualDiffEntries));

  if (metadata) {
    compareStringSets(
      metadataArtifactPaths,
      stepArtifactPaths,
      'metadata.json artifact paths',
      'steps.jsonl artifact paths',
      issues
    );
    compareStringSets(
      metadataArtifactPaths,
      recordingArtifactPaths,
      'metadata.json artifact paths',
      'recordings.json artifact paths',
      issues
    );
    compareStringSets(
      metadataArtifactPaths,
      visualArtifactPaths,
      'metadata.json artifact paths',
      'visual-diff-manifest.jsonl artifact paths',
      issues
    );
  }

  compareStringSets(
    stepArtifactPaths,
    recordingArtifactPaths,
    'steps.jsonl artifact paths',
    'recordings.json artifact paths',
    issues
  );
  compareStringSets(
    stepArtifactPaths,
    visualArtifactPaths,
    'steps.jsonl artifact paths',
    'visual-diff-manifest.jsonl artifact paths',
    issues
  );

  await verifyArtifactPathsExist(cwd, metadata, steps, recordings, visualDiffEntries, issues);

  return {
    ok: issues.length === 0,
    sessionId,
    missingFiles,
    issues,
    counts,
  };
}

export async function ingestBrowserBenchmarkTelemetry(
  cwd: string,
  sessionId: string
): Promise<BrowserBenchmarkTelemetryIngestionResult> {
  const issues: string[] = [];

  const metadataPath = browserSessionMetadataPath(cwd, sessionId);
  const stepsPath = browserSessionStepsPath(cwd, sessionId);

  let metadataActions: BrowserSessionMetadata['actions'] = [];
  let metadataUpdatedAtMs: number | null = null;
  if (await fileExists(metadataPath)) {
    try {
      const parsed = JSON.parse(
        await readFile(metadataPath, 'utf-8')
      ) as Partial<BrowserSessionMetadata>;
      if (!Array.isArray(parsed.actions)) {
        issues.push(
          'metadata.json must include an "actions" array for benchmark telemetry ingestion.'
        );
      } else {
        metadataActions = parsed.actions;
      }

      if (typeof parsed.updatedAt === 'string') {
        metadataUpdatedAtMs = parseTimestampMs('metadata.json updatedAt', parsed.updatedAt, issues);
      } else {
        issues.push('metadata.json must include "updatedAt" for benchmark telemetry ingestion.');
      }
    } catch {
      issues.push('metadata.json is not valid JSON.');
    }
  } else {
    issues.push('Missing required telemetry file: metadata.json.');
  }

  let steps: BrowserSessionStepRecord[] = [];
  if (await fileExists(stepsPath)) {
    try {
      steps = parseJsonl<BrowserSessionStepRecord>(
        await readFile(stepsPath, 'utf-8'),
        'steps.jsonl',
        issues
      );
    } catch {
      issues.push('steps.jsonl could not be read.');
    }
  } else {
    issues.push('Missing required telemetry file: steps.jsonl.');
  }

  const actionCreatedAtMs = new Map<string, number>();
  for (const [index, actionRecord] of metadataActions.entries()) {
    const action = actionRecord?.action;
    if (!action || typeof action.id !== 'string' || typeof action.createdAt !== 'string') {
      issues.push(
        `metadata.json action record at index ${index} is missing a valid action id or createdAt timestamp.`
      );
      continue;
    }

    if (actionCreatedAtMs.has(action.id)) {
      issues.push(`metadata.json contains duplicate action id ${action.id}.`);
      continue;
    }

    const createdAtMs = parseTimestampMs(
      `metadata.json action ${action.id}`,
      action.createdAt,
      issues
    );
    if (createdAtMs !== null) {
      actionCreatedAtMs.set(action.id, createdAtMs);
    }
  }

  const orderedSteps = [...steps].sort((left, right) => {
    if (left.sequence !== right.sequence) return left.sequence - right.sequence;
    return left.actionId.localeCompare(right.actionId);
  });

  const latencySamplesMs: number[] = [];
  const recoverySamplesMs: number[] = [];

  let successCount = 0;
  let failureCount = 0;
  let failureStartMs: number | null = null;
  let lastStepTimestampMs: number | null = null;

  for (const step of orderedSteps) {
    if (step.ok) successCount += 1;
    else failureCount += 1;

    const stepTimestampMs = parseTimestampMs(
      `steps.jsonl action ${step.actionId}`,
      step.timestamp,
      issues
    );
    if (stepTimestampMs !== null) {
      lastStepTimestampMs = stepTimestampMs;
    }

    const createdAtMs = actionCreatedAtMs.get(step.actionId);
    if (createdAtMs === undefined) {
      issues.push(`steps.jsonl action ${step.actionId} is missing in metadata.json actions.`);
    } else if (stepTimestampMs !== null) {
      const latencyMs = stepTimestampMs - createdAtMs;
      if (!Number.isFinite(latencyMs) || latencyMs < 0) {
        issues.push(`Action latency for ${step.actionId} is invalid (${String(latencyMs)}ms).`);
      } else {
        latencySamplesMs.push(latencyMs);
      }
    }

    if (!step.ok) {
      if (failureStartMs === null && stepTimestampMs !== null) {
        failureStartMs = stepTimestampMs;
      }
      continue;
    }

    if (failureStartMs !== null && stepTimestampMs !== null) {
      const recoveryMs = stepTimestampMs - failureStartMs;
      if (!Number.isFinite(recoveryMs) || recoveryMs < 0) {
        issues.push(`Recovery duration is invalid around action ${step.actionId}.`);
      } else {
        recoverySamplesMs.push(recoveryMs);
      }
      failureStartMs = null;
    }
  }

  if (failureStartMs !== null) {
    const recoveryEndMs = lastStepTimestampMs ?? metadataUpdatedAtMs;
    if (recoveryEndMs !== null) {
      const unresolvedRecoveryMs = recoveryEndMs - failureStartMs;
      if (Number.isFinite(unresolvedRecoveryMs) && unresolvedRecoveryMs >= 0) {
        recoverySamplesMs.push(unresolvedRecoveryMs);
      } else {
        issues.push('Unresolved failure recovery duration is invalid.');
      }
    } else {
      issues.push('Unable to compute unresolved failure recovery duration.');
    }
    issues.push('Session ended with an unrecovered failure sequence.');
  }

  const actionCount = orderedSteps.length;
  const metrics: BrowserBenchmarkMetrics = {
    successRate: actionCount === 0 ? 0 : successCount / actionCount,
    medianActionLatencyMs: median(latencySamplesMs),
    recoveryMs: median(recoverySamplesMs),
  };

  validateFiniteMetric('successRate', metrics.successRate, issues);
  validateFiniteMetric('medianActionLatencyMs', metrics.medianActionLatencyMs, issues);
  validateFiniteMetric('recoveryMs', metrics.recoveryMs, issues);

  return {
    ok: issues.length === 0,
    sessionId,
    issues,
    actionCount,
    successCount,
    failureCount,
    latencySamplesMs,
    recoverySamplesMs,
    metrics,
  };
}

function validateFiniteMetric(
  label: keyof BrowserBenchmarkMetrics,
  value: number,
  failures: string[]
): boolean {
  if (Number.isFinite(value)) return true;
  failures.push(`Metric ${label} must be a finite number.`);
  return false;
}

function validateFiniteThreshold(
  label: keyof BrowserBenchmarkThresholds,
  value: number,
  failures: string[]
): boolean {
  if (Number.isFinite(value)) return true;
  failures.push(`Threshold ${label} must be a finite number.`);
  return false;
}

export function validateBrowserBenchmarkThresholds(
  metrics: BrowserBenchmarkMetrics,
  thresholds: BrowserBenchmarkThresholds = DEFAULT_BROWSER_BENCHMARK_THRESHOLDS
): BrowserBenchmarkThresholdResult {
  const failures: string[] = [];

  const hasSuccessRate = validateFiniteMetric('successRate', metrics.successRate, failures);
  const hasMedianLatency = validateFiniteMetric(
    'medianActionLatencyMs',
    metrics.medianActionLatencyMs,
    failures
  );
  const hasRecovery = validateFiniteMetric('recoveryMs', metrics.recoveryMs, failures);

  const hasMinSuccessRate = validateFiniteThreshold(
    'minSuccessRate',
    thresholds.minSuccessRate,
    failures
  );
  const hasMaxMedianLatency = validateFiniteThreshold(
    'maxMedianActionLatencyMs',
    thresholds.maxMedianActionLatencyMs,
    failures
  );
  const hasMaxRecovery = validateFiniteThreshold(
    'maxRecoveryMs',
    thresholds.maxRecoveryMs,
    failures
  );

  if (hasSuccessRate && hasMinSuccessRate && metrics.successRate < thresholds.minSuccessRate) {
    failures.push(
      `successRate ${formatNumber(metrics.successRate)} is below minimum ${formatNumber(thresholds.minSuccessRate)}.`
    );
  }

  if (
    hasMedianLatency &&
    hasMaxMedianLatency &&
    metrics.medianActionLatencyMs > thresholds.maxMedianActionLatencyMs
  ) {
    failures.push(
      `medianActionLatencyMs ${formatNumber(metrics.medianActionLatencyMs)} exceeds maximum ${formatNumber(thresholds.maxMedianActionLatencyMs)}.`
    );
  }

  if (hasRecovery && hasMaxRecovery && metrics.recoveryMs > thresholds.maxRecoveryMs) {
    failures.push(
      `recoveryMs ${formatNumber(metrics.recoveryMs)} exceeds maximum ${formatNumber(thresholds.maxRecoveryMs)}.`
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    metrics,
    thresholds,
  };
}

export async function validateBrowserBenchmarkThresholdFeed(
  cwd: string,
  sessionId: string,
  thresholds: BrowserBenchmarkThresholds = DEFAULT_BROWSER_BENCHMARK_THRESHOLDS
): Promise<BrowserBenchmarkThresholdFeedResult> {
  const ingestion = await ingestBrowserBenchmarkTelemetry(cwd, sessionId);
  const thresholdResult = validateBrowserBenchmarkThresholds(ingestion.metrics, thresholds);
  const failures = [
    ...thresholdResult.failures,
    ...ingestion.issues.map((issue) => `Telemetry ingestion issue: ${issue}`),
  ];

  return {
    ok: failures.length === 0,
    failures,
    metrics: ingestion.metrics,
    thresholds,
    sessionId,
    ingestion,
  };
}
