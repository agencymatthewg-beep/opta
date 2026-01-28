/**
 * @fileoverview Core type definitions for Opta Mobile
 * @description Shared types used across mobile app, API, and packages
 */

// ============================================
// Content Types
// ============================================

/**
 * Types of content that can be scanned and analyzed.
 * Used to determine extraction strategies and UI presentation.
 */
export type ContentType =
  | 'menu'
  | 'products'
  | 'listings'
  | 'comparison'
  | 'document'
  | 'pricing'
  | 'other';

// ============================================
// Priorities & Constraints
// ============================================

/**
 * Weight values for optimization scoring priorities.
 * Each value is normalized between 0 and 1.
 * Higher values increase the importance of that factor.
 */
export interface PriorityWeights {
  /** Cost-effectiveness priority (0-1) */
  budget: number;
  /** Health/nutrition priority (0-1) */
  health: number;
  /** Quality/premium priority (0-1) */
  quality: number;
  /** Speed/convenience priority (0-1) */
  time: number;
  /** Environmental sustainability priority (0-1) */
  sustainability: number;
  /** Support for custom user-defined priorities */
  [key: string]: number;
}

/**
 * User-defined constraints for filtering options.
 * Options violating constraints may be excluded or penalized.
 */
export interface Constraints {
  /** Maximum price threshold */
  maxPrice?: number;
  /** Maximum calorie threshold */
  maxCalories?: number;
  /** Required dietary requirements (e.g., 'vegan', 'gluten-free') */
  dietary?: string[];
  /** Support for custom constraints */
  [key: string]: unknown;
}

/**
 * Saved user profile containing priorities and constraints.
 * Users can have multiple profiles for different contexts.
 */
export interface PriorityProfile {
  /** Unique profile identifier */
  readonly id: string;
  /** Owner user ID */
  readonly userId: string;
  /** User-friendly profile name */
  name: string;
  /** Priority weights for this profile */
  priorities: PriorityWeights;
  /** Constraints applied when using this profile */
  constraints: Constraints;
  /** Whether this is the user's default profile */
  isDefault: boolean;
  /** Profile creation timestamp */
  readonly createdAt: Date;
  /** Last modification timestamp */
  updatedAt: Date;
}

// ============================================
// Extracted Options
// ============================================

/**
 * Attributes extracted from an option by vision AI.
 * All fields are optional as extraction depends on source content.
 */
export interface OptionAttributes {
  /** Price in currency units */
  price?: number;
  /** Currency code (e.g., 'USD', 'EUR') */
  currency?: string;
  /** Calorie count */
  calories?: number;
  /** Protein content in grams */
  protein?: number;
  /** Rating score (typically 1-5) */
  rating?: number;
  /** Number of ratings/reviews */
  ratingCount?: number;
  /** Preparation time in minutes */
  prepTime?: number;
  /** Size or portion description */
  size?: string;
  /** Brand name if applicable */
  brand?: string;
  /** Support for additional extracted attributes */
  [key: string]: unknown;
}

/**
 * A single option extracted from scanned content.
 * Represents one choice the user could make.
 */
