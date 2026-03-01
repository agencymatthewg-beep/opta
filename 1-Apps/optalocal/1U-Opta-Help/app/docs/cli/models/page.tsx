"use client";

import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrevNextNav } from "@/components/docs/PrevNextNav";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { getPrevNext } from "@/lib/content";
import { CommandBlock } from "@/components/docs/CommandBlock";
import { Callout } from "@/components/docs/Callout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { TabGroup } from "@/components/docs/TabGroup";

const tocItems = [
  { id: "overview", title: "Overview", level: 2 as const },
  { id: "listing-models", title: "Listing Models", level: 2 as const },
  { id: "loading-models", title: "Loading Models", level: 2 as const },
  { id: "swapping-models", title: "Swapping Models", level: 2 as const },
  { id: "browsing-library", title: "Browsing the Library", level: 2 as const },
  { id: "model-dashboard", title: "Model Dashboard", level: 2 as const },
  { id: "model-aliases", title: "Model Aliases", level: 2 as const },
  { id: "fallback-chain", title: "Fallback Chain", level: 2 as const },
];

export default function ModelsPage() {
  const { prev, next } = getPrevNext("/docs/cli/models/");

  return (
    <>
      <Breadcrumb
        items={[
          { label: "CLI Reference", href: "/docs/cli/" },
          { label: "Model Management" },
        ]}
      />

      <div className="flex gap-10">
        <div className="flex-1 min-w-0 prose-opta">
          <h1>Model Management</h1>
          <p className="lead">
            Manage the models running on your LMX inference server. Load, swap,
            browse, and monitor models directly from the CLI.
          </p>

          <h2 id="overview">Overview</h2>
          <p>
            The <code>opta models</code> command group lets you control which
            models are loaded on your LMX server, view VRAM usage and throughput
            metrics, browse available models from HuggingFace, and configure
            model aliases for quick access. All model operations communicate
            with the LMX server over your LAN.
          </p>

          <CommandBlock
            command="opta models"
            output={`Currently loaded:
  qwen3-30b-a3b (4-bit, 18.2 GB VRAM)

Available commands:
  opta models load <name>     Load a model
  opta models swap <name>     Unload current, load new
  opta models browse-library  Browse HuggingFace models
  opta models dashboard       Live VRAM and throughput view`}
            description="Show current model status"
          />

          <h2 id="listing-models">Listing Models</h2>
          <p>
            Running <code>opta models</code> with no subcommand shows the
            currently loaded model, its quantization level, and VRAM usage. If no
            model is loaded, it shows available models that have been previously
            downloaded to the LMX server.
          </p>

          <CommandBlock
            command="opta models"
            description="Show loaded model and status"
          />

          <h2 id="loading-models">Loading Models</h2>
          <p>
            Use <code>opta models load</code> to load a model into memory. If
            the model has been previously downloaded, it loads from the local
            cache. If not, LMX downloads it from HuggingFace first.
          </p>

          <CommandBlock
            command="opta models load qwen3-30b-a3b"
            output="Loading qwen3-30b-a3b...\nModel loaded in 4.2s (18.2 GB VRAM)"
            description="Load a specific model"
          />

          <Callout variant="warning" title="VRAM management">
            Loading a model that exceeds available VRAM will cause LMX to
            automatically unload the current model first. LMX is designed to
            never crash on out-of-memory conditions -- it degrades gracefully by
            unloading models.
          </Callout>

          <h2 id="swapping-models">Swapping Models</h2>
          <p>
            <code>opta models swap</code> is a convenience command that unloads
            the current model and loads a new one in a single operation. This is
            the recommended way to switch between models during a session.
          </p>

          <CommandBlock
            command="opta models swap deepseek-r1-0528"
            output="Unloading qwen3-30b-a3b...\nLoading deepseek-r1-0528...\nModel swapped in 6.1s (42.8 GB VRAM)"
            description="Swap to a different model"
          />

          <h2 id="browsing-library">Browsing the Library</h2>
          <p>
            <code>opta models browse-library</code> opens an interactive TUI
            browser that lets you search HuggingFace for MLX-compatible models.
            You can filter by size, quantization, and task type, then download
            directly to your LMX server.
          </p>

          <CommandBlock
            command="opta models browse-library"
            description="Open the HuggingFace model browser"
          />

          <CodeBlock
            code={`HuggingFace Model Browser
━━━━━━━━━━━━━━━━━━━━━━━━
Search: coding models < 30GB

  Model                          Size    Quant   Downloads
  mlx-community/Qwen3-30B-A3B   18.2G   4-bit   12.4k
  mlx-community/DeepSeek-R1      42.8G   4-bit   8.7k
  mlx-community/Codestral-25.01  12.1G   4-bit   6.2k

[Enter] Download  [/] Search  [q] Quit`}
            filename="Model browser TUI"
          />

          <h2 id="model-dashboard">Model Dashboard</h2>
          <p>
            <code>opta models dashboard</code> opens a live terminal dashboard
            showing VRAM usage, throughput (tokens per second), and other
            performance metrics for the currently loaded model.
          </p>

          <CommandBlock
            command="opta models dashboard"
            description="Open live model performance dashboard"
          />

          <CodeBlock
            code={`Model: qwen3-30b-a3b (4-bit)
VRAM: 18.2 / 192.0 GB  [████░░░░░░░░░░░░] 9.5%
Throughput: 42.3 tok/s (avg over last 60s)
Requests: 1,247 total | 3 active
Uptime: 4h 23m`}
            filename="Dashboard output"
          />

          <h2 id="model-aliases">Model Aliases</h2>
          <p>
            Model aliases let you use short, memorable names instead of full
            model identifiers. Aliases are configured in your CLI config and
            resolve to full model names when used in commands.
          </p>

          <TabGroup
            tabs={[
              {
                label: "Built-in Aliases",
                content: (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Alias</th>
                          <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Resolves To</th>
                        </tr>
                      </thead>
                      <tbody className="text-text-secondary">
                        <tr className="border-b border-white/5">
                          <td className="px-4 py-2.5 font-mono text-xs">qwen</td>
                          <td className="px-4 py-2.5 font-mono text-xs">mlx-community/Qwen3-30B-A3B-MLX-4bit</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="px-4 py-2.5 font-mono text-xs">deepseek</td>
                          <td className="px-4 py-2.5 font-mono text-xs">mlx-community/DeepSeek-R1-0528-MLX-4bit</td>
                        </tr>
                        <tr className="border-b border-white/5 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-xs">codestral</td>
                          <td className="px-4 py-2.5 font-mono text-xs">mlx-community/Codestral-25.01-MLX-4bit</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ),
              },
              {
                label: "Custom Aliases",
                content: (
                  <div className="text-sm text-text-secondary space-y-3">
                    <p>
                      You can define custom aliases in your configuration file or
                      via the <code>opta config</code> command.
                    </p>
                    <CommandBlock
                      command='opta config set model.aliases.fast "mlx-community/Qwen3-8B-MLX-4bit"'
                      description="Create a custom alias"
                    />
                    <CommandBlock
                      command="opta models load fast"
                      description="Use the alias"
                    />
                  </div>
                ),
              },
            ]}
          />

          <h2 id="fallback-chain">Fallback Chain</h2>
          <p>
            Opta CLI uses a two-tier fallback chain for inference. It first
            attempts to use the local LMX server for fast, private inference. If
            LMX is unreachable or the request fails, it falls back to the
            Anthropic cloud API (if an API key is configured).
          </p>

          <CodeBlock
            code={`Request Flow:
1. LMX (local, 192.168.188.11:1234)
   ├─ Success → Use local response
   └─ Fail → Fallback to Anthropic
2. Anthropic (cloud, api.anthropic.com)
   ├─ Success → Use cloud response
   └─ Fail → Error reported to user`}
            filename="Inference fallback chain"
          />

          <Callout variant="tip" title="Staying local">
            If you want to ensure all inference stays on your local network, run{" "}
            <code>opta config set provider.fallback false</code> to disable the
            cloud fallback. The CLI will return an error if LMX is unavailable
            instead of falling back to Anthropic.
          </Callout>

          <PrevNextNav prev={prev} next={next} />
        </div>

        <TableOfContents items={tocItems} />
      </div>
    </>
  );
}
