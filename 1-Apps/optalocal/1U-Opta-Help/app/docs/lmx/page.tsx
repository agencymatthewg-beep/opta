"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";

const tocItems = [
  { id: "what-is-lmx", title: "What Is LMX", level: 2 as const },
  { id: "why-mlx-native", title: "Why MLX Native", level: 2 as const },
  { id: "openai-compatibility", title: "OpenAI Compatibility", level: 2 as const },
  { id: "core-capabilities", title: "Core Capabilities", level: 2 as const },
  { id: "never-crash-guarantee", title: "Never-Crash Guarantee", level: 3 as const },
  { id: "architecture", title: "Architecture", level: 2 as const },
  { id: "drop-in-replacement", title: "Drop-In Replacement", level: 2 as const },
  { id: "quick-start", title: "Quick Start", level: 2 as const },
];

export default function LmxOverviewPage() {
  const { prev, next } = getPrevNext("/docs/lmx/");

  return (
    <>
      <Breadcrumb items={[{ label: "LMX", href: "/docs/lmx/" }, { label: "Overview" }]} />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>LMX Overview</h1>
          <p className="lead">
            Opta LMX is an MLX-native inference server built for Apple Silicon. It delivers
            OpenAI-compatible APIs for local model inference, running entirely on your Mac
            Studio&apos;s unified memory with no cloud dependency.
          </p>

          <h2 id="what-is-lmx">What Is LMX</h2>
          <p>
            LMX (Local Model eXecution) is a headless Python daemon that loads large language models
            into Apple Silicon unified memory using the{" "}
            <a href="https://github.com/ml-explore/mlx" target="_blank" rel="noopener noreferrer">
              MLX framework
            </a>
            . It exposes an OpenAI-compatible HTTP API on port 1234, making it a drop-in replacement
            for LM Studio, Ollama, or any other local inference server.
          </p>
          <p>
            LMX is designed to run 24/7 on a dedicated Apple Silicon machine (recommended: Mac Studio
            with M3 Ultra and 192GB unified memory). The Opta CLI daemon connects to LMX over LAN to
            perform inference.
          </p>

          <h2 id="why-mlx-native">Why MLX Native</h2>
          <p>
            Most local inference tools use GGUF quantized models through llama.cpp. LMX uses Apple&apos;s
            MLX framework directly, which provides significant advantages on Apple Silicon:
          </p>
          <ul>
            <li>
              <strong>15-30% faster inference</strong> compared to GGUF on the same hardware, because
              MLX uses the GPU and Neural Engine natively without translation layers.
            </li>
            <li>
              <strong>Unified memory efficiency</strong> — MLX models sit directly in unified memory
              shared by CPU and GPU, avoiding data copies.
            </li>
            <li>
              <strong>Native Metal acceleration</strong> — All matrix operations run on Metal shaders
              optimized for Apple GPU architectures.
            </li>
            <li>
              <strong>GGUF fallback</strong> — LMX can still load GGUF models when an MLX-native
              variant is not available, so you are never locked out of a model.
            </li>
          </ul>

          <h2 id="openai-compatibility">OpenAI Compatibility</h2>
          <p>
            LMX implements the OpenAI Chat Completions API spec. Any tool that supports a custom
            OpenAI base URL works with LMX out of the box:
          </p>
          <CodeBlock
            language="python"
            code={`from openai import OpenAI

client = OpenAI(
    base_url="http://192.168.188.11:1234/v1",
    api_key="not-needed"  # LMX does not require API keys on LAN
)

response = client.chat.completions.create(
    model="qwen3-30b-a3b",
    messages=[{"role": "user", "content": "Hello"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")`}
          />

          <h2 id="core-capabilities">Core Capabilities</h2>
          <p>
            LMX provides 12 non-negotiable capabilities that define its operational contract:
          </p>
          <ul>
            <li><strong>Streaming inference</strong> — Server-Sent Events (SSE) for real-time token streaming</li>
            <li><strong>WebSocket streaming</strong> — Alternative low-latency streaming via WebSocket</li>
            <li><strong>Model hot-swap</strong> — Load and unload models without restarting the server</li>
            <li><strong>Multi-model inventory</strong> — Scan and list all available models on disk</li>
            <li><strong>Health probes</strong> — Separate liveness (<code>/healthz</code>) and readiness (<code>/readyz</code>) endpoints</li>
            <li><strong>Admin API</strong> — Model management, metrics, and configuration endpoints</li>
            <li><strong>SSE metrics stream</strong> — Real-time throughput and VRAM telemetry via <code>/admin/events</code></li>
            <li><strong>Embedding generation</strong> — <code>/v1/embeddings</code> for RAG and semantic search</li>
            <li><strong>Reranking</strong> — <code>/v1/rerank</code> for search result reranking</li>
            <li><strong>Agent skills</strong> — Registered tool functions callable by models</li>
            <li><strong>Graceful degradation</strong> — Auto-unload on OOM instead of crashing</li>
            <li><strong>Launchd integration</strong> — Runs as a macOS service with auto-restart</li>
          </ul>

          <h3 id="never-crash-guarantee">Never-Crash Guarantee</h3>
          <Callout variant="warning" title="OOM protection">
            LMX must never crash on out-of-memory conditions. When VRAM is exhausted, LMX
            automatically unloads the current model and returns a{" "}
            <code>503 Service Unavailable</code> with a{" "}
            <code>no-model-loaded</code> error code. The model can be reloaded once memory is
            available.
          </Callout>

          <h2 id="architecture">Architecture</h2>
          <p>
            LMX is a FastAPI application with an MLX inference backend. It runs on the Mac Studio and
            listens on all interfaces (<code>0.0.0.0:1234</code>) to accept connections from any
            device on the LAN.
          </p>
          <CodeBlock
            language="text"
            code={`┌─────────────────────────────────────────┐
│  Opta LMX (192.168.188.11:1234)         │
│                                          │
│  FastAPI Server                          │
│  ├── /v1/chat/completions  (inference)   │
│  ├── /v1/embeddings        (embedding)   │
│  ├── /v1/rerank            (reranking)   │
│  ├── /healthz              (liveness)    │
│  ├── /readyz               (readiness)   │
│  └── /admin/*              (management)  │
│                                          │
│  MLX Inference Engine                    │
│  ├── Model loader (MLX native + GGUF)    │
│  ├── Streaming tokenizer                 │
│  ├── VRAM monitor                        │
│  └── OOM guardian                        │
│                                          │
│  Apple Silicon Hardware                  │
│  └── M3 Ultra / 192GB unified memory     │
└─────────────────────────────────────────┘`}
          />

          <h2 id="drop-in-replacement">Drop-In Replacement</h2>
          <p>
            LMX intentionally listens on port 1234 — the same default port as LM Studio. This makes
            it a seamless replacement for any workflow that already targets a local OpenAI-compatible
            server. Point your tools at <code>http://192.168.188.11:1234/v1</code> and they will work
            without configuration changes.
          </p>
          <Callout variant="tip" title="No API key required">
            LMX does not require API keys for LAN connections. The <code>api_key</code> parameter is
            accepted but ignored. This simplifies setup for local-only deployments.
          </Callout>

          <h2 id="quick-start">Quick Start</h2>
          <p>
            Verify that LMX is running and a model is loaded:
          </p>
          <CommandBlock
            command="curl http://192.168.188.11:1234/healthz"
            description="Check LMX is alive"
            output={`{"status":"ok"}`}
          />
          <CommandBlock
            command="curl http://192.168.188.11:1234/readyz"
            description="Check a model is loaded and ready"
            output={`{"ready":true,"model":"qwen3-30b-a3b"}`}
          />
          <p>
            Send a test completion:
          </p>
          <CommandBlock
            command={`curl http://192.168.188.11:1234/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{"model":"qwen3-30b-a3b","messages":[{"role":"user","content":"Hello"}]}'`}
            description="Send a non-streaming chat completion"
          />
          <p>
            See the <a href="/docs/lmx/setup/">Setup</a> page for full installation and
            configuration instructions.
          </p>

          <PrevNextNav prev={prev} next={next} />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
