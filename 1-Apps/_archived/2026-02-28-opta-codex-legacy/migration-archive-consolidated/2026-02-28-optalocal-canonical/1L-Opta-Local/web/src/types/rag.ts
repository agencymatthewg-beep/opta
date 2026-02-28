export interface RagDocument {
  id?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface RagIngestRequest {
  collection: string;
  documents: Array<string | RagDocument>;
  chunk_size?: number;
  overlap?: number;
  metadata?: Record<string, unknown>;
}

export interface RagIngestResponse {
  collection: string;
  ingested: number;
  chunks_created?: number;
  skipped?: number;
}

export interface RagQueryRequest {
  collection: string;
  query: string;
  top_k?: number;
  filters?: Record<string, unknown>;
}

export interface RagQueryResult {
  id?: string;
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface RagQueryResponse {
  collection: string;
  query: string;
  results: RagQueryResult[];
}

export interface RagContextRequest {
  query: string;
  collections: string[];
  top_k?: number;
  max_context_tokens?: number;
}

export interface RagContextResponse {
  query: string;
  context: string;
  sources: RagQueryResult[];
}

export interface RagCollectionInfo {
  name: string;
  documents: number;
  chunks: number;
  updated_at?: string;
}

export interface RagCollectionsResponse {
  collections: RagCollectionInfo[];
}
