"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { ApiEndpoint } from "@/components/docs/ApiEndpoint";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "base-url", title: "Base URL", level: 2 as const },
  { id: "inference-endpoints", title: "Inference Endpoints", level: 2 as const },
  { id: "chat-completions", title: "Chat Completions", level: 3 as const },
  { id: "streaming-sse", title: "Streaming (SSE)", level: 3 as const },
  { id: "websocket-streaming", title: "WebSocket Streaming", level: 3 as const },
  { id: "embeddings", title: "Embeddings", level: 3 as const },
  { id: "reranking", title: "Reranking", level: 3 as const },
  { id: "health-endpoints", title: "Health Endpoints", level: 2 as const },
  { id: "admin-endpoints", title: "Admin Endpoints", level: 2 as const },
  { id: "list-models", title: "List Models", level: 3 as const },
  { id: "load-model", title: "Load Model", level: 3 as const },
  { id: "unload-model", title: "Unload Model", level: 3 as const },
  { id: "metrics-stream", title: "Metrics Stream", level: 3 as const },
  { id: "error-codes", title: "Error Codes", level: 2 as const },
];

export default function LmxApiPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "LMX", href: "/docs/lmx/" },
          { label: "API Reference" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>API Reference</h1>
          <p className="lead">
            LMX exposes an OpenAI-compatible API for inference alongside admin endpoints for model
            management and monitoring. All endpoints are unauthenticated on LAN.
          </p>

          <h2 id="base-url">Base URL</h2>
          <CodeBlock
            code="http://192.168.188.11:1234"
            language="text"
          />
          <p>
            When running locally on the Mac Studio, use <code>http://localhost:1234</code>. From
            other devices on the LAN, use the Mac Studio&apos;s IP address.
          </p>
          <Callout variant="info" title="No API key required">
            LMX does not enforce API key authentication on LAN. The <code>api_key</code> field in
            OpenAI client libraries can be set to any non-empty string.
          </Callout>

          <h2 id="inference-endpoints">Inference Endpoints</h2>

          <h3 id="chat-completions">Chat Completions</h3>
          <ApiEndpoint
            method="POST"
            path="/v1/chat/completions"
            description="Generate a chat completion. Supports both streaming (SSE) and non-streaming modes. Follows the OpenAI Chat Completions API spec."
            params={[
              { name: "model", type: "string", description: "Model identifier", required: true },
              { name: "messages", type: "Message[]", description: "Array of chat messages with role and content", required: true },
              { name: "stream", type: "boolean", description: "Enable SSE streaming (default: false)", required: false },
              { name: "temperature", type: "number", description: "Sampling temperature 0-2 (default: 0.7)", required: false },
              { name: "max_tokens", type: "number", description: "Maximum tokens to generate (default: 4096)", required: false },
              { name: "top_p", type: "number", description: "Nucleus sampling threshold (default: 1.0)", required: false },
              { name: "stop", type: "string[]", description: "Stop sequences", required: false },
            ]}
            response={`{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "model": "qwen3-30b-a3b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 12,
    "completion_tokens": 8,
    "total_tokens": 20
  }
}`}
          />

          <h3 id="streaming-sse">Streaming (SSE)</h3>
          <p>
            Set <code>stream: true</code> to receive Server-Sent Events. Each event is a JSON chunk
            following the OpenAI streaming format:
          </p>
          <CodeBlock
            language="text"
            filename="SSE response"
            code={`data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]`}
          />

          <h3 id="websocket-streaming">WebSocket Streaming</h3>
          <ApiEndpoint
            method="WS"
            path="/v1/chat/stream"
            description="Alternative streaming endpoint using WebSocket. Send the same request body as /v1/chat/completions. The server sends individual token messages followed by a final stats message."
          />
          <CodeBlock
            language="javascript"
            filename="ws-stream.js"
            code={`const ws = new WebSocket("ws://192.168.188.11:1234/v1/chat/stream");

ws.onopen = () => {
  ws.send(JSON.stringify({
    model: "qwen3-30b-a3b",
    messages: [{ role: "user", content: "Hello" }]
  }));
};

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.token) {
    process.stdout.write(data.token);
  } else if (data.done) {
    console.log("\\nTokens/s:", data.stats.tokens_per_second);
    ws.close();
  }
};`}
          />

          <h3 id="embeddings">Embeddings</h3>
          <ApiEndpoint
            method="POST"
            path="/v1/embeddings"
            description="Generate embeddings for the given input text. Uses the currently loaded embedding model."
            params={[
              { name: "model", type: "string", description: "Embedding model identifier", required: true },
              { name: "input", type: "string | string[]", description: "Text to embed (single string or array)", required: true },
            ]}
            response={`{
  "object": "list",
  "data": [{
    "object": "embedding",
    "index": 0,
    "embedding": [0.0012, -0.0034, 0.0056, ...]
  }],
  "model": "nomic-embed-text",
  "usage": { "prompt_tokens": 5, "total_tokens": 5 }
}`}
          />

          <h3 id="reranking">Reranking</h3>
          <ApiEndpoint
            method="POST"
            path="/v1/rerank"
            description="Rerank a list of documents against a query. Returns documents sorted by relevance score."
            params={[
              { name: "model", type: "string", description: "Reranker model identifier", required: true },
              { name: "query", type: "string", description: "The query to rank against", required: true },
              { name: "documents", type: "string[]", description: "Documents to rerank", required: true },
              { name: "top_n", type: "number", description: "Return only the top N results", required: false },
            ]}
            response={`{
  "results": [
    { "index": 2, "relevance_score": 0.95, "document": "..." },
    { "index": 0, "relevance_score": 0.72, "document": "..." },
    { "index": 1, "relevance_score": 0.31, "document": "..." }
  ]
}`}
          />

          <h2 id="health-endpoints">Health Endpoints</h2>

          <ApiEndpoint
            method="GET"
            path="/healthz"
            description="Liveness probe. Returns 200 if the LMX process is running, regardless of whether a model is loaded."
            response={`{"status":"ok"}`}
          />

          <ApiEndpoint
            method="GET"
            path="/readyz"
            description="Readiness probe. Returns 200 only if a model is loaded and ready for inference. Returns 503 if no model is loaded."
          />

          <TabGroup
            tabs={[
              {
                label: "Ready",
                content: (
                  <CodeBlock
                    language="json"
                    code={`{"ready":true,"model":"qwen3-30b-a3b","vram_gb":18.4}`}
                  />
                ),
              },
              {
                label: "Not Ready",
                content: (
                  <CodeBlock
                    language="json"
                    code={`{"ready":false,"error":"no-model-loaded"}`}
                  />
                ),
              },
            ]}
          />

          <h2 id="admin-endpoints">Admin Endpoints</h2>

          <h3 id="list-models">List Models</h3>
          <ApiEndpoint
            method="GET"
            path="/admin/models"
            description="Returns all available models on disk, with their load status and size information."
            response={`{
  "models": [
    {
      "id": "qwen3-30b-a3b",
      "path": "mlx-community/Qwen3-30B-A3B-4bit",
      "loaded": true,
      "vram_gb": 18.4,
      "format": "mlx"
    },
    {
      "id": "llama-3.3-70b",
      "path": "mlx-community/Llama-3.3-70B-Instruct-4bit",
      "loaded": false,
      "vram_gb": null,
      "format": "mlx"
    }
  ]
}`}
          />

          <h3 id="load-model">Load Model</h3>
          <ApiEndpoint
            method="POST"
            path="/admin/models/load"
            description="Loads a model into memory. If another model is currently loaded, it is unloaded first. Returns the load time and VRAM usage."
            params={[
              { name: "model", type: "string", description: "Model path or HuggingFace identifier", required: true },
            ]}
            response={`{
  "success": true,
  "model": "llama-3.3-70b",
  "load_time_ms": 4200,
  "vram_gb": 38.7
}`}
          />

          <h3 id="unload-model">Unload Model</h3>
          <ApiEndpoint
            method="POST"
            path="/admin/models/unload"
            description="Unloads the currently loaded model, freeing VRAM. After unloading, /readyz will return 503 until a new model is loaded."
            response={`{
  "success": true,
  "freed_vram_gb": 18.4
}`}
          />

          <h3 id="metrics-stream">Metrics Stream</h3>
          <ApiEndpoint
            method="GET"
            path="/admin/events"
            description="Server-Sent Events stream of real-time metrics. Emits throughput, VRAM usage, and inference status events. Used by the Opta Local Web dashboard for live monitoring."
          />
          <CodeBlock
            language="text"
            filename="SSE metrics"
            code={`data: {"type":"throughput","tokens_per_second":45.2,"active_requests":1}

data: {"type":"memory","vram_used_gb":18.4,"vram_total_gb":192.0,"pct":9.6}

data: {"type":"heartbeat","uptime":3600}`}
          />

          <h2 id="error-codes">Error Codes</h2>
          <p>
            LMX returns standard HTTP status codes with a JSON error body:
          </p>
          <CodeBlock
            language="json"
            code={`{
  "error": {
    "code": "no-model-loaded",
    "message": "No model is currently loaded. Call POST /admin/models/load first."
  }
}`}
          />
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Code</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">HTTP</th>
                  <th className="text-left py-2 text-text-muted font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">no-model-loaded</code></td>
                  <td className="py-2 pr-4 text-text-secondary">503</td>
                  <td className="py-2 text-text-secondary">No model in memory. Load one first.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">model-not-found</code></td>
                  <td className="py-2 pr-4 text-text-secondary">404</td>
                  <td className="py-2 text-text-secondary">Requested model not found on disk.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">storage-full</code></td>
                  <td className="py-2 pr-4 text-text-secondary">507</td>
                  <td className="py-2 text-text-secondary">Insufficient disk space for model download.</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">lmx-timeout</code></td>
                  <td className="py-2 pr-4 text-text-secondary">504</td>
                  <td className="py-2 text-text-secondary">Inference timed out (model took too long).</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">oom-unloaded</code></td>
                  <td className="py-2 pr-4 text-text-secondary">503</td>
                  <td className="py-2 text-text-secondary">Model was unloaded due to OOM pressure.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4"><code className="text-neon-cyan text-xs">invalid-request</code></td>
                  <td className="py-2 pr-4 text-text-secondary">400</td>
                  <td className="py-2 text-text-secondary">Malformed request body or missing fields.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <PrevNextNav
            prev={{ title: "Setup", href: "/docs/lmx/setup/" }}
            next={{ title: "Model Management", href: "/docs/lmx/models/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
