/**
 * @fileoverview Shared utility functions for Opta Mobile
 * @description Scoring, normalization, and helper functions
 */

import type { PriorityWeights, ExtractedOption, ScoredOption } from './types/index.js';

/** Default normalized value when min equals max */
const DEFAULT_NORMALIZED_VALUE = 0.5;

/** Tags that indicate eco-friendly options */
const ECO_FRIENDLY_TAGS = ['eco', 'sustainable', 'organic', 'local', 'eco-friendly'] as const;

/** Minimum rating value for normalization */
const MIN_RATING = 1;

/** Maximum rating value for normalization */
const MAX_RATING = 5;

/** Weight multiplier for partial health factors */
const PARTIAL_WEIGHT_MULTIPLIER = 0.5;

/** Base score for options without eco tags */
const BASE_ECO_SCORE = 0.3;

/** Score threshold for "close call" recommendations */
const CLOSE_CALL_THRESHOLD = 0.1;

/**
 * Normalize a value to 0-1 range using min-max scaling.
 * @param value - The value to normalize
 * @param min - Minimum value in the range
 * @param max - Maximum value in the range
 * @returns Normalized value between 0 and 1
 */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return DEFAULT_NORMALIZED_VALUE;
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Type guard to filter null/undefined values from arrays
 */
function isNotNullOrUndefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

/**
 * Extract numeric attribute values from options array
 * @param options - Array of options
 * @param getter - Function to extract the attribute
 * @returns Array of non-null numeric values
 */
function extractNumericAttributes(
  options: readonly ExtractedOption[],
  getter: (option: ExtractedOption) => number | undefined
): number[] {
  return options.map(getter).filter(isNotNullOrUndefined);
}

/**
 * Calculate weighted score for an option based on priorities.
 * Higher scores indicate better matches for user preferences.
 *
 * @param option - The option to score
 * @param allOptions - All options for relative comparison
 * @param priorities - User priority weights
 * @returns Score between 0 and 1
 */
