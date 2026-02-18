/**
 * RAG API Types
 *
 * TypeScript interfaces for the Opta LMX RAG endpoints.
 * Matches the Pydantic models in opta_lmx/api/rag.py.
 */

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export interface RagIngestRequest {
  collection: string;
  documents: string[];
  metadata?: Record<string, unknown>[];
  chunk_size?: number;
  chunk_overlap?: number;
  chunking?: 'auto' | 'text' | 'code' | 'none';
  model?: string;
}

export interface RagIngestResponse {
  collection: string;
  documents_ingested: number;
  chunks_created: number;
  document_ids: string[];
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export interface RagQueryRequest {
  collection: string;
  query: string;
  top_k?: number;
  min_score?: number;
  model?: string;
  include_embeddings?: boolean;
  search_mode?: 'vector' | 'keyword' | 'hybrid';
}

export interface RagQueryResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RagQueryResponse {
  collection: string;
  query: string;
  results: RagQueryResult[];
  total_in_collection: number;
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Context Assembly
// ---------------------------------------------------------------------------

export interface RagContextRequest {
  query: string;
  collections: string[];
  top_k_per_collection?: number;
  min_score?: number;
  max_context_tokens?: number;
  model?: string;
}

export interface RagContextResponse {
  context: string;
  sources: Record<string, unknown>[];
  total_chunks: number;
  estimated_tokens: number;
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface RagCollectionInfo {
  name: string;
  document_count: number;
  embedding_dimensions: number;
}

export interface RagCollectionsResponse {
  total_documents: number;
  collection_count: number;
  collections: RagCollectionInfo[];
}
