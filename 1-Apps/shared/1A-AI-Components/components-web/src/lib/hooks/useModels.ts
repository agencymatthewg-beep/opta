'use client';

import useSWR from 'swr';
import Fuse from 'fuse.js';
import { useMemo } from 'react';
import type { AIModel, LeaderboardFilters, ModelsApiResponse } from '@/lib/types';
import { DEFAULT_FILTERS } from '@/lib/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
};

interface UseModelsOptions {
  filters?: Partial<LeaderboardFilters>;
  enabled?: boolean;
}

interface UseModelsReturn {
  models: AIModel[];
  allModels: AIModel[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => void;
  source: ModelsApiResponse['sources'] | null;
  lastUpdated: string | null;
  isFallback: boolean;
}

/**
 * Hook for fetching and filtering AI models
 */
export function useModels(options: UseModelsOptions = {}): UseModelsReturn {
  const { filters = {}, enabled = true } = options;
  const mergedFilters = { ...DEFAULT_FILTERS, ...filters };

  const { data, error, isLoading, mutate } = useSWR<ModelsApiResponse & { fallback?: boolean }>(
    enabled ? '/api/models' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
      errorRetryCount: 2,
      fallbackData: undefined,
    }
  );

  // Create Fuse instance for fuzzy search
  const fuse = useMemo(() => {
    if (!data?.models) return null;
    return new Fuse(data.models, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'company', weight: 0.3 },
        { name: 'tags.type', weight: 0.2 },
        { name: 'capabilities.modalities', weight: 0.1 },
      ],
      threshold: 0.3,
      includeScore: true,
      ignoreLocation: true,
    });
  }, [data?.models]);

  // Apply filters
  const filteredModels = useMemo(() => {
    if (!data?.models) return [];

    let result = [...data.models];

    // Search filter (fuzzy matching with Fuse.js)
    if (mergedFilters.search && fuse) {
      const searchResults = fuse.search(mergedFilters.search);
      result = searchResults.map((r) => r.item);
    }

    // Company filter
    if (mergedFilters.companies.length > 0) {
      result = result.filter((m) => mergedFilters.companies.includes(m.company));
    }

    // Modality filter
    if (mergedFilters.modalities.length > 0) {
      result = result.filter((m) =>
        mergedFilters.modalities.some((mod) => m.capabilities.modalities.includes(mod))
      );
    }

    // Model type filter
    if (mergedFilters.modelTypes.length > 0) {
      result = result.filter((m) =>
        mergedFilters.modelTypes.some((type) => m.tags.some((tag) => tag.type === type))
      );
    }

    // Context length filter
    if (mergedFilters.contextRange[0] > 0 || mergedFilters.contextRange[1] < 2_000_000) {
      result = result.filter(
        (m) =>
          m.capabilities.contextLength >= mergedFilters.contextRange[0] &&
          m.capabilities.contextLength <= mergedFilters.contextRange[1]
      );
    }

    // Price filter
    if (mergedFilters.priceRange[0] > 0 || mergedFilters.priceRange[1] < 100) {
      result = result.filter((m) => {
        if (!m.pricing) return true; // Include models without pricing data
        return (
          m.pricing.promptPer1M >= mergedFilters.priceRange[0] &&
          m.pricing.promptPer1M <= mergedFilters.priceRange[1]
        );
      });
    }

    // Deprecated filter
    if (!mergedFilters.showDeprecated) {
      result = result.filter((m) => m.status !== 'deprecated');
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (mergedFilters.sortBy) {
        case 'rank':
          comparison = a.rank - b.rank;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'company':
          comparison = a.company.localeCompare(b.company);
          break;
        case 'score':
          comparison = b.compositeScore - a.compositeScore;
          break;
        case 'price':
          const priceA = a.pricing?.promptPer1M ?? Infinity;
          const priceB = b.pricing?.promptPer1M ?? Infinity;
          comparison = priceA - priceB;
          break;
        case 'context':
          comparison = b.capabilities.contextLength - a.capabilities.contextLength;
          break;
        default:
          comparison = a.rank - b.rank;
      }
      return mergedFilters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [data?.models, mergedFilters, fuse]);

  return {
    models: filteredModels,
    allModels: data?.models ?? [],
    isLoading,
    isError: !!error,
    error: error ?? null,
    refresh: () => mutate(),
    source: data?.sources ?? null,
    lastUpdated: data?.lastUpdated ?? null,
    isFallback: data?.fallback ?? false,
  };
}

/**
 * Hook for searching models (lightweight, for search bar)
 */
export function useModelSearch(query: string, allModels: AIModel[], limit = 5): AIModel[] {
  const fuse = useMemo(() => {
    return new Fuse(allModels, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'company', weight: 0.3 },
        { name: 'tags.type', weight: 0.2 },
      ],
      threshold: 0.3,
      includeScore: true,
    });
  }, [allModels]);

  return useMemo(() => {
    if (!query || query.length < 1) return [];
    const results = fuse.search(query);
    return results.slice(0, limit).map((r) => r.item);
  }, [query, fuse, limit]);
}

/**
 * Hook for getting unique filter options from models
 */
export function useFilterOptions(models: AIModel[]) {
  return useMemo(() => {
    const companies = [...new Set(models.map((m) => m.company))].sort();
    const modelTypes = [...new Set(models.flatMap((m) => m.tags.map((t) => t.type)))].sort();
    const modalities = [...new Set(models.flatMap((m) => m.capabilities.modalities))].sort();

    const maxContext = Math.max(...models.map((m) => m.capabilities.contextLength), 0);
    const maxPrice = Math.max(...models.map((m) => m.pricing?.promptPer1M ?? 0), 0);

    return {
      companies,
      modelTypes,
      modalities,
      maxContext,
      maxPrice: Math.ceil(maxPrice),
    };
  }, [models]);
}
