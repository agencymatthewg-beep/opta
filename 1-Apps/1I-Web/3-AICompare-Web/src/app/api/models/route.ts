import { NextResponse } from 'next/server';
import type { AIModel, DataSource, ModelsApiResponse, PricingInfo } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const revalidate = 1800; // Cache for 30 minutes

interface PricingData {
  modelId: string;
  modelName: string;
  pricing: PricingInfo;
  contextLength: number;
}

/**
 * Unified models API endpoint
 * Fetches and merges data from multiple sources
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const sources: DataSource[] = [];
  let models: AIModel[] = [];

  try {
    // Fetch from Hugging Face benchmarks and OpenRouter pricing in parallel
    const [hfResponse, orResponse] = await Promise.all([
      fetch(`${baseUrl}/api/benchmarks/huggingface`, {
        next: { revalidate: 3600 },
      }).catch(() => null),
      fetch(`${baseUrl}/api/pricing/openrouter`, {
        next: { revalidate: 3600 },
      }).catch(() => null),
    ]);

    // Process HuggingFace benchmarks
    if (hfResponse?.ok) {
      const hfData = await hfResponse.json();
      models = hfData.models || [];
      if (hfData.source) {
        sources.push(hfData.source);
      }
    }

    // Process OpenRouter pricing
    if (orResponse?.ok) {
      const orData = await orResponse.json();
      if (orData.pricing && orData.pricing.length > 0) {
        models = mergeWithPricing(models, orData.pricing);
        if (orData.source) {
          sources.push(orData.source);
        }
      }
    }

    // Sort by composite score and assign ranks
    models.sort((a, b) => b.compositeScore - a.compositeScore);
    models = models.map((model, index) => {
      const rank = index + 1;
      // Simulate rank movement for demo (in production, this would come from historical data)
      // Top 3 are stable, others have random movement
      let previousRank: number | undefined;
      if (rank > 3) {
        const movement = Math.floor(Math.random() * 5) - 2; // -2 to +2
        if (movement !== 0) {
          previousRank = Math.max(1, rank + movement);
        }
      }
      return {
        ...model,
        rank,
        previousRank,
      };
    });

    const response: ModelsApiResponse = {
      models,
      sources,
      lastUpdated: new Date().toISOString(),
      totalCount: models.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Models API error:', error);

    // Return empty response on error
    return NextResponse.json(
      {
        models: [],
        sources: [],
        lastUpdated: new Date().toISOString(),
        totalCount: 0,
        error: 'Failed to fetch models',
      },
      { status: 500 }
    );
  }
}

/**
 * Merge benchmark models with pricing data
 */
function mergeWithPricing(
  models: AIModel[],
  pricing: PricingData[]
): AIModel[] {
  // Create pricing map with normalized names
  const pricingMap = new Map<string, { pricing: PricingInfo; contextLength: number }>();

  for (const p of pricing) {
    const normalizedName = normalizeModelName(p.modelName);
    pricingMap.set(normalizedName, {
      pricing: p.pricing,
      contextLength: p.contextLength,
    });

    // Also try with model ID parts
    const idParts = p.modelId.split('/');
    if (idParts.length > 1) {
      pricingMap.set(normalizeModelName(idParts[1]), {
        pricing: p.pricing,
        contextLength: p.contextLength,
      });
    }
  }

  return models.map((model) => {
    const normalizedName = normalizeModelName(model.name);
    const pricingData = pricingMap.get(normalizedName);

    if (pricingData) {
      return {
        ...model,
        pricing: pricingData.pricing,
        capabilities: {
          ...model.capabilities,
          contextLength: pricingData.contextLength || model.capabilities.contextLength,
        },
        sources: [...model.sources, pricingData.pricing.source],
      };
    }
    return model;
  });
}

function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(anthropic|openai|google|meta|mistral|deepseek|alibaba|xai|cohere)/, '');
}
