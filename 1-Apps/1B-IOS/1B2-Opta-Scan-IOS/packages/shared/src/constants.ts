/**
 * @fileoverview Shared constants for Opta Mobile
 * @description Configuration values, presets, and threshold constants
 */

import type { PriorityWeights, ContentType } from './types/index.js';

// ============================================
// Default Values
// ============================================

/**
 * Default priority weights for balanced optimization.
 * Used when user has not customized their preferences.
 */
export const DEFAULT_PRIORITIES: Readonly<PriorityWeights> = {
  budget: 0.5,
  health: 0.5,
  quality: 0.5,
  time: 0.5,
  sustainability: 0.3,
} as const;

// ============================================
// Priority Presets
// ============================================

/** Available preset identifiers */
export type PresetId =
  | 'balanced'
  | 'healthFirst'
  | 'budgetConscious'
  | 'quickDecisions'
  | 'qualityFocused'
  | 'ecoFriendly';

/**
 * Pre-configured priority weight sets for common use cases.
 * Users can select these or customize their own.
 */
export const PRIORITY_PRESETS: Readonly<Record<PresetId, PriorityWeights>> = {
  /** Equal weighting across all factors */
  balanced: {
    budget: 0.5,
    health: 0.5,
    quality: 0.5,
    time: 0.5,
    sustainability: 0.3,
  },
  /** Prioritizes health and nutrition */
  healthFirst: {
    budget: 0.4,
    health: 0.9,
    quality: 0.6,
    time: 0.3,
    sustainability: 0.5,
  },
  /** Prioritizes low cost */
  budgetConscious: {
    budget: 0.9,
    health: 0.4,
    quality: 0.5,
    time: 0.4,
    sustainability: 0.3,
  },
  /** Prioritizes speed and convenience */
  quickDecisions: {
    budget: 0.5,
    health: 0.3,
    quality: 0.4,
    time: 0.9,
    sustainability: 0.2,
  },
  /** Prioritizes premium quality */
  qualityFocused: {
    budget: 0.3,
    health: 0.5,
    quality: 0.9,
    time: 0.3,
    sustainability: 0.4,
  },
  /** Prioritizes environmental sustainability */
  ecoFriendly: {
    budget: 0.4,
    health: 0.6,
    quality: 0.5,
    time: 0.3,
    sustainability: 0.9,
  },
} as const;

// ============================================
// Content Type Labels
// ============================================

/**
 * Human-readable labels for content types.
 * Used in UI to display content type names.
 */
export const CONTENT_TYPE_LABELS: Readonly<Record<ContentType, string>> = {
  menu: 'Restaurant Menu',
  products: 'Products',
  listings: 'Listings',
  comparison: 'Comparison',
  document: 'Document',
  pricing: 'Pricing Plans',
  other: 'Other',
} as const;

// ============================================
// Dietary Options
// ============================================

/**
 * Supported dietary restriction options.
 * Used for filtering and tagging options.
 */
export const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'halal',
  'kosher',
  'low-carb',
  'keto',
  'paleo',
] as const;

/** Type for dietary option values */
export type DietaryOption = (typeof DIETARY_OPTIONS)[number];

// ============================================
// API Configuration
// ============================================

/** Bytes per megabyte for size calculations */
const BYTES_PER_MB = 1024 * 1024;

/**
 * API configuration limits and defaults.
 */
export const API_CONFIG = {
  /** Maximum image upload size (10MB) */
  maxImageSizeBytes: 10 * BYTES_PER_MB,
  /** Maximum image dimension in pixels */
  maxImageDimension: 2048,
  /** JPEG compression quality (0-1) */
  jpegQuality: 0.85,
  /** Request timeout in milliseconds */
  timeoutMs: 30000,
  /** Number of retry attempts on failure */
  retryAttempts: 2,
} as const;

// ============================================
// Confidence Thresholds
// ============================================

/**
 * Confidence score thresholds for categorization.
 * Used to determine UI feedback and warnings.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** High confidence - reliable recommendation */
  high: 0.85,
  /** Medium confidence - reasonable recommendation */
  medium: 0.70,
  /** Low confidence - may need user verification */
  low: 0.50,
} as const;

/** Confidence level identifiers */
export type ConfidenceLevel = keyof typeof CONFIDENCE_THRESHOLDS;
