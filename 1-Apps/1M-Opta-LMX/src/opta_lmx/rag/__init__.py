"""RAG (Retrieval-Augmented Generation) pipeline for Opta-LMX.

Submodules:
- store: FAISS-accelerated vector store with hybrid search
- bm25: BM25 keyword search index and Reciprocal Rank Fusion
- chunker: Token-aware text/code chunking
- processors: Document processors for PDF, Markdown, HTML, code
"""
