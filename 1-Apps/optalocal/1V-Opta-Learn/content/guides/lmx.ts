import type { Guide } from './index';

export const lmxOverview: Guide = {
  slug: 'lmx',
  title: 'LMX Masterclass',
  app: 'lmx',
  category: 'reference',
  summary:
    'The comprehensive, objective guide to the Local Model eXecution engine. Understand its architecture, performance benchmarks, tradeoffs, and workflows.',
  tags: ['lmx', 'daemon', 'inference', 'models', 'server', 'masterclass', 'architecture', 'benchmarks'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'Ecosystem Role',
      body: `
        <p><span class="text-opta">Opta</span> LMX is the local inference engine that powers the Opta ecosystem. It operates entirely as a headless background daemon, designed to provide programmatic access to local large language models without requiring a graphical user interface (GUI).</p>
        <p>While the platform is typically bootstrapped using <a href="/guides/init" class="app-link link-init">Opta Init</a>, LMX handles the underlying compute. When issuing agentic commands via the <a href="/guides/cli" class="app-link link-cli">Opta CLI</a>, visualizing system health via the <a href="/guides/dashboard" class="app-link link-dashboard">Opta Local Dashboard</a>, or managing configurations with <a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a>, these applications are acting as clients making API requests to the LMX daemon.</p>
      `,
    },
    {
      heading: 'The Competitive Landscape',
      body: `
        <p>The local AI execution space contains several mature tools. LMX was engineered specifically for programmatic autonomy on Apple Silicon, but evaluating the right tool requires an objective look at the pros and cons of the major engines.</p>
        
        <div class="mt-6 space-y-8">
          <div class="obsidian p-6 rounded-xl border border-white/5">
            <h3 class="text-lg font-semibold text-text_primary mb-2">LM Studio</h3>
            <p class="text-sm text-text_secondary mb-4">A desktop application providing a comprehensive GUI for discovering, downloading, and chatting with local models.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong class="text-neon-green block mb-1">Pros</strong><ul class="list-disc pl-4 text-text_secondary space-y-1"><li>Excellent visual interface for beginners.</li><li>Built-in HuggingFace model browser.</li></ul></div>
              <div><strong class="text-amber-500 block mb-1">Cons</strong><ul class="list-disc pl-4 text-text_secondary space-y-1"><li>GUI-dependent; difficult to run cleanly as a headless daemon.</li><li>Bundles its own C++ engine, delaying support for new model architectures until a GUI update is released.</li><li>Cannot be fully operated autonomously by bots.</li></ul></div>
            </div>
          </div>

          <div class="obsidian p-6 rounded-xl border border-white/5">
            <h3 class="text-lg font-semibold text-text_primary mb-2">Ollama</h3>
            <p class="text-sm text-text_secondary mb-4">A lightweight, developer-focused CLI and background service for running local models.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong class="text-neon-green block mb-1">Pros</strong><ul class="list-disc pl-4 text-text_secondary space-y-1"><li>Industry-leading developer experience.</li><li>Massive, highly curated community model registry.</li></ul></div>
              <div><strong class="text-amber-500 block mb-1">Cons</strong><ul class="list-disc pl-4 text-text_secondary space-y-1"><li>Written primarily in Go/C++, which can historically lag slightly behind Apple's native Python MLX framework for maximum zero-copy memory optimization on Mac.</li></ul></div>
            </div>
          </div>

          <div class="obsidian p-6 rounded-xl border border-violet/30 bg-violet/5">
            <h3 class="text-lg font-semibold text-text_primary mb-2"><span class="text-opta">Opta</span> LMX</h3>
            <p class="text-sm text-text_secondary mb-4">A headless daemon built specifically for automated, agentic workflows on Apple Silicon.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong class="text-neon-green block mb-1">Pros</strong><ul class="list-disc pl-4 text-text_secondary space-y-1"><li>Built natively on Apple's MLX framework for strict zero-copy unified memory performance (15-30% faster).</li><li>Exposes a comprehensive Admin API, allowing bots to programmatically manage models without human input.</li><li>Day-zero support for new model architectures via Python updates.</li></ul></div>
              <div><strong class="text-amber-500 block mb-1">Cons</strong><ul class="list-disc pl-4 text-text_secondary space-y-1"><li>Platform-locked to macOS (Apple Silicon only).</li><li>No built-in graphical chat interface; relies entirely on external clients.</li></ul></div>
            </div>
          </div>
        </div>
      `,
    },
    {
      heading: 'Model Performance & Benchmarks',
      body: `
        <p>Through comprehensive lab benchmarking, we have vetted specific models and their quantizations to construct the <span class="text-opta">Opta</span> smart-routing alias chains. Here is what we found during our Apple Silicon evaluations (M3 Ultra):</p>
        
        <ul class="list-none pl-0 mt-6 space-y-6">
          <li>
            <div class="flex justify-between items-end mb-2">
              <strong class="text-text_primary">MiniMax-M2.5 (4-bit MLX)</strong>
              <span class="text-violet font-mono text-sm">112 tokens/sec</span>
            </div>
            <p class="text-sm text-text_secondary mb-3">Our primary multi-tier agent model. Exceptional tool-calling capabilities and speeds. At 4-bit quantization, it acts as the default fast router.</p>
            <div class="w-full bg-surface rounded-full h-2 overflow-hidden border border-white/5"><div class="bg-violet h-full rounded-full animate-bar" style="width: 100%"></div></div>
          </li>
          
          <li>
            <div class="flex justify-between items-end mb-2">
              <strong class="text-text_primary">Llama-3-8B-Instruct (4-bit MLX)</strong>
              <span class="text-violet font-mono text-sm">98 tokens/sec</span>
            </div>
            <p class="text-sm text-text_secondary mb-3">The industry standard for fast, raw instructional queries. Highly capable, but slightly less precise at multi-step XML tool parsing than MiniMax.</p>
            <div class="w-full bg-surface rounded-full h-2 overflow-hidden border border-white/5"><div class="bg-violet/80 h-full rounded-full animate-bar" style="width: 87%"></div></div>
          </li>
          
          <li>
            <div class="flex justify-between items-end mb-2">
              <strong class="text-text_primary">MiniMax-M2.5 (8-bit MLX)</strong>
              <span class="text-amber-500 font-mono text-sm">42 tokens/sec</span>
            </div>
            <p class="text-sm text-text_secondary mb-3">Used for the "Reasoning" tier. Slower generation, but significantly higher logic retention for complex coding refactors.</p>
            <div class="w-full bg-surface rounded-full h-2 overflow-hidden border border-white/5"><div class="bg-amber-500 h-full rounded-full animate-bar opacity-80" style="width: 37%"></div></div>
          </li>
        </ul>
      `,
      note: '<strong>The GGUF Fallback (GLM-5):</strong> Not all models have MLX-compiled weights on launch day. LMX includes an auto-detecting llama-cpp-python fallback engine, allowing us to still run massive bleeding-edge models like GLM-5 immediately via GGUF.',
    },
    {
      heading: 'Architecture & Memory',
      body: `
        <p>LMX handles memory allocation through a three-tier abstraction designed to prevent Out-Of-Memory (OOM) kernel panics. It dynamically monitors system limits and degrades performance safely when thresholds are met.</p>
        <ul class="list-none pl-0 mt-4 space-y-6">
          <li>
            <div class="text-violet font-semibold mb-1">Tier 1: Unified VRAM</div>
            The optimal tier. LMX attempts to map 100% of the model's weights directly into Apple Silicon's unified memory, leveraging zero-copy overhead for maximum throughput.
          </li>
          <li>
            <div class="text-amber-500 font-semibold mb-1">Tier 2: CPU Offload</div>
            If unified memory reaches critical capacity, LMX calculates the maximum number of transformer layers that can safely fit and spills the remainder to standard CPU processing. Inference speed decreases, but the daemon avoids crashing.
          </li>
          <li>
            <div class="text-text-muted font-semibold mb-1">Tier 3: Disk KV Swap</div>
            During massive document ingestion or highly extended contexts, the Key-Value (KV) cache grows linearly. LMX pages older contextual states to the local NVMe drive to preserve operational stability.
          </li>
        </ul>
      `,
    },
    {
      heading: 'Core Capabilities Deep-Dive',
      body: `
        <p>LMX provides specific infrastructure-level features required to run a multi-agent ecosystem:</p>
        <ul class="list-disc pl-6 mt-4 space-y-4">
          <li><strong>API Parity & Tool Pass-Through:</strong> LMX serves an OpenAI-compatible <code class="text-neon-green">/v1/chat/completions</code> endpoint. This ensures existing SDKs function normally, and standard JSON-based function/tool calling is passed through to the model natively.</li>
          <li><strong>Zero-Downtime Hot-Swaps:</strong> The server operates independently of its loaded weights. A client can issue an API command to switch from an 8B model to a 70B model. LMX unloads the current memory mapping and streams the new weights from disk while keeping the primary port listener alive.</li>
          <li><strong>Concurrent Request Queuing:</strong> If multiple automated scripts or bots send requests simultaneously, LMX queues the payloads and processes them sequentially (or via batched inference, depending on the active model constraints), returning HTTP 200 responses reliably instead of connection refusals.</li>
          <li><strong>Air-Gapped Telemetry:</strong> Performance logs, hardware introspection, and token-throughput analytics are written strictly to local disk. LMX contains no external telemetry or analytics dependencies.</li>
        </ul>
      `,
    },
    {
      heading: 'Integrated App Workflows',
      body: `
        <p>LMX is an unopinionated backend. While it can be queried via standard cURL or Python scripts, the true power of the engine unlocks when operating as part of the broader <span class="text-opta">Opta</span> Local ecosystem.</p>
        
        <div class="mt-6 space-y-6">
          <div class="flex items-start gap-4">
            <div class="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-500 font-bold text-sm">1</div>
            <div>
              <h3 class="text-lg font-semibold text-text_primary mb-1">Deployment via <a href="/guides/init" class="app-link link-init">Opta Init</a></h3>
              <p class="text-sm text-text_secondary leading-relaxed">Opta Init is responsible for bootstrapping the environment. It downloads the required Python dependencies, fetches the initial MLX weights from HuggingFace, and securely binds the LMX daemon to macOS <code class="bg-surface px-1 py-0.5 rounded border border-white/10">launchd</code> to ensure it runs automatically on system boot.</p>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="w-8 h-8 rounded-full bg-neon-green/10 border border-neon-green/30 flex items-center justify-center flex-shrink-0 text-neon-green font-bold text-sm">2</div>
            <div>
              <h3 class="text-lg font-semibold text-text_primary mb-1">Execution via <a href="/guides/cli" class="app-link link-cli">Opta CLI</a></h3>
              <p class="text-sm text-text_secondary leading-relaxed">The Opta CLI is your primary interface. It acts as the intelligent client wrapper around LMX. When you run <code class="text-neon-green bg-neon-green/10 px-1 py-0.5 rounded border border-neon-green/20">opta do "refactor this file"</code>, the CLI translates your intent, connects to the LMX Admin API to ensure the <code class="bg-surface px-1 py-0.5 rounded border border-white/10">code</code> alias model is loaded, and streams the completion back to your terminal.</p>
            </div>
          </div>

          <div class="flex items-start gap-4">
            <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">3</div>
            <div>
              <h3 class="text-lg font-semibold text-text_primary mb-1">Observation via <a href="/guides/dashboard" class="app-link link-dashboard">Local Dashboard</a></h3>
              <p class="text-sm text-text_secondary leading-relaxed">For visual management, the Local Dashboard connects to the LMX Admin port to visualize VRAM saturation, review the real-time inference queues, and monitor active network bindings across your LAN.</p>
            </div>
          </div>
        </div>
      `,
    },
  ],
};