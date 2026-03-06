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
      heading: "[Setup] Prerequisites",
      body: `Before starting, ensure the following are in place:<br><br>
<ul>
  <li><strong><a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> is running</strong> — confirm by visiting <code>http://192.168.188.11:1234/healthz</code> in your browser or running <code>curl http://192.168.188.11:1234/healthz</code>.</li>
  <li><strong>An embedding model is loaded</strong> — RAG requires an embedding model to be available in LMX. Check <code>GET /v1/models</code> for a model with type <code>embedding</code>. If none is loaded, load one via the <a href="/guides/lmx" class="app-link link-lmx">LMX Dashboard</a> → Models → Load.</li>
  <li><strong>Your documents are ready</strong> — plain text, markdown, or raw prose works best. PDFs should be converted to text first.</li>
</ul>`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">LMX healthy</div>
      <div class="mt-2 text-text-secondary"><code>/healthz</code> returns ready</div>
    </div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Embedding model</div>
      <div class="mt-2 text-text-secondary">present in <code>/v1/models</code></div>
    </div>
    <div class="rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-3">
      <div class="text-[#93c5fd] uppercase tracking-wider">Docs prepared</div>
      <div class="mt-2 text-text-secondary">text-first input format</div>
    </div>
  </div>
</div>`,
      note: `RAG collections are stored in a local vector database managed by LMX. Collection data persists across LMX restarts and is stored in <code>~/.opta-lmx/rag/</code> on the inference host.`,
    },
    {
      heading: "[Configuration] Step 1 — Create a Collection and Ingest Documents",
      body: `Collections are logical namespaces for document groups. Create and populate a collection with the <code>/v1/rag/ingest</code> endpoint:`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">Ingest contract</div>
      <div class="mt-2 text-text-secondary">collection + documents + chunking mode</div>
    </div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Expected output</div>
      <div class="mt-2 text-text-secondary">documents_ingested + chunks_created + duration_ms</div>
    </div>
  </div>
</div>`,
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
      heading: "[Operation] Step 2 — Run a Semantic Search Query",
      body: `With documents ingested, query the collection to find the most relevant chunks for any natural language question:`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="flex flex-wrap items-center gap-2 text-xs font-mono">
    <span class="px-2 py-1 rounded bg-[#14532d] text-[#bbf7d0]">Query</span>
    <span class="text-[#52525b]">→</span>
    <span class="px-2 py-1 rounded bg-[#1f2937] text-[#93c5fd]">Embedding</span>
    <span class="text-[#52525b]">→</span>
    <span class="px-2 py-1 rounded bg-[#312e81] text-[#c4b5fd]">Vector Similarity</span>
    <span class="text-[#52525b]">→</span>
    <span class="px-2 py-1 rounded bg-[#27272a] text-[#e4e4e7]">Top-k Context</span>
  </div>
  <p class="mt-3 text-xs text-[#a1a1aa]">LMX retrieves the highest-similarity chunks, then optional reranking reorders them before grounding the completion prompt.</p>
</div>`,
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
      heading: "[Troubleshooting] Step 3 — Ground LLM Responses with Retrieved Context",
      body: `Combine the retrieved chunks with a chat completion request to anchor the model's answer in your private documents. This is the core RAG loop:<br><br>
<ol>
  <li>Query the RAG index for relevant chunks about the user's question.</li>
  <li>Prepend those chunks as a <code>system</code> message block.</li>
  <li>Send the augmented messages array to <code>/v1/chat/completions</code>.</li>
</ol>`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">1. retrieve top-k chunks</div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">2. prepend as system context</div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3 text-[#86efac]">3. generate grounded answer</div>
  </div>
</div>`,
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
      heading: "[Optimization] Verification — Confirming Your Knowledge Base Is Operational",
      body: `After ingesting documents and running queries, verify the state of your collection via the admin API:`,
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 p-3">
      <div class="text-[#67e8f9] uppercase tracking-wider">Collection count</div>
      <div class="mt-2 text-white">name + document_count</div>
    </div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Chunk scale</div>
      <div class="mt-2 text-white">chunk_count + dimensions</div>
    </div>
    <div class="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3">
      <div class="text-[#fdba74] uppercase tracking-wider">Lifecycle action</div>
      <div class="mt-2 text-white">delete only when intentional</div>
    </div>
  </div>
</div>`,
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
