'use client';

/**
 * useRAG — Hook for RAG collection management, ingestion, and querying.
 *
 * Wraps LMXClient RAG methods with loading/error state. Uses SWR for
 * the collections list with auto-refresh. Provides optimistic delete
 * and refreshable collection list.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import type { LMXClient } from '@/lib/lmx-client';
import type {
  RagIngestRequest,
  RagIngestResponse,
  RagQueryRequest,
  RagQueryResponse,
  RagContextRequest,
  RagContextResponse,
  RagCollectionInfo,
  RagCollectionsResponse,
} from '@/types/rag';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseRAGReturn {
  /** All RAG collections */
  collections: RagCollectionInfo[];
  /** Total document count across all collections */
  totalDocuments: number;
  /** Whether collections are loading */
  isLoading: boolean;
  /** Error from fetching collections */
  error: Error | undefined;
  /** Ingest documents into a collection */
  ingestDocuments: (req: RagIngestRequest) => Promise<RagIngestResponse>;
  /** Query a collection for relevant documents */
  queryCollection: (req: RagQueryRequest) => Promise<RagQueryResponse>;
  /** Assemble context from multiple collections */
  assembleContext: (req: RagContextRequest) => Promise<RagContextResponse>;
  /** Delete a collection (optimistic update) */
  deleteCollection: (name: string) => Promise<void>;
  /** Manually refresh the collections list */
  refreshCollections: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRAG(client: LMXClient | null): UseRAGReturn {
  const [, setActionError] = useState<string | null>(null);

  // Fetch collections from LMX with SWR
  const { data, error, isLoading, mutate } = useSWR<RagCollectionsResponse>(
    client ? 'lmx:rag-collections' : null,
    () => client!.ragListCollections(),
    {
      refreshInterval: 30_000, // Refresh every 30s
      revalidateOnFocus: true,
      errorRetryCount: 2,
      dedupingInterval: 5_000,
    },
  );

  const collections = data?.collections ?? [];
  const totalDocuments = data?.total_documents ?? 0;

  // Ingest documents — revalidates collections after success
  const ingestDocuments = useCallback(
    async (req: RagIngestRequest): Promise<RagIngestResponse> => {
      if (!client) {
        throw new Error('LMX client not initialized');
      }
      setActionError(null);
      try {
        const result = await client.ragIngest(req);
        // Revalidate collections list after ingestion
        void mutate();
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to ingest documents';
        setActionError(message);
        throw err;
      }
    },
    [client, mutate],
  );

  // Query a collection
  const queryCollection = useCallback(
    async (req: RagQueryRequest): Promise<RagQueryResponse> => {
      if (!client) {
        throw new Error('LMX client not initialized');
      }
      return client.ragQuery(req);
    },
    [client],
  );

  // Assemble context from multiple collections
  const assembleContext = useCallback(
    async (req: RagContextRequest): Promise<RagContextResponse> => {
      if (!client) {
        throw new Error('LMX client not initialized');
      }
      return client.ragContext(req);
    },
    [client],
  );

  // Delete a collection with optimistic update
  const deleteCollection = useCallback(
    async (name: string) => {
      if (!client) return;
      setActionError(null);

      await mutate(
        async (current) => {
          await client.ragDeleteCollection(name);
          if (!current) return current;
          const remaining = current.collections.filter((c) => c.name !== name);
          const removedCount =
            current.collections.find((c) => c.name === name)
              ?.document_count ?? 0;
          return {
            collections: remaining,
            collection_count: remaining.length,
            total_documents: current.total_documents - removedCount,
          };
        },
        {
          optimisticData: data
            ? {
                collections: data.collections.filter((c) => c.name !== name),
                collection_count: data.collection_count - 1,
                total_documents:
                  data.total_documents -
                  (data.collections.find((c) => c.name === name)
                    ?.document_count ?? 0),
              }
            : undefined,
          rollbackOnError: true,
          revalidate: false,
        },
      );
    },
    [client, mutate, data],
  );

  const refreshCollections = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    collections,
    totalDocuments,
    isLoading,
    error,
    ingestDocuments,
    queryCollection,
    assembleContext,
    deleteCollection,
    refreshCollections,
  };
}
