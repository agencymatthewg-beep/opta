// AI Comp - Core Type Definitions with Source Attribution

/**
 * Data source tracking for transparency and attribution
 */
export type SourceName = 'huggingface' | 'openrouter' | 'artificial_analysis' | 'manual' | 'lmsys';

export interface DataSource {
  name: SourceName;
  url: string;
  lastFetched: string; // ISO 8601 timestamp
  confidence: 'high' | 'medium' | 'low';
  version?: string;
}

/**
 * Benchmark score with source attribution
 */
export interface BenchmarkScore {
  name: string;
  score: number;
  maxScore: number;
  source: DataSource;
  percentile?: number;
  methodology?: string;
}

/**
 * Pricing information with source attribution
 */
export interface PricingInfo {
  promptPer1M: number;      // $ per 1M input tokens
  completionPer1M: number;  // $ per 1M output tokens
  source: DataSource;
  currency: 'USD';
  notes?: string;
}

/**
 * Model capabilities and features
 */
export interface ModelCapabilities {
  contextLength: number;
  maxOutputTokens?: number;
  modalities: Modality[];
  functionCalling: boolean;
  streaming: boolean;
  fineTunable: boolean;
  jsonMode: boolean;
  vision: boolean;
}

export type Modality = 'text' | 'image' | 'audio' | 'video' | 'code';

/**
 * Model type tags
 */
export type ModelType =
  | 'llm'
  | 'multimodal'
  | 'embedding'
  | 'image'
  | 'audio'
  | 'video'
  | 'code'
  | 'api'
  | 'web'
  | 'cli'
  | 'open-source'
  | 'proprietary';

export interface ModelTag {
  type: ModelType;
  parameters?: string; // e.g., "~175B"
}

/**
 * Model status indicators
 */
export type ModelStatus = 'active' | 'new' | 'trending' | 'deprecated' | 'beta';

/**
 * Core AI Model interface with full attribution
 */
export interface AIModel {
  // Identity
  id: string;
  slug: string;
  name: string;
  company: string;
  family?: string; // e.g., "Claude 3.5", "GPT-4"

  // Ranking
  rank: number;
  compositeScore: number;
  previousRank?: number;

  // Status
  status: ModelStatus;
  releaseDate?: string;
  lastUpdated: string;

  // Capabilities
  capabilities: ModelCapabilities;
  tags: ModelTag[];

  // Scores with attribution
  benchmarks: BenchmarkScore[];

  // Pricing with attribution
  pricing?: PricingInfo;

  // Source tracking
  sources: DataSource[];
}

/**
 * Leaderboard filter state
 */
export interface LeaderboardFilters {
  search: string;
  companies: string[];
  modalities: Modality[];
  modelTypes: ModelType[];
  contextRange: [number, number];
  priceRange: [number, number];
  sortBy: 'rank' | 'name' | 'company' | 'price' | 'context' | 'score';
  sortOrder: 'asc' | 'desc';
  showDeprecated: boolean;
}

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: LeaderboardFilters = {
  search: '',
  companies: [],
  modalities: [],
  modelTypes: [],
  contextRange: [0, 2_000_000],
  priceRange: [0, 100],
  sortBy: 'rank',
  sortOrder: 'asc',
  showDeprecated: false,
};

/**
 * Comparison selection state
 */
export interface CompareSelection {
  modelIds: string[];
  maxModels: number;
}

/**
 * API response types
 */
export interface ModelsApiResponse {
  models: AIModel[];
  sources: DataSource[];
  lastUpdated: string;
  totalCount: number;
}

export interface BenchmarksApiResponse {
  benchmarks: BenchmarkMetadata[];
  source: DataSource;
}

export interface PricingApiResponse {
  pricing: Array<{
    modelId: string;
    modelName: string;
    pricing: PricingInfo;
  }>;
  source: DataSource;
}

/**
 * Benchmark metadata for explanations
 */
export interface BenchmarkMetadata {
  id: string;
  name: string;
  fullName: string;
  description: string;
  category: 'knowledge' | 'reasoning' | 'coding' | 'math' | 'instruction' | 'safety';
  weight: number; // For composite score calculation
  maxScore: number;
  sourceUrl: string;
}

/**
 * News item type
 */
export interface NewsItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  tag: 'Rankings' | 'New Model' | 'Announcement' | 'Pricing' | 'Benchmark';
  url?: string;
  source?: DataSource;
}

/**
 * Helper type for partial updates
 */
export type PartialAIModel = Partial<AIModel> & { id: string };

/**
 * Type guard for checking if model has pricing
 */
export function hasPricing(model: AIModel): model is AIModel & { pricing: PricingInfo } {
  return model.pricing !== undefined;
}

/**
 * Type guard for checking if model has specific benchmark
 */
export function hasBenchmark(model: AIModel, benchmarkName: string): boolean {
  return model.benchmarks.some(b => b.name === benchmarkName);
}