export interface ExtractedOption {
  /** Unique identifier for this option */
  readonly id: string;
  /** Display name of the option */
  name: string;
  /** Optional description or details */
  description?: string;
  /** Extracted attributes for scoring */
  attributes: OptionAttributes;
  /** Categorization tags (e.g., 'vegetarian', 'popular') */
  tags: string[];
  /** Position description in source (e.g., 'top-left') */
  position?: string;
  /** Bounding box in source image for highlighting */
  imageRegion?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

/**
 * Contextual information about the extraction source.
 */
export interface ExtractionContext {
  /** Source name (e.g., restaurant name, store name) */
  source?: string;
  /** Content category or type */
  category?: string;
  /** Additional contextual information */
  additionalInfo?: string;
}

/**
 * Complete result from vision AI extraction.
 * Contains all options found plus metadata.
 */
export interface ExtractionResult {
  /** Detected content type */
  contentType: ContentType;
  /** AI confidence in extraction accuracy (0-1) */
  confidence: number;
  /** All extracted options */
  options: ExtractedOption[];
  /** Contextual information about source */
  context: ExtractionContext;
  /** Notes about extraction quality or ambiguities */
  extractionNotes?: string;
  /** Time taken for extraction in milliseconds */
  processingTimeMs: number;
}

// ============================================
// Optimization Results
// ============================================

/**
 * An option with computed optimization score.
 * Extends ExtractedOption with scoring information.
 */
export interface ScoredOption extends ExtractedOption {
  /** Overall optimization score (0-1, higher is better) */
  score: number;
  /** Breakdown of score by priority category */
  scoreBreakdown: Record<string, number>;
  /** Rank among all options (1 = best) */
  rank: number;
}

/**
 * Complete recommendation from optimization.
 * Contains the top choice with reasoning.
 */
export interface Recommendation {
  /** The recommended best option */
  topChoice: ScoredOption;
  /** Other options in rank order */
  alternatives: ScoredOption[];
  /** Human-readable explanation of recommendation */
  explanation: string;
  /** Overall confidence in recommendation (0-1) */
  confidence: number;
}

// ============================================
// API Request/Response
// ============================================

/**
 * Request body for image scan endpoint.
 */
export interface ScanRequest {
  /** Base64-encoded image data */
  readonly image: string;
  /** Optional priority weight overrides */
  priorities?: Partial<PriorityWeights>;
  /** Optional filtering constraints */
  constraints?: Constraints;
  /** Optional context hint to guide AI extraction */
  context?: string;
}

/**
 * Response from scan endpoint.
 * Contains recommendation and all scored options.
 */
export interface ScanResponse {
  /** Whether the scan was successful */
  readonly success: boolean;
  /** Unique identifier for this scan */
  readonly scanId: string;
  /** Detected content type */
  readonly contentType: ContentType;
  /** Optimization recommendation */
  readonly recommendation: Recommendation;
  /** All options with scores */
  readonly allOptions: ScoredOption[];
  /** Overall extraction confidence */
  readonly confidence: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
  /** Error message if success is false */
  readonly error?: string;
}

/**
 * Request body for text-based scan endpoint.
 */
export interface TextScanRequest {
  /** Natural language query describing options to compare */
  readonly query: string;
  /** Optional priority weight overrides */
  priorities?: Partial<PriorityWeights>;
  /** Optional filtering constraints */
  constraints?: Constraints;
}

/**
 * Request body for re-optimization with new priorities.
 */
export interface ReoptimizeRequest {
  /** Original scan ID to re-optimize */
  readonly scanId: string;
  /** New priority weights to apply */
  readonly priorities: Partial<PriorityWeights>;
  /** Optional new constraints */
  constraints?: Constraints;
}

/**
 * Request body for submitting recommendation feedback.
 * Used to improve future recommendations.
 */
export interface FeedbackRequest {
  /** Scan ID being rated */
  readonly scanId: string;
  /** Whether user followed the recommendation */
  readonly acceptedRecommendation: boolean;
  /** What the user actually chose (if different) */
  actualChoice?: string;
  /** Optional text feedback */
  feedbackText?: string;
}

// ============================================
// User & Auth
// ============================================

/**
 * Available subscription tiers.
 */
export type SubscriptionTier = 'free' | 'pro' | 'family';

/**
 * User account information.
 */
export interface User {
  /** Unique user identifier */
  readonly id: string;
  /** User email address */
  readonly email: string;
  /** Current subscription tier */
  subscriptionTier: SubscriptionTier;
  /** Number of scans this month */
  scanCountMonth: number;
  /** Number of saves this month */
  saveCountMonth: number;
  /** Account creation timestamp */
  readonly createdAt: Date;
}

/**
 * Feature limits for a subscription tier.
 */
export interface UserLimits {
  /** Maximum scans per month (Infinity for unlimited) */
  scansPerMonth: number;
  /** Maximum saves per month (Infinity for unlimited) */
  savesPerMonth: number;
  /** Whether user has personalized learning */
  hasLearningMemory: boolean;
  /** Whether user has real-time data access */
  hasRealTimeData: boolean;
  /** Whether user gets priority processing */
  hasPrioritySpeed: boolean;
}

/**
 * Feature limits by subscription tier.
 * Defines what features are available at each tier.
 */
export const TIER_LIMITS: Readonly<Record<SubscriptionTier, UserLimits>> = {
  free: {
    scansPerMonth: Infinity, // Unlimited scans for all users
    savesPerMonth: 10,
    hasLearningMemory: false,
    hasRealTimeData: false,
    hasPrioritySpeed: false,
  },
  pro: {
    scansPerMonth: Infinity,
    savesPerMonth: Infinity,
    hasLearningMemory: true,
    hasRealTimeData: true,
    hasPrioritySpeed: true,
  },
  family: {
    scansPerMonth: Infinity,
    savesPerMonth: Infinity,
    hasLearningMemory: true,
    hasRealTimeData: true,
    hasPrioritySpeed: true,
  },
} as const;

// ============================================
// Saved Scans
// ============================================

/**
 * A scan result saved by the user for future reference.
 */
export interface SavedScan {
  /** Unique saved scan identifier */
  readonly id: string;
  /** Owner user ID */
  readonly userId: string;
  /** Original scan ID */
  readonly scanId: string;
  /** Content type from scan */
  readonly contentType: ContentType;
  /** Original extraction data */
  readonly extractionData: ExtractionResult;
  /** Original recommendation */
  readonly recommendation: Recommendation;
  /** User notes about this scan */
  notes?: string;
  /** Save timestamp */
  readonly createdAt: Date;
}

// ============================================
// Error Types
// ============================================

/**
 * Standard error codes returned by the API.
 */
export type ErrorCode =
  | 'INVALID_IMAGE'
  | 'EXTRACTION_FAILED'
  | 'NO_OPTIONS_FOUND'
  | 'LOW_CONFIDENCE'
  | 'RATE_LIMITED'
  | 'SAVE_LIMIT_REACHED'
  | 'UNAUTHORIZED'
  | 'SERVER_ERROR';

/**
 * Standard error response structure.
 */
export interface ApiError {
  /** Error code for programmatic handling */
  readonly code: ErrorCode;
  /** Human-readable error message */
  readonly message: string;
  /** Additional error details if available */
  readonly details?: unknown;
}
