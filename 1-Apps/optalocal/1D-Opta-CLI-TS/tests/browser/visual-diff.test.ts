import { describe, expect, it } from 'vitest';
import {
  assessVisualDiffPair,
  deriveVisualRegressionSignal,
  estimatePerceptualDiffScore,
  inferVisualDiffRegression,
} from '../../src/browser/visual-diff.js';

describe('browser visual diff helpers', () => {
  it('returns deterministic perceptual scores for identical input', () => {
    const left = Buffer.from('same-bytes');
    const right = Buffer.from('same-bytes');
    const scoreA = estimatePerceptualDiffScore(left, right);
    const scoreB = estimatePerceptualDiffScore(left, right);
    expect(scoreA).toBe(0);
    expect(scoreB).toBe(0);
  });

  it('emits perceptual and regression fields in changed assessments', () => {
    const left = Buffer.from('same-bytes');
    const right = Buffer.from('different-bytes');
    const assessment = assessVisualDiffPair(left, right);
    expect(assessment.status).toBe('changed');
    expect(assessment.changedByteRatio).toBeGreaterThan(0);
    expect(assessment.perceptualDiffScore).toBeGreaterThan(0);
    expect(assessment.regressionScore).toBeGreaterThanOrEqual(0.75);
    expect(assessment.regressionSignal).toBe('regression');
  });

  it('derives deterministic legacy regression signals without persisted scores', () => {
    const inferred = inferVisualDiffRegression('changed', 'medium');
    expect(inferred.regressionScore).toBe(0.5);
    expect(inferred.regressionSignal).toBe('investigate');
  });

  it('maps regression score thresholds to stable labels', () => {
    expect(deriveVisualRegressionSignal(0)).toBe('none');
    expect(deriveVisualRegressionSignal(0.35)).toBe('investigate');
    expect(deriveVisualRegressionSignal(0.7)).toBe('regression');
  });
});
