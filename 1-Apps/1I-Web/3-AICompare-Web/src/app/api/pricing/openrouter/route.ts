import { NextResponse } from 'next/server';
import type { DataSource, PricingInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

// OpenRouter API response structure
interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string; // Price per token as string
    completion: string;
    image?: string;
    request?: string;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

interface PricingData {
  modelId: string;
  modelName: string;
  pricing: PricingInfo;
  contextLength: number;
}

/**
 * Fetch pricing data from OpenRouter
 */
export async function GET() {
  const source: DataSource = {
    name: 'openrouter',
    url: 'https://openrouter.ai/models',
    lastFetched: new Date().toISOString(),
    confidence: 'high',
  };

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.warn(`OpenRouter API returned ${response.status}`);
      return NextResponse.json({
        pricing: [],
        source: { ...source, confidence: 'low' },
        error: `API returned ${response.status}`,
      });
    }

    const data: OpenRouterResponse = await response.json();

    // Transform to our pricing format
    const pricing: PricingData[] = data.data.map((model) => {
      // OpenRouter prices are per token, we convert to per 1M tokens
      const promptPricePerToken = parseFloat(model.pricing.prompt) || 0;
      const completionPricePerToken = parseFloat(model.pricing.completion) || 0;

      return {
        modelId: model.id,
        modelName: model.name,
        pricing: {
          promptPer1M: promptPricePerToken * 1_000_000,
          completionPer1M: completionPricePerToken * 1_000_000,
          source,
          currency: 'USD' as const,
        },
        contextLength: model.context_length,
      };
    });

    return NextResponse.json({
      pricing,
      source,
      totalCount: pricing.length,
    });
  } catch (error) {
    console.error('OpenRouter API error:', error);

    return NextResponse.json({
      pricing: getFallbackPricing(source),
      source: { ...source, confidence: 'medium' },
      fallback: true,
      error: 'Failed to fetch live data',
    });
  }
}

/**
 * Fallback pricing data when API is unavailable
 */
function getFallbackPricing(source: DataSource): PricingData[] {
  const fallbackSource: DataSource = { ...source, confidence: 'medium' };

  return [
    { modelId: 'anthropic/claude-3.5-sonnet', modelName: 'Claude 3.5 Sonnet', pricing: { promptPer1M: 3.00, completionPer1M: 15.00, source: fallbackSource, currency: 'USD' }, contextLength: 200000 },
    { modelId: 'anthropic/claude-3-opus', modelName: 'Claude 3 Opus', pricing: { promptPer1M: 15.00, completionPer1M: 75.00, source: fallbackSource, currency: 'USD' }, contextLength: 200000 },
    { modelId: 'openai/gpt-4-turbo', modelName: 'GPT-4 Turbo', pricing: { promptPer1M: 10.00, completionPer1M: 30.00, source: fallbackSource, currency: 'USD' }, contextLength: 128000 },
    { modelId: 'openai/gpt-4o', modelName: 'GPT-4o', pricing: { promptPer1M: 5.00, completionPer1M: 15.00, source: fallbackSource, currency: 'USD' }, contextLength: 128000 },
    { modelId: 'google/gemini-1.5-pro', modelName: 'Gemini 1.5 Pro', pricing: { promptPer1M: 2.50, completionPer1M: 10.00, source: fallbackSource, currency: 'USD' }, contextLength: 2000000 },
    { modelId: 'meta-llama/llama-3.1-405b', modelName: 'Llama 3.1 405B', pricing: { promptPer1M: 2.70, completionPer1M: 2.70, source: fallbackSource, currency: 'USD' }, contextLength: 128000 },
    { modelId: 'mistralai/mistral-large', modelName: 'Mistral Large', pricing: { promptPer1M: 3.00, completionPer1M: 9.00, source: fallbackSource, currency: 'USD' }, contextLength: 128000 },
    { modelId: 'deepseek/deepseek-coder', modelName: 'DeepSeek Coder', pricing: { promptPer1M: 0.14, completionPer1M: 0.28, source: fallbackSource, currency: 'USD' }, contextLength: 128000 },
  ];
}
