'use client';

import useSWR from 'swr';
import type { LMXClient } from '@/lib/lmx-client';
import type { ModelsResponse, LoadedModel } from '@/types/lmx';

interface UseModelsReturn {
  models: LoadedModel[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}

/**
 * SWR hook for fetching loaded models from the LMX server.
 *
 * Polls every 10 seconds since models can be loaded/unloaded from the CLI,
 * other browser tabs, or the dashboard. Revalidates on focus (tab switch).
 * Returns an empty array when the server is unreachable.
 */
export function useModels(client: LMXClient | null): UseModelsReturn {
  const { data, error, isLoading, mutate } = useSWR<ModelsResponse>(
    client ? 'lmx:models' : null,
    () => client!.getModels(),
    {
      refreshInterval: 10_000, // Poll every 10s (models can change)
      revalidateOnFocus: true,
      errorRetryCount: 2,
      dedupingInterval: 5_000,
    },
  );

  return {
    models: data?.data ?? [],
    isLoading,
    isError: !!error,
    refresh: () => void mutate(),
  };
}
