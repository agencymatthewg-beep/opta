"""RAG API routes — /v1/rag/* endpoints for retrieval-augmented generation.

Provides document ingestion, semantic search, and collection management.
Uses the embedding engine (local or remote) for vector generation and
the in-memory vector store for similarity search.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.responses import Response

from opta_lmx.api.deps import AdminAuth, Embeddings, RagStore, RemoteEmbedding
from opta_lmx.api.errors import internal_error, openai_error
from opta_lmx.rag.chunker import chunk_code, chunk_markdown, chunk_text
from opta_lmx.rag.store import VectorStore
from opta_lmx.helpers.client import HelperNodeError

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_store(store: VectorStore | None) -> VectorStore:
    """Validate that the RAG store is initialized, or raise a clear error."""
    if store is None:
        raise RuntimeError("RAG store not initialized — is rag.enabled set in config?")
    return store


# ── Request/Response Models ───────────────────────────────────────────────


class IngestRequest(BaseModel):
    """Ingest documents into a RAG collection."""

    collection: str = Field(..., min_length=1, max_length=64, description="Collection name")
    documents: list[str] = Field(
        ..., min_length=1, max_length=100, description="Text documents to ingest"
    )
    metadata: list[dict[str, Any]] | None = Field(None, description="Per-document metadata")
    chunk_size: int = Field(512, ge=64, le=2048, description="Target tokens per chunk")
    chunk_overlap: int = Field(64, ge=0, le=512, description="Token overlap between chunks")
    chunking: str = Field(
        "auto", pattern="^(auto|text|code|markdown_headers|none)$",
        description="Chunking strategy"
    )
    model: str | None = Field(
        None, description="Embedding model (uses configured default if omitted)"
    )


class IngestResponse(BaseModel):
    """Response from document ingestion."""

    collection: str
    documents_ingested: int
    chunks_created: int
    document_ids: list[str]
    duration_ms: float


class QueryRequest(BaseModel):
    """Query a RAG collection for relevant context."""

    collection: str = Field(..., min_length=1, description="Collection to search")
    query: str = Field(..., min_length=1, description="Search query text")
    top_k: int = Field(5, ge=1, le=50, description="Maximum results")
    min_score: float = Field(0.0, ge=0.0, le=1.0, description="Minimum similarity threshold")
    model: str | None = Field(
        None, description="Embedding model (uses configured default if omitted)"
    )
    include_embeddings: bool = Field(False, description="Include embedding vectors in response")
    search_mode: str = Field(
        "vector",
        pattern="^(vector|keyword|hybrid)$",
        description="Search mode: vector (semantic), keyword (BM25), or hybrid (RRF fusion)",
    )


class QueryResult(BaseModel):
    """A single search result."""

    id: str
    text: str
    score: float
    metadata: dict[str, Any]
    embedding: list[float] | None = None


class QueryResponse(BaseModel):
    """Response from RAG query."""

    collection: str
    query: str
    results: list[QueryResult]
    total_in_collection: int
    duration_ms: float


class CollectionInfo(BaseModel):
    """Information about a single collection."""

    name: str
    document_count: int
    embedding_dimensions: int


class StoreStatsResponse(BaseModel):
    """Statistics about the vector store."""

    total_documents: int
    collection_count: int
    collections: list[CollectionInfo]


class ContextAssemblyRequest(BaseModel):
    """Assemble context from multiple collections for a prompt."""

    query: str = Field(..., min_length=1, description="The user's question/prompt")
    collections: list[str] = Field(..., min_length=1, description="Collections to search")
    top_k_per_collection: int = Field(3, ge=1, le=20, description="Results per collection")
    min_score: float = Field(0.1, ge=0.0, le=1.0, description="Minimum similarity")
    max_context_tokens: int = Field(4096, ge=256, le=32768, description="Max total context tokens")
    model: str | None = Field(None, description="Embedding model")


class ContextAssemblyResponse(BaseModel):
    """Assembled context ready for injection into a prompt."""

    context: str
    sources: list[dict[str, Any]]
    total_chunks: int
    estimated_tokens: int
    duration_ms: float


# ── Helper: embed texts ─────────────────────────────────────────────────


async def _embed_texts(
    texts: list[str],
    model: str | None,
    embedding_engine: Any,
    remote_client: Any,
) -> list[list[float]]:
    """Embed texts using helper node (if available) or local engine."""
    # Try remote first
    if remote_client is not None:
        try:
            return await remote_client.embed(texts)
        except HelperNodeError:
            logger.info("rag_helper_node_embed_fallback_to_local")

    # Local engine
    if embedding_engine is None:
        raise RuntimeError(
            "No embedding engine available. Configure models.embedding_model "
            "or helper_nodes.embedding."
        )

    return await embedding_engine.embed(texts, model_id=model)


# ── Routes ───────────────────────────────────────────────────────────────


@router.post("/v1/rag/ingest", response_model=None)
async def ingest_documents(
    body: IngestRequest,
    _auth: AdminAuth,
    embedding_engine: Embeddings,
    remote_client: RemoteEmbedding,
    rag_store: RagStore,
) -> Response:
    """Ingest documents into a RAG collection.

    Documents are chunked (if enabled), embedded, and stored in the
    vector store for later retrieval via /v1/rag/query.
    """
    store = _require_store(rag_store)
    start = time.monotonic()

    # Chunk documents
    all_chunks: list[str] = []
    all_metadata: list[dict[str, Any]] = []
    metas = body.metadata or [{} for _ in body.documents]

    for i, doc in enumerate(body.documents):
        doc_meta = metas[i] if i < len(metas) else {}

        if body.chunking == "none":
            all_chunks.append(doc)
            all_metadata.append({**doc_meta, "doc_index": i})
        elif body.chunking == "code":
            chunks = chunk_code(doc, body.chunk_size, body.chunk_overlap)
            for chunk in chunks:
                all_chunks.append(chunk.text)
                all_metadata.append({
                    **doc_meta,
                    "doc_index": i,
                    "chunk_index": chunk.index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                })
        elif body.chunking == "markdown_headers":
            chunks = chunk_markdown(doc, body.chunk_size, body.chunk_overlap)
            for chunk in chunks:
                all_chunks.append(chunk.text)
                all_metadata.append({
                    **doc_meta,
                    "doc_index": i,
                    "chunk_index": chunk.index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                })
        else:
            # "auto" or "text"
            chunks = chunk_text(doc, body.chunk_size, body.chunk_overlap)
            for chunk in chunks:
                all_chunks.append(chunk.text)
                all_metadata.append({
                    **doc_meta,
                    "doc_index": i,
                    "chunk_index": chunk.index,
                    "start_char": chunk.start_char,
                    "end_char": chunk.end_char,
                })

    if not all_chunks:
        return openai_error(
            status_code=400,
            message="No content after chunking (documents may be empty)",
            error_type="invalid_request_error",
            code="empty_content",
        )

    # Embed all chunks
    try:
        embeddings = await _embed_texts(
            all_chunks, body.model, embedding_engine, remote_client,
        )
    except RuntimeError as e:
        return internal_error(str(e))

    # Store
    doc_ids = store.add(body.collection, all_chunks, embeddings, all_metadata)

    # Auto-persist
    store.save()

    elapsed_ms = (time.monotonic() - start) * 1000

    logger.info("rag_ingest_complete", extra={
        "collection": body.collection,
        "documents": len(body.documents),
        "chunks": len(all_chunks),
        "duration_ms": round(elapsed_ms, 1),
    })

    return JSONResponse(content=IngestResponse(
        collection=body.collection,
        documents_ingested=len(body.documents),
        chunks_created=len(all_chunks),
        document_ids=doc_ids,
        duration_ms=round(elapsed_ms, 1),
    ).model_dump())


@router.post("/v1/rag/query", response_model=None)
async def query_collection(
    body: QueryRequest,
    embedding_engine: Embeddings,
    remote_client: RemoteEmbedding,
    rag_store: RagStore,
) -> Response:
    """Query a RAG collection for relevant context.

    Embeds the query, searches the vector store using cosine similarity,
    and returns the top matching document chunks.
    """
    store = _require_store(rag_store)
    start = time.monotonic()

    # Embed query
    try:
        query_embeddings = await _embed_texts(
            [body.query], body.model, embedding_engine, remote_client,
        )
    except RuntimeError as e:
        return internal_error(str(e))

    # Search
    results = store.search(
        collection=body.collection,
        query_embedding=query_embeddings[0],
        top_k=body.top_k,
        min_score=body.min_score,
        mode=body.search_mode,
        query_text=body.query,
    )

    elapsed_ms = (time.monotonic() - start) * 1000

    return JSONResponse(content=QueryResponse(
        collection=body.collection,
        query=body.query,
        results=[
            QueryResult(
                id=r.document.id,
                text=r.document.text,
                score=round(r.score, 4),
                metadata=r.document.metadata,
                embedding=r.document.embedding.tolist() if body.include_embeddings else None,
            )
            for r in results
        ],
        total_in_collection=store.collection_count(body.collection),
        duration_ms=round(elapsed_ms, 1),
    ).model_dump())


@router.post("/v1/rag/context", response_model=None)
async def assemble_context(
    body: ContextAssemblyRequest,
    embedding_engine: Embeddings,
    remote_client: RemoteEmbedding,
    rag_store: RagStore,
) -> Response:
    """Assemble RAG context from multiple collections.

    Searches across specified collections, deduplicates, ranks by
    relevance, and assembles a formatted context string ready for
    injection into a system or user prompt. Respects token budget.
    """
    store = _require_store(rag_store)
    start = time.monotonic()

    # Embed query once
    try:
        query_embeddings = await _embed_texts(
            [body.query], body.model, embedding_engine, remote_client,
        )
    except RuntimeError as e:
        return internal_error(str(e))

    # Search each collection
    all_results: list[tuple[str, Any]] = []  # (collection, SearchResult)
    for collection in body.collections:
        results = store.search(
            collection=collection,
            query_embedding=query_embeddings[0],
            top_k=body.top_k_per_collection,
            min_score=body.min_score,
        )
        for r in results:
            all_results.append((collection, r))

    # Sort by score descending (cross-collection ranking)
    all_results.sort(key=lambda x: x[1].score, reverse=True)

    # Assemble context within token budget (~4 chars/token)
    max_chars = body.max_context_tokens * 4
    context_parts: list[str] = []
    sources: list[dict[str, Any]] = []
    total_chars = 0

    for collection, result in all_results:
        chunk_text_str = result.document.text
        # Add header for context source
        header = f"[Source: {collection}"
        if result.document.metadata.get("source"):
            header += f" / {result.document.metadata['source']}"
        header += f" | relevance: {result.score:.2f}]"

        entry = f"{header}\n{chunk_text_str}"
        entry_chars = len(entry) + 2  # +2 for separators

        if total_chars + entry_chars > max_chars:
            break

        context_parts.append(entry)
        sources.append({
            "collection": collection,
            "id": result.document.id,
            "score": round(result.score, 4),
            "metadata": result.document.metadata,
        })
        total_chars += entry_chars

    context = "\n\n---\n\n".join(context_parts)
    estimated_tokens = max(1, len(context) // 4)
    elapsed_ms = (time.monotonic() - start) * 1000

    return JSONResponse(content=ContextAssemblyResponse(
        context=context,
        sources=sources,
        total_chunks=len(context_parts),
        estimated_tokens=estimated_tokens,
        duration_ms=round(elapsed_ms, 1),
    ).model_dump())


@router.get("/v1/rag/collections")
async def list_collections(rag_store: RagStore) -> StoreStatsResponse:
    """List all RAG collections and their statistics."""
    store = _require_store(rag_store)
    stats = store.get_stats()

    return StoreStatsResponse(
        total_documents=stats["total_documents"],
        collection_count=stats["collection_count"],
        collections=[
            CollectionInfo(
                name=name,
                document_count=info["document_count"],
                embedding_dimensions=info["embedding_dimensions"],
            )
            for name, info in stats["collections"].items()
        ],
    )


@router.delete("/v1/rag/collections/{collection}", response_model=None)
async def delete_collection(collection: str, _auth: AdminAuth, rag_store: RagStore) -> Response:
    """Delete a RAG collection and all its documents."""
    store = _require_store(rag_store)
    count = store.delete_collection(collection)
    store.save()

    if count == 0:
        return openai_error(
            status_code=404,
            message=f"Collection '{collection}' not found",
            error_type="invalid_request_error",
            code="collection_not_found",
        )

    return JSONResponse(content={
        "success": True,
        "collection": collection,
        "documents_deleted": count,
    })
