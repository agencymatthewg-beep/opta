/**
 * pricing.ts — Token cost estimation for cloud providers.
 *
 * Rates are per million tokens (USD). Local inference via Opta-LMX is free.
 */

export interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
}

/** Anthropic model pricing (USD per million tokens). */
const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-5-20250929': { inputPerM: 3, outputPerM: 15 },
  'claude-sonnet-4-5': { inputPerM: 3, outputPerM: 15 },
  'claude-opus-4-5': { inputPerM: 15, outputPerM: 75 },
  'claude-haiku-3-5': { inputPerM: 0.80, outputPerM: 4 },
  'claude-haiku-3-5-20241022': { inputPerM: 0.80, outputPerM: 4 },
};

/** Default Anthropic pricing when model is unknown. */
const ANTHROPIC_DEFAULT: ModelPricing = { inputPerM: 3, outputPerM: 15 };

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  isLocal: boolean;
}

/**
 * Estimate the cost of a turn given token counts and provider info.
 *
 * Returns zero cost for local inference (provider === 'lmx').
 */
export function estimateCost(
  promptTokens: number,
  completionTokens: number,
  provider: string,
  model?: string,
): CostEstimate {
  if (provider === 'lmx') {
    return { inputCost: 0, outputCost: 0, totalCost: 0, isLocal: true };
  }

  const pricing = (model && ANTHROPIC_PRICING[model]) || ANTHROPIC_DEFAULT;
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPerM;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    isLocal: false,
  };
}

/** Format a cost value for display (e.g. "$0.0042"). */
export function formatCost(cost: CostEstimate): string {
  if (cost.isLocal) return 'Free';
  if (cost.totalCost < 0.0001) return '<$0.0001';
  return `~$${cost.totalCost.toFixed(4)}`;
}
