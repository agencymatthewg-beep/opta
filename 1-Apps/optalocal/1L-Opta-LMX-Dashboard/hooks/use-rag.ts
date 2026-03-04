'use client'

import useSWR from 'swr'

import { lmxFetcher } from '@/lib/api'
import { useConnection } from '@/lib/connection'
import type { RagCollectionsResponse } from '@/lib/types'

/**
 * Poll /v1/rag/collections every 30s.
 * Returns all RAG collections with their document counts.
 */
export function useRagCollections() {
    const { isConnected } = useConnection()
    const { data, error, isLoading, mutate } = useSWR<RagCollectionsResponse>(
        isConnected ? '/v1/rag/collections' : null,
        lmxFetcher,
        { refreshInterval: 30_000 }
    )
    return {
        collections: data?.collections ?? [],
        totalDocuments: data?.total_documents ?? 0,
        collectionCount: data?.collection_count ?? 0,
        error,
        isLoading,
        refresh: mutate,
    }
}
