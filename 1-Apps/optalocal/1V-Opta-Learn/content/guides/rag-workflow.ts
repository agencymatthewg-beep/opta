import type { Guide } from './index';

export const ragWorkflowGuide: Guide = {
  slug: 'rag-workflow',
  title: "Building a Knowledge Base with RAG",
  app: 'lmx',
  category: 'feature',
  template: 'process-workflow',
  summary: "A step-by-step guide to building a local Retrieval-Augmented Generation (RAG) knowledge base using Opta LMX — ingest documents, run semantic search, and ground your LLM responses in private data.",
  tags: ["lmx", "rag", "knowledge-base", "vector-search", "embeddings", "retrieval", "semantic-search"],
  updatedAt: '2026-03-05',
  sections: [
    {
      heading: "Prerequisites",
      body: `Before starting, ensure the following are in place:<br><br>
<ul>
  <li><strong><a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> is running</strong> — confirm by visiting <code>http://192.168.188.11:1234/healthz</code> in your browser or running <code>curl http://192.168.188.11:1234/healthz</code>.</li>
  <li><strong>An embedding model is loaded</strong> — RAG requires an embedding model to be available in LMX. Check <code>GET /v1/models</code> for a model with type <code>embedding</code>. If none is loaded, load one via the <a href="/guides/lmx" class="app-link link-lmx">LMX Dashboard</a> → Models → Load.</li>
  <li><strong>Your documents are ready</strong> — plain text, markdown, or raw prose works best. PDFs should be converted to text first.</li>
</ul>`,
      note: `RAG collections are stored in a local vector database managed by LMX. Collection data persists across LMX restarts and is stored in <code>~/.opta-lmx/rag/</code> on the inference host.`,
    },
    {
      heading: "Step 1 — Create a Collection and Ingest Documents",
      body: `Collections are logical namespaces for document groups. Create and populate a collection with the <code>/v1/rag/ingest</code> endpoint:`,
      code: `# Ingest a document into a new or existing collection
curl -X POST http://192.168.188.11:1234/v1/rag/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "collection": "engineering-docs",
    "documents": [
      "# Architecture Overview\\nThe system uses an event-driven microservices model.\\n...",
      "# API Reference\\nAll endpoints accept JSON and return JSON.\\n..."
    ],
    "chunking": "auto"
  }'

# Response
# {
#   "documents_ingested": 2,
#   "chunks_created": 14,
#   "duration_ms": 312
# }`,
      note: `<code>chunking: "auto"</code> splits each document into semantically-coherent segments optimised for retrieval. Alternatively, set <code>chunking: "none"</code> to store each document as a single vector (useful for short snippets or Q&A pairs).`,
    },
    {
      heading: "Step 2 — Run a Semantic Search Query",
      body: `With documents ingested, query the collection to find the most relevant chunks for any natural language question:`,
      code: `# Query the collection
curl -X POST http://192.168.188.11:1234/v1/rag/query \\
  -H "Content-Type: application/json" \\
  -d '{
    "collection": "engineering-docs",
    "query": "How does the event system work?",
    "top_k": 5,
    "rerank": true
  }'

# Response
# {
#   "results": [
#     { "text": "The event-driven model uses…", "score": 0.921 },
#     { "text": "Events are dispatched via…", "score": 0.887 }
#   ]
# }`,
    },
    {
      heading: "Step 3 — Ground LLM Responses with Retrieved Context",
      body: `Combine the retrieved chunks with a chat completion request to anchor the model's answer in your private documents. This is the core RAG loop:<br><br>
<ol>
  <li>Query the RAG index for relevant chunks about the user's question.</li>
  <li>Prepend those chunks as a <code>system</code> message block.</li>
  <li>Send the augmented messages array to <code>/v1/chat/completions</code>.</li>
</ol>`,
      code: `# Full RAG-augmented completion (using curl as illustration)
QUERY="How does the event system work?"

# 1. Get context
CONTEXT=$(curl -s -X POST http://192.168.188.11:1234/v1/rag/query \\
  -H "Content-Type: application/json" \\
  -d "{\"collection\":\"engineering-docs\",\"query\":\"$QUERY\",\"top_k\":3}" \\
  | jq -r '[.results[].text] | join("\\n---\\n")')

# 2. Augmented completion
curl -X POST http://192.168.188.11:1234/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d "{
    \"model\": \"mlx/mistral\",
    \"messages\": [
      {\"role\": \"system\", \"content\": \"Use the following context to answer accurately:\\n$CONTEXT\"},
      {\"role\": \"user\",   \"content\": \"$QUERY\"}
    ]
  }"`,
      note: `The <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> handles this RAG loop automatically when you run <code>opta do "…" --rag engineering-docs</code>. Manual orchestration is only needed for custom integrations.`,
    },
    {
      heading: "Verification — Confirming Your Knowledge Base Is Operational",
      body: `After ingesting documents and running queries, verify the state of your collection via the admin API:`,
      code: `# List all RAG collections
curl http://192.168.188.11:1234/v1/rag/collections

# Response
# {
#   "collections": [
#     {
#       "name": "engineering-docs",
#       "document_count": 2,
#       "chunk_count": 14,
#       "embedding_dimensions": 1536
#     }
#   ]
# }

# Delete a collection (irreversible)
curl -X DELETE http://192.168.188.11:1234/v1/rag/collections/engineering-docs`,
      note: `Monitor your collection sizes from the <a href="/guides/lmx" class="app-link link-lmx">LMX Dashboard</a> → Knowledge Base. Collections that grow very large (50k+ chunks) may benefit from a rerank strategy (<code>"rerank": true</code>) to improve retrieval accuracy at a modest latency cost.`,
    },
  ],
};
