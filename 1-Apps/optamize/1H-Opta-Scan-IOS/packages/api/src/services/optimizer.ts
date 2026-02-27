/**
 * @fileoverview Optimizer Service
 * @description Scoring and ranking options based on user priorities
 */

import {
  scoreOptions,
  generateExplanation,
  DEFAULT_PRIORITIES,
} from '@opta/shared';
import type {
  ExtractedOption,
  PriorityWeights,
  Constraints,
  Recommendation,
  ScoredOption,
} from '@opta/shared';

/** Number of alternatives to include in explanation comparison */
const EXPLANATION_ALTERNATIVES_COUNT = 2;

/**
 * Filter options based on user-defined constraints.
 * @param options - Array of options to filter
 * @param constraints - User constraints (price, calories, dietary)
 * @returns Filtered array of options meeting all constraints
 */
function filterByConstraints(
  options: readonly ExtractedOption[],
  constraints: Constraints
): ExtractedOption[] {
  return options.filter((option) => {
    const { attributes, tags } = option;

    // Check max price constraint
    if (constraints.maxPrice != null && attributes.price != null) {
      if (attributes.price > constraints.maxPrice) {
        return false;
      }
    }

    // Check max calories constraint
    if (constraints.maxCalories != null && attributes.calories != null) {
      if (attributes.calories > constraints.maxCalories) {
        return false;
      }
    }

    // Check dietary constraints (all must be present)
    if (constraints.dietary != null && constraints.dietary.length > 0) {
      const lowercaseTags = tags.map((t) => t.toLowerCase());
      const meetsAllDietary = constraints.dietary.every((diet) =>
        lowercaseTags.includes(diet.toLowerCase())
      );
      // Note: Currently not filtering by dietary - needs more sophisticated logic
      // to distinguish between required tags vs excluded ingredients
      void meetsAllDietary;
    }

    return true;
  });
}

/**
 * Optimizer service for scoring and ranking options.
 */
export const optimizerService = {
  /**
   * Score and rank options based on user priorities and constraints.
   *
   * @param options - Array of extracted options to optimize
   * @param priorities - Optional priority weight overrides
   * @param constraints - Optional filtering constraints
   * @returns Recommendation with top choice and alternatives
   */
  optimize(
    options: readonly ExtractedOption[],
    priorities?: Partial<PriorityWeights>,
    constraints?: Constraints
  ): Recommendation {
    // Merge user priorities with defaults
    const mergedPriorities: PriorityWeights = {
      ...DEFAULT_PRIORITIES,
      ...priorities,
    };

    // Apply constraint filtering if provided
    let optionsToScore: readonly ExtractedOption[] = options;

    if (constraints != null) {
      const filtered = filterByConstraints(options, constraints);
      // If all options were filtered out, fall back to original set
      optionsToScore = filtered.length > 0 ? filtered : options;
    }

    // Score and rank all options
    const scoredOptions = scoreOptions(optionsToScore, mergedPriorities);

    // Extract top choice and alternatives
    const [topChoice, ...alternatives] = scoredOptions;

    // Generate human-readable explanation
    const explanationAlternatives = alternatives.slice(0, EXPLANATION_ALTERNATIVES_COUNT);
    const explanation = generateExplanation(
      topChoice,
      explanationAlternatives,
      mergedPriorities
    );

    return {
      topChoice,
      alternatives,
      explanation,
      confidence: calculateConfidence(scoredOptions),
    };
  },

  /**
   * Re-optimize with new priorities for an existing extraction.
   * Strips scoring data and re-processes with new weights.
   *
   * @param previousOptions - Previously scored options
   * @param newPriorities - New priority weights to apply
   * @param constraints - Optional updated constraints
   * @returns New recommendation with updated scoring
   */
  reoptimize(
    previousOptions: readonly ScoredOption[],
    newPriorities: Partial<PriorityWeights>,
    constraints?: Constraints
  ): Recommendation {
    // Strip scoring data to get base extracted options
    const baseOptions: ExtractedOption[] = previousOptions.map(
      ({ score: _score, scoreBreakdown: _breakdown, rank: _rank, ...baseOption }) => baseOption
    );

    return this.optimize(baseOptions, newPriorities, constraints);
  },
};

// ============================================
// Confidence Calculation
// ============================================

/** Confidence score thresholds and values */
const CONFIDENCE_LEVELS = {
  /** Only one option - high confidence by default */
  SINGLE_OPTION: 0.9,
  /** Clear winner with large margin */
  HIGH_MARGIN: { threshold: 0.3, confidence: 0.95 },
  /** Moderate winner with decent margin */
  MEDIUM_MARGIN: { threshold: 0.15, confidence: 0.85 },
  /** Slight winner with small margin */
  LOW_MARGIN: { threshold: 0.05, confidence: 0.75 },
  /** Very close call between top options */
  CLOSE_CALL: 0.65,
} as const;

/**
 * Calculate overall recommendation confidence based on score distribution.
 * Higher confidence when there's a clear winning option.
 *
 * @param scoredOptions - Array of scored options (sorted by score descending)
 * @returns Confidence value between 0 and 1
 */
function calculateConfidence(scoredOptions: readonly ScoredOption[]): number {
  // No options - no confidence
  if (scoredOptions.length === 0) {
    return 0;
  }

  // Single option - reasonably confident
  if (scoredOptions.length === 1) {
    return CONFIDENCE_LEVELS.SINGLE_OPTION;
  }

  // Calculate score gap between first and second place
  const topScore = scoredOptions[0].score;
  const secondScore = scoredOptions[1]?.score ?? 0;
  const scoreDifference = topScore - secondScore;

  // Return confidence based on how decisive the winner is
  if (scoreDifference > CONFIDENCE_LEVELS.HIGH_MARGIN.threshold) {
    return CONFIDENCE_LEVELS.HIGH_MARGIN.confidence;
  }
  if (scoreDifference > CONFIDENCE_LEVELS.MEDIUM_MARGIN.threshold) {
    return CONFIDENCE_LEVELS.MEDIUM_MARGIN.confidence;
  }
  if (scoreDifference > CONFIDENCE_LEVELS.LOW_MARGIN.threshold) {
    return CONFIDENCE_LEVELS.LOW_MARGIN.confidence;
  }

  return CONFIDENCE_LEVELS.CLOSE_CALL;
}
