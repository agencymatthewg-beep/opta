"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { StepList } from "@/components/docs/StepList";
import { ApiEndpoint } from "@/components/docs/ApiEndpoint";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "loading-models", title: "Loading Models", level: 2 as const },
  { id: "via-api", title: "Via API", level: 3 as const },
  { id: "via-cli", title: "Via CLI", level: 3 as const },
  { id: "unloading-models", title: "Unloading Models", level: 2 as const },
  { id: "downloading-models", title: "Downloading Models", level: 2 as const },
  { id: "huggingface-hub", title: "HuggingFace Hub", level: 3 as const },
  { id: "model-formats", title: "Model Formats", level: 2 as const },
  { id: "mlx-native", title: "MLX Native", level: 3 as const },
  { id: "gguf-fallback", title: "GGUF Fallback", level: 3 as const },
  { id: "vram-estimation", title: "VRAM Estimation", level: 2 as const },
  { id: "oom-prevention", title: "OOM Prevention", level: 2 as const },
  { id: "recommended-models", title: "Recommended Models", level: 2 as const },
];

export default function LmxModelsPage() {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "LMX", href: "/docs/lmx/" },
          { label: "Model Management" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Model Management</h1>
          <p className="lead">
            LMX supports hot-swapping models without restarting the server. This page covers
            loading, unloading, downloading, and managing models on disk.
          </p>

          <h2 id="loading-models">Loading Models</h2>
          <p>
            LMX loads one model at a time into unified memory. When you load a new model, the
            previously loaded model is automatically unloaded first.
          </p>

          <h3 id="via-api">Via API</h3>
          <ApiEndpoint
            method="POST"
            path="/admin/models/load"
            description="Load a model into memory by HuggingFace identifier or local path."
            params={[
              { name: "model", type: "string", description: "HuggingFace model ID or local path", required: true },
            ]}
            response={`{
  "success": true,
  "model": "qwen3-30b-a3b",
  "load_time_ms": 2340,
  "vram_gb": 18.4
}`}
          />
          <CommandBlock
            command={`curl -X POST http://192.168.188.11:1234/admin/models/load \\
  -H "Content-Type: application/json" \\
  -d '{"model":"mlx-community/Qwen3-30B-A3B-4bit"}'`}
            description="Load a model via the API"
          />

          <h3 id="via-cli">Via CLI</h3>
          <p>
            The Opta CLI provides a convenient wrapper for model management:
          </p>
          <CommandBlock
            command="opta models load qwen3-30b-a3b"
            description="Load a model by alias"
            output={`Loading qwen3-30b-a3b...
Model loaded in 2.3s (18.4 GB VRAM)`}
          />
          <CommandBlock
            command="opta models list"
            description="List all available models"
            output={`  qwen3-30b-a3b       18.4 GB   MLX   ● loaded
  llama-3.3-70b       38.7 GB   MLX   ○ available
  deepseek-v3-0324    42.1 GB   MLX   ○ available
  nomic-embed-text     0.3 GB   MLX   ○ available`}
          />

          <h2 id="unloading-models">Unloading Models</h2>
          <p>
            Unloading a model frees its VRAM. After unloading, the <code>/readyz</code> endpoint
            returns <code>503</code> until a new model is loaded.
          </p>
          <TabGroup
            tabs={[
              {
                label: "API",
                content: (
                  <CommandBlock
                    command={`curl -X POST http://192.168.188.11:1234/admin/models/unload`}
                    output={`{"success":true,"freed_vram_gb":18.4}`}
                  />
                ),
              },
              {
                label: "CLI",
                content: (
                  <CommandBlock
                    command="opta models unload"
                    output={`Model unloaded. Freed 18.4 GB VRAM.`}
                  />
                ),
              },
            ]}
          />

          <h2 id="downloading-models">Downloading Models</h2>

          <h3 id="huggingface-hub">HuggingFace Hub</h3>
          <p>
            LMX downloads models from HuggingFace Hub on first load. Models are cached in the
            standard HuggingFace cache directory at <code>~/.cache/huggingface/hub/</code>.
          </p>
          <StepList
            steps={[
              {
                title: "Find a model on HuggingFace",
                description:
                  "Browse the mlx-community organization for pre-converted MLX models. Look for models with the '-4bit' suffix for 4-bit quantization.",
              },
              {
                title: "Load the model (triggers download)",
                content: (
                  <CommandBlock
                    command={`curl -X POST http://192.168.188.11:1234/admin/models/load \\
  -H "Content-Type: application/json" \\
  -d '{"model":"mlx-community/Llama-3.3-70B-Instruct-4bit"}'`}
                    description="First load will download the model"
                  />
                ),
              },
              {
                title: "Wait for download to complete",
                description:
                  "Large models (70B+) can take several minutes to download depending on your internet speed. The API blocks until the model is fully loaded.",
              },
            ]}
          />
          <Callout variant="tip" title="Pre-download models">
            You can pre-download models using the <code>huggingface-cli</code> tool to avoid waiting
            during load:
          </Callout>
          <CommandBlock
            command="huggingface-cli download mlx-community/Qwen3-30B-A3B-4bit"
            description="Pre-download a model to the local cache"
          />

          <h2 id="model-formats">Model Formats</h2>

          <h3 id="mlx-native">MLX Native</h3>
          <p>
            MLX-native models are the preferred format. They are pre-converted to MLX&apos;s internal
            representation and load directly into unified memory without conversion overhead.
          </p>
          <p>
            The <code>mlx-community</code> organization on HuggingFace maintains converted versions of
            popular models. Look for repositories with names like:
          </p>
          <ul>
            <li><code>mlx-community/Qwen3-30B-A3B-4bit</code></li>
            <li><code>mlx-community/Llama-3.3-70B-Instruct-4bit</code></li>
            <li><code>mlx-community/Mistral-Large-Instruct-2411-4bit</code></li>
          </ul>

          <h3 id="gguf-fallback">GGUF Fallback</h3>
          <p>
            When an MLX-native version is not available, LMX can load GGUF quantized models as a
            fallback. GGUF models are loaded through a compatibility layer, which adds slight overhead
            (10-20% slower than native MLX).
          </p>
          <Callout variant="info" title="Prefer MLX native">
            Always use MLX-native models when available. GGUF fallback exists for compatibility, but
            native MLX delivers 15-30% better performance on the same hardware.
          </Callout>

          <h2 id="vram-estimation">VRAM Estimation</h2>
          <p>
            Estimating VRAM requirements before loading a model helps prevent OOM conditions. Use
            this rule of thumb:
          </p>
          <CodeBlock
            language="text"
            code={`VRAM (GB) ≈ Parameters (B) × Bits / 8 × 1.2

Examples:
  7B  model @ 4-bit:   7 × 4 / 8 × 1.2 ≈   4.2 GB
  30B model @ 4-bit:  30 × 4 / 8 × 1.2 ≈  18.0 GB
  70B model @ 4-bit:  70 × 4 / 8 × 1.2 ≈  42.0 GB
 120B model @ 4-bit: 120 × 4 / 8 × 1.2 ≈  72.0 GB

The 1.2× multiplier accounts for KV cache and runtime overhead.`}
          />
          <p>
            Check your current VRAM usage via the admin API:
          </p>
          <CommandBlock
            command="curl http://192.168.188.11:1234/admin/models"
            output={`{"models":[{"id":"qwen3-30b-a3b","loaded":true,"vram_gb":18.4}]}`}
          />

          <h2 id="oom-prevention">OOM Prevention</h2>
          <p>
            LMX includes an OOM guardian that prevents crashes when memory pressure is too high. The
            guardian operates at two thresholds:
          </p>
          <ul>
            <li>
              <strong>Warning threshold (85% VRAM)</strong> — LMX logs a warning and emits a memory
              pressure event via the <code>/admin/events</code> SSE stream.
            </li>
            <li>
              <strong>Critical threshold (90% VRAM)</strong> — LMX automatically unloads the model to
              prevent the process from being killed by the OS. Subsequent inference requests return{" "}
              <code>503</code> with code <code>oom-unloaded</code>.
            </li>
          </ul>
          <Callout variant="danger" title="Never-crash guarantee">
            LMX must never crash on OOM. When the critical threshold is hit, the model is unloaded
            gracefully and the server continues running. Reload the model (or a smaller one) once
            memory is available.
          </Callout>
          <p>
            The thresholds are configurable in the LMX config file:
          </p>
          <CodeBlock
            language="toml"
            filename="config.toml"
            code={`[memory]
max_memory_pct = 85      # Warning threshold
oom_threshold_pct = 90   # Auto-unload threshold`}
          />

          <h2 id="recommended-models">Recommended Models</h2>
          <p>
            These models are tested and recommended for use with LMX on the Mac Studio M3 Ultra (192GB):
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Model</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">Params</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">VRAM</th>
                  <th className="text-left py-2 pr-4 text-text-muted font-medium">tok/s</th>
                  <th className="text-left py-2 text-text-muted font-medium">Use Case</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">Qwen3-30B-A3B</td>
                  <td className="py-2 pr-4 text-text-secondary">30B (3B active)</td>
                  <td className="py-2 pr-4 text-text-secondary">18 GB</td>
                  <td className="py-2 pr-4 text-text-secondary">~65</td>
                  <td className="py-2 text-text-secondary">Daily driver, fast MoE</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">Llama-3.3-70B</td>
                  <td className="py-2 pr-4 text-text-secondary">70B</td>
                  <td className="py-2 pr-4 text-text-secondary">39 GB</td>
                  <td className="py-2 pr-4 text-text-secondary">~25</td>
                  <td className="py-2 text-text-secondary">Code generation, analysis</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-2 pr-4 text-text-secondary">DeepSeek-V3-0324</td>
                  <td className="py-2 pr-4 text-text-secondary">685B MoE</td>
                  <td className="py-2 pr-4 text-text-secondary">~160 GB</td>
                  <td className="py-2 pr-4 text-text-secondary">~8</td>
                  <td className="py-2 text-text-secondary">Maximum quality reasoning</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-text-secondary">nomic-embed-text</td>
                  <td className="py-2 pr-4 text-text-secondary">137M</td>
                  <td className="py-2 pr-4 text-text-secondary">0.3 GB</td>
                  <td className="py-2 pr-4 text-text-secondary">n/a</td>
                  <td className="py-2 text-text-secondary">Embeddings for RAG</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Callout variant="tip" title="MoE models">
            Mixture-of-Experts (MoE) models like Qwen3-30B-A3B and DeepSeek-V3 only activate a
            fraction of their parameters per token, delivering much higher throughput relative to
            their total parameter count.
          </Callout>

          <PrevNextNav
            prev={{ title: "API Reference", href: "/docs/lmx/api/" }}
            next={{ title: "Monitoring", href: "/docs/lmx/monitoring/" }}
          />
        </div>
        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
