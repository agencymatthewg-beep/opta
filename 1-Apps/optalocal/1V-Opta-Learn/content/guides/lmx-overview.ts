import type { Guide } from './index';

export const lmxOverview: Guide = {
  slug: 'lmx',
  title: 'Getting Started with LMX',
  app: 'lmx',
  category: 'getting-started',
  template: 'process-workflow',
  summary:
    'Learn how to use the LMX dashboard to load models, run inference, and manage your local AI server.',
  tags: ['lmx', 'dashboard', 'inference', 'models', 'server', 'getting started'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'What is LMX?',
      body: 'LMX is the inference engine at the core of Opta Local. It exposes an OpenAI-compatible API, runs local models on Apple Silicon, and provides operational telemetry for model lifecycle, throughput, and active sessions.',
      visual: `<div class="visual-wrapper my-6 p-5 rounded-xl border border-white/10 bg-[#0a0a0f]"><div class="font-mono text-xs grid grid-cols-2 gap-3"><div class="p-3 border border-[#a855f7]/30 rounded">Model Runtime</div><div class="p-3 border border-[#22c55e]/30 rounded">API Surface</div><div class="p-3 border border-white/20 rounded">Queue + Sessions</div><div class="p-3 border border-[#3b82f6]/30 rounded">Telemetry</div></div></div>`,
    },
    {
      heading: 'Dashboard Surfaces',
      body: 'At <code>lmx.optalocal.com</code>, the dashboard exposes model inventory, loaded model state, queue pressure, and response throughput. Treat it as your operational control panel while <a href="/guides/cli" class="app-link link-cli">CLI</a> remains your execution interface.',
    },
    {
      heading: 'Model Load Workflow',
      body: 'Open the Models panel, select an approved local model, and load it into runtime. Validate readiness before issuing heavy jobs so autonomous runs do not fail from cold-start or incompatible context windows.',
      note: 'LMX performs best with native Apple-Silicon-optimized formats; verify compatibility before benchmark runs.',
    },
    {
      heading: 'Inference API Usage',
      body: 'Once loaded, requests can be sent to the OpenAI-compatible endpoint. Use this path for direct integration tests and latency benchmarking before wiring app-level flows.',
      code: `curl http://localhost:1234/v1/chat/completions \\n  -H "Content-Type: application/json" \\n  -d '{"model":"current","messages":[{"role":"user","content":"Hello"}]}'`,
    },
    {
      heading: 'Operational Guardrails',
      body: 'Before production tasks: confirm model loaded, verify daemon health, and cap context size to avoid avoidable OOM or runaway latency. Pair LMX checks with <a href="/guides/code-desktop" class="app-link link-general">Code Desktop</a> for stream-level visibility.',
    },
  ],
};
