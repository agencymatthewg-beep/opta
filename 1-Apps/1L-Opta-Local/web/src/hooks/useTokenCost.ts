'use client';

/**
 * useTokenCost — Token counter and cloud cost estimator.
 *
 * Estimates token counts from message content length (~4 chars/token
 * for English text) and calculates what those tokens would cost on
 * major cloud providers. Shows users how much they save by running
 * locally on their Mac Studio.
 *
 * Prompt tokens = all messages except the last assistant message.
 * Completion tokens = last assistant message content.
 */

import { useMemo } from 'react';
import type { ChatMessage } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Cloud pricing (per 1M tokens, USD)
// ---------------------------------------------------------------------------

const CLOUD_PRICING = {
  'GPT-4o': { input: 2.50, output: 10.00 },
  'Claude 3.5 Sonnet': { input: 3.00, output: 15.00 },
  'GPT-4 Turbo': { input: 10.00, output: 30.00 },
} as const;

type ProviderName = keyof typeof CLOUD_PRICING;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseTokenCostReturn {
  /** Estimated prompt (input) token count */
  promptTokens: number;
  /** Estimated completion (output) token count */
  completionTokens: number;
  /** Total estimated tokens (prompt + completion) */
  totalTokens: number;
  /** Estimated cloud cost per provider (USD) */
  estimatedCosts: Record<string, number>;
  /** Average savings across all providers (USD) */
  totalSaved: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Estimate token count from text content (~4 characters per token for English). */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Calculate cost in USD for a given token count at a per-1M-tokens rate. */
function calculateCost(tokens: number, ratePer1M: number): number {
  return (tokens / 1_000_000) * ratePer1M;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTokenCost(messages: ChatMessage[]): UseTokenCostReturn {
  return useMemo(() => {
    if (messages.length === 0) {
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCosts: {},
        totalSaved: 0,
      };
    }

    // Find the last assistant message for completion tokens
    let lastAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }

    // Prompt tokens: all messages except the last assistant message
    let promptTokens = 0;
    let completionTokens = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg) continue;

      const tokens = estimateTokens(msg.content);

      if (i === lastAssistantIndex) {
        completionTokens = tokens;
      } else {
        promptTokens += tokens;
      }
    }

    const totalTokens = promptTokens + completionTokens;

    // Calculate per-provider costs
    const providerNames = Object.keys(CLOUD_PRICING) as ProviderName[];
    const estimatedCosts: Record<string, number> = {};
    let costSum = 0;

    for (const provider of providerNames) {
      const pricing = CLOUD_PRICING[provider];
      const inputCost = calculateCost(promptTokens, pricing.input);
      const outputCost = calculateCost(completionTokens, pricing.output);
      const total = inputCost + outputCost;
      estimatedCosts[provider] = total;
      costSum += total;
    }

    // Average savings across providers (since local cost is $0)
    const totalSaved = providerNames.length > 0
      ? costSum / providerNames.length
      : 0;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCosts,
      totalSaved,
    };
  }, [messages]);
}