export function calculateScore(
  option: ExtractedOption,
  allOptions: readonly ExtractedOption[],
  priorities: PriorityWeights
): number {
  const { attributes } = option;
  let score = 0;
  let totalWeight = 0;

  // Budget/Price: lower is better (inverted normalization)
  if (attributes.price != null && priorities.budget > 0) {
    const prices = extractNumericAttributes(allOptions, (o) => o.attributes.price);
    if (prices.length > 0) {
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const normalizedPrice = 1 - normalize(attributes.price, minPrice, maxPrice);
      score += normalizedPrice * priorities.budget;
      totalWeight += priorities.budget;
    }
  }

  // Health/Calories: lower calories is better (inverted, partial weight)
  if (attributes.calories != null && priorities.health > 0) {
    const calories = extractNumericAttributes(allOptions, (o) => o.attributes.calories);
    if (calories.length > 0) {
      const minCal = Math.min(...calories);
      const maxCal = Math.max(...calories);
      const normalizedCal = 1 - normalize(attributes.calories, minCal, maxCal);
      const partialWeight = priorities.health * PARTIAL_WEIGHT_MULTIPLIER;
      score += normalizedCal * partialWeight;
      totalWeight += partialWeight;
    }
  }

  // Health/Protein: higher is better (partial weight)
  if (attributes.protein != null && priorities.health > 0) {
    const proteins = extractNumericAttributes(allOptions, (o) => o.attributes.protein);
    if (proteins.length > 0) {
      const minProtein = Math.min(...proteins);
      const maxProtein = Math.max(...proteins);
      const normalizedProtein = normalize(attributes.protein, minProtein, maxProtein);
      const partialWeight = priorities.health * PARTIAL_WEIGHT_MULTIPLIER;
      score += normalizedProtein * partialWeight;
      totalWeight += partialWeight;
    }
  }

  // Quality/Rating: higher is better (fixed 1-5 scale)
  if (attributes.rating != null && priorities.quality > 0) {
    const normalizedRating = normalize(attributes.rating, MIN_RATING, MAX_RATING);
    score += normalizedRating * priorities.quality;
    totalWeight += priorities.quality;
  }

  // Time/Prep time: lower is better (inverted)
  if (attributes.prepTime != null && priorities.time > 0) {
    const prepTimes = extractNumericAttributes(allOptions, (o) => o.attributes.prepTime);
    if (prepTimes.length > 0) {
      const minTime = Math.min(...prepTimes);
      const maxTime = Math.max(...prepTimes);
      const normalizedTime = 1 - normalize(attributes.prepTime, minTime, maxTime);
      score += normalizedTime * priorities.time;
      totalWeight += priorities.time;
    }
  }

  // Sustainability: binary tag check
  if (priorities.sustainability > 0) {
    const lowercaseTags = option.tags.map((t) => t.toLowerCase());
    const hasEcoTag = ECO_FRIENDLY_TAGS.some((ecoTag) => lowercaseTags.includes(ecoTag));
    const ecoScore = hasEcoTag ? 1 : BASE_ECO_SCORE;
    score += ecoScore * priorities.sustainability;
    totalWeight += priorities.sustainability;
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

/**
 * Score and rank all options by priority-weighted optimization.
 *
 * @param options - Array of extracted options to score
 * @param priorities - User priority weights
 * @returns Array of scored options sorted by score (highest first)
 */
export function scoreOptions(
  options: readonly ExtractedOption[],
  priorities: PriorityWeights
): ScoredOption[] {
  // Calculate scores for all options
  const scored: ScoredOption[] = options.map((option) => {
    const score = calculateScore(option, options, priorities);
    return {
      ...option,
      score,
      scoreBreakdown: {}, // TODO: Implement detailed breakdown
      rank: 0, // Will be assigned after sorting
    };
  });

  // Sort by score descending (highest first)
  scored.sort((a, b) => b.score - a.score);

  // Assign ranks (1-indexed)
  for (let i = 0; i < scored.length; i++) {
    scored[i].rank = i + 1;
  }

  return scored;
}

/** Human-readable labels for priority keys */
const PRIORITY_LABELS: Readonly<Record<string, string>> = {
  budget: 'value',
  health: 'health',
  quality: 'quality',
  time: 'convenience',
  sustainability: 'sustainability',
} as const;

/**
 * Generate a human-readable explanation for why the top choice was recommended.
 *
 * @param topChoice - The recommended option
 * @param alternatives - Other options in rank order
 * @param priorities - User priority weights
 * @returns Human-readable explanation string
 */
export function generateExplanation(
  topChoice: ScoredOption,
  alternatives: readonly ScoredOption[],
  priorities: PriorityWeights
): string {
  const explanationParts: string[] = [];

  // Find the user's highest priority
  const sortedPriorities = Object.entries(priorities)
    .sort(([, weightA], [, weightB]) => weightB - weightA);
  const [topPriorityKey] = sortedPriorities[0] ?? ['quality'];

  // Lead with the recommendation
  explanationParts.push(`${topChoice.name} is your best match.`);

  // Build details from available attributes
  const { attributes } = topChoice;
  const attributeDetails: string[] = [];

  if (attributes.price != null) {
    attributeDetails.push(`$${attributes.price.toFixed(2)}`);
  }
  if (attributes.calories != null) {
    attributeDetails.push(`${attributes.calories} cal`);
  }
  if (attributes.protein != null) {
    attributeDetails.push(`${attributes.protein}g protein`);
  }
  if (attributes.rating != null) {
    attributeDetails.push(`${attributes.rating.toFixed(1)} stars`);
  }

  if (attributeDetails.length > 0) {
    explanationParts.push(`${attributeDetails.join(', ')}.`);
  }

  // Add comparison note if close call with second choice
  if (alternatives.length > 0) {
    const secondChoice = alternatives[0];
    const scoreDifference = topChoice.score - secondChoice.score;

    if (scoreDifference < CLOSE_CALL_THRESHOLD) {
      const priorityLabel = PRIORITY_LABELS[topPriorityKey] ?? topPriorityKey;
      explanationParts.push(
        `Close call with ${secondChoice.name} - ${topChoice.name} edges ahead on ${priorityLabel}.`
      );
    }
  }

  return explanationParts.join(' ');
}

/** Default locale for number formatting */
const DEFAULT_LOCALE = 'en-US';

/** Default currency code */
const DEFAULT_CURRENCY = 'USD';

/** Radix for base-36 encoding */
const BASE_36_RADIX = 36;

/** Start index for random substring */
const RANDOM_SUBSTRING_START = 2;

/** Length of random portion in generated IDs */
const RANDOM_PORTION_LENGTH = 8;

/**
 * Format a number as a currency string.
 *
 * @param amount - The numeric amount to format
 * @param currency - ISO 4217 currency code (default: 'USD')
 * @returns Formatted currency string (e.g., '$12.99')
 */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Generate a unique identifier string.
 * Uses timestamp + random component for uniqueness.
 *
 * @param prefix - Optional prefix for the ID (e.g., 'scan', 'user')
 * @returns Unique identifier string
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(BASE_36_RADIX);
  const randomPart = Math.random()
    .toString(BASE_36_RADIX)
    .substring(RANDOM_SUBSTRING_START, RANDOM_SUBSTRING_START + RANDOM_PORTION_LENGTH);

  return prefix.length > 0 ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}
