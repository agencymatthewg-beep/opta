import type {
  BrowserVisualDiffRegressionSignal,
  BrowserVisualDiffResultStatus,
  BrowserVisualDiffSeverity,
} from './types.js';
import { clamp01 } from '../utils/common.js';

export const BROWSER_VISUAL_DIFF_MEDIUM_RATIO_THRESHOLD = 0.02;
export const BROWSER_VISUAL_DIFF_HIGH_RATIO_THRESHOLD = 0.15;
export const BROWSER_VISUAL_DIFF_REGRESSION_INVESTIGATE_THRESHOLD = 0.35;
export const BROWSER_VISUAL_DIFF_REGRESSION_THRESHOLD = 0.7;
const BROWSER_VISUAL_DIFF_PERCEPTUAL_BUCKETS = 64;

export interface BrowserVisualDiffAssessment {
  status: BrowserVisualDiffResultStatus;
  changedByteRatio?: number;
  perceptualDiffScore?: number;
  severity: BrowserVisualDiffSeverity;
  regressionScore: number;
  regressionSignal: BrowserVisualDiffRegressionSignal;
}

function buildPerceptualSignature(bytes: Uint8Array, bucketCount: number): number[] {
  if (bucketCount <= 0) return [];
  const signature = new Array<number>(bucketCount).fill(0);
  if (bytes.length === 0) return signature;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor((bucket * bytes.length) / bucketCount);
    const exclusiveEnd = Math.min(
      bytes.length,
      Math.max(start + 1, Math.floor(((bucket + 1) * bytes.length) / bucketCount)),
    );
    let sum = 0;
    for (let index = start; index < exclusiveEnd; index += 1) {
      sum += bytes[index] ?? 0;
    }
    const count = Math.max(1, exclusiveEnd - start);
    signature[bucket] = (sum / count) / 255;
  }

  return signature;
}

export function estimateByteChangeRatio(left: Uint8Array, right: Uint8Array): number {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 0;

  const minLength = Math.min(left.length, right.length);
  let changed = Math.abs(left.length - right.length);
  for (let index = 0; index < minLength; index += 1) {
    if (left[index] !== right[index]) {
      changed += 1;
    }
  }
  return changed / maxLength;
}

export function estimatePerceptualDiffScore(left: Uint8Array, right: Uint8Array): number {
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) return 0;
  if (left.length === right.length && left.every((value, index) => value === right[index])) {
    return 0;
  }

  const leftSignature = buildPerceptualSignature(left, BROWSER_VISUAL_DIFF_PERCEPTUAL_BUCKETS);
  const rightSignature = buildPerceptualSignature(right, BROWSER_VISUAL_DIFF_PERCEPTUAL_BUCKETS);
  const lengthPenalty = Math.abs(left.length - right.length) / maxLength;
  let accumulatedDelta = 0;
  for (let index = 0; index < BROWSER_VISUAL_DIFF_PERCEPTUAL_BUCKETS; index += 1) {
    accumulatedDelta += Math.abs((leftSignature[index] ?? 0) - (rightSignature[index] ?? 0));
  }
  const signatureDelta = accumulatedDelta / BROWSER_VISUAL_DIFF_PERCEPTUAL_BUCKETS;
  return clamp01((signatureDelta * 0.8) + (lengthPenalty * 0.2));
}

export function deriveVisualDiffSeverity(ratio: number): BrowserVisualDiffSeverity {
  if (ratio >= BROWSER_VISUAL_DIFF_HIGH_RATIO_THRESHOLD) {
    return 'high';
  }
  if (ratio >= BROWSER_VISUAL_DIFF_MEDIUM_RATIO_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

export function deriveVisualRegressionScore(
  status: BrowserVisualDiffResultStatus,
  severity: BrowserVisualDiffSeverity,
  changedByteRatio?: number,
  perceptualDiffScore?: number,
): number {
  if (status === 'missing') return 1;
  if (status === 'unchanged') return 0;

  const ratio = typeof changedByteRatio === 'number' && Number.isFinite(changedByteRatio)
    ? clamp01(changedByteRatio)
    : undefined;
  const perceptual = typeof perceptualDiffScore === 'number' && Number.isFinite(perceptualDiffScore)
    ? clamp01(perceptualDiffScore)
    : undefined;

  const base = ((ratio ?? perceptual ?? 0.5) * 0.45) + ((perceptual ?? ratio ?? 0.5) * 0.55);
  const severityFloor = severity === 'high' ? 0.75 : severity === 'medium' ? 0.4 : 0.15;
  return clamp01(Math.max(base, severityFloor));
}

export function deriveVisualRegressionSignal(
  score: number,
): BrowserVisualDiffRegressionSignal {
  const clamped = clamp01(score);
  if (clamped >= BROWSER_VISUAL_DIFF_REGRESSION_THRESHOLD) {
    return 'regression';
  }
  if (clamped >= BROWSER_VISUAL_DIFF_REGRESSION_INVESTIGATE_THRESHOLD) {
    return 'investigate';
  }
  return 'none';
}

export function inferVisualDiffSeverity(
  status: BrowserVisualDiffResultStatus,
  changedByteRatio?: number,
): BrowserVisualDiffSeverity {
  if (status === 'missing') return 'high';
  if (status === 'unchanged') return 'low';
  if (typeof changedByteRatio === 'number' && Number.isFinite(changedByteRatio)) {
    return deriveVisualDiffSeverity(changedByteRatio);
  }
  return 'medium';
}

export function inferVisualDiffRegression(
  status: BrowserVisualDiffResultStatus,
  severity: BrowserVisualDiffSeverity,
  changedByteRatio?: number,
  perceptualDiffScore?: number,
  regressionScore?: number,
): { regressionScore: number; regressionSignal: BrowserVisualDiffRegressionSignal } {
  const score = typeof regressionScore === 'number' && Number.isFinite(regressionScore)
    ? clamp01(regressionScore)
    : deriveVisualRegressionScore(status, severity, changedByteRatio, perceptualDiffScore);
  return {
    regressionScore: score,
    regressionSignal: deriveVisualRegressionSignal(score),
  };
}

export function assessVisualDiffPair(
  fromBytes?: Uint8Array | null,
  toBytes?: Uint8Array | null,
): BrowserVisualDiffAssessment {
  if (!fromBytes || !toBytes) {
    const severity: BrowserVisualDiffSeverity = 'high';
    const regression = inferVisualDiffRegression('missing', severity);
    return {
      status: 'missing',
      severity,
      ...regression,
    };
  }

  if (fromBytes.length === toBytes.length && fromBytes.every((value, index) => value === toBytes[index])) {
    const severity: BrowserVisualDiffSeverity = 'low';
    const changedByteRatio = 0;
    const perceptualDiffScore = 0;
    const regression = inferVisualDiffRegression('unchanged', severity, changedByteRatio, perceptualDiffScore);
    return {
      status: 'unchanged',
      changedByteRatio,
      perceptualDiffScore,
      severity,
      ...regression,
    };
  }

  const changedByteRatio = estimateByteChangeRatio(fromBytes, toBytes);
  const perceptualDiffScore = estimatePerceptualDiffScore(fromBytes, toBytes);
  const severity = deriveVisualDiffSeverity(changedByteRatio);
  const regression = inferVisualDiffRegression('changed', severity, changedByteRatio, perceptualDiffScore);
  return {
    status: 'changed',
    changedByteRatio,
    perceptualDiffScore,
    severity,
    ...regression,
  };
}
