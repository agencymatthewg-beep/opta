import type { Guide } from './index';

export const lmxOverview: Guide = {
  slug: 'lmx',
  title: 'Getting Started with LMX',
  app: 'lmx',
  category: 'getting-started',
  template: 'visual-interactive-journey',
  summary:
    'Learn how to use the LMX dashboard to load models, run inference, and manage your local AI server.',
  tags: ['lmx', 'dashboard', 'inference', 'models', 'server', 'getting started'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: '[Setup] What is LMX?',
      body: 'LMX is the local inference brain. Start by confirming stack install, daemon availability, and dashboard reachability so every later step runs on a verified runtime foundation.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 font-mono text-xs">
    <div class="rounded-lg bg-[#0f172a]/70 border border-[#3b82f6]/35 p-3">
      <div class="text-[#93c5fd] uppercase tracking-wider">Bootstrap</div>
      <div class="mt-2 text-white">Init installs stack</div>
      <div class="mt-3 h-1.5 rounded bg-white/10 overflow-hidden"><div class="h-full w-full bg-[#3b82f6]/70"></div></div>
    </div>
    <div class="rounded-lg bg-[#052e16]/50 border border-[#22c55e]/35 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Runtime</div>
      <div class="mt-2 text-white">Daemon online</div>
      <div class="mt-3 flex items-center gap-2 text-[10px] text-[#86efac]"><span class="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>healthy heartbeat</div>
    </div>
    <div class="rounded-lg bg-[#3b0764]/35 border border-[#a855f7]/35 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Surface</div>
      <div class="mt-2 text-white">LMX dashboard live</div>
      <div class="mt-3 text-[10px] text-text-secondary">route: <code>lmx.optalocal.com</code></div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Configuration] Dashboard Surfaces',
      body: 'Configure default model, context window, and concurrency settings before workloads. Treat <code>lmx.optalocal.com</code> as source of truth for config state and live capacity signals.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-[1.1fr_0.9fr] gap-4">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div class="text-xs font-mono text-white uppercase tracking-wider">Configuration checklist</div>
      <ul class="mt-3 space-y-2 text-xs font-mono text-text-secondary">
        <li class="flex items-center justify-between"><span>Default model selected</span><span class="text-[#22c55e]">ok</span></li>
        <li class="flex items-center justify-between"><span>Context limit matched to RAM</span><span class="text-[#22c55e]">ok</span></li>
        <li class="flex items-center justify-between"><span>Concurrency tuned</span><span class="text-[#f59e0b]">review</span></li>
      </ul>
    </div>
    <div class="rounded-lg border border-[#a855f7]/25 bg-[#a855f7]/8 p-4 font-mono text-xs">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Active profile</div>
      <div class="mt-2 text-white">deepseek-r1-8b</div>
      <div class="mt-3 space-y-2 text-text-secondary">
        <div class="flex justify-between"><span>Context</span><span>64k</span></div>
        <div class="flex justify-between"><span>Concurrency</span><span>3</span></div>
        <div class="flex justify-between"><span>Guardrail</span><span>enabled</span></div>
      </div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Operation] Model Load Workflow',
      body: 'Run the operator path: load model, send smoke request, verify response speed, then hand execution to <a href="/guides/code-desktop" class="app-link link-general">Code Desktop</a> or CLI.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-4 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3"><div class="text-white">1. Load model</div><div class="text-text-muted mt-2">approved profile</div></div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3"><div class="text-white">2. Smoke prompt</div><div class="text-text-muted mt-2">single-turn probe</div></div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3"><div class="text-[#bbf7d0]">3. Verify latency</div><div class="text-text-muted mt-2">p95 target met</div></div>
    <div class="rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 p-3"><div class="text-[#67e8f9]">4. Start workload</div><div class="text-text-muted mt-2">handoff to ops</div></div>
  </div>
</div>`,
      note: 'Prioritize Apple-Silicon-optimized model formats for stable throughput and reduced cold-start variance.',
    },
    {
      heading: '[Troubleshooting] Inference API Usage',
      body: 'If requests fail, diagnose in this order: daemon health, model loaded state, then endpoint/port match. This ordered triage eliminates most false debugging branches.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="rounded-lg border border-[#f59e0b]/25 bg-[#f59e0b]/10 p-3 font-mono text-xs text-[#fdba74]">Failure detected → run ordered triage</div>
  <div class="mt-3 grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white">Daemon health</div>
      <div class="mt-2 text-text-muted"><code>opta daemon status</code></div>
    </div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white">Model loaded</div>
      <div class="mt-2 text-text-muted"><code>/v1/models</code> contains target</div>
    </div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white">Endpoint / port</div>
      <div class="mt-2 text-text-muted">check <code>host:1234</code> route</div>
    </div>
  </div>
</div>`,
      code: `curl http://localhost:1234/v1/chat/completions \\n  -H "Content-Type: application/json" \\n  -d '{"model":"current","messages":[{"role":"user","content":"Health check"}]}'`,
    },
    {
      heading: '[Optimization] Operational Guardrails',
      body: 'Close each run with measurement: queue depth, average response time, and error rate. Tune concurrency first, then context size, then model choice only if needed.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 font-mono text-xs">
    <div class="rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 p-3">
      <div class="text-[#67e8f9] uppercase tracking-wider">Measure</div>
      <div class="mt-2 text-white">Latency + queue depth</div>
    </div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Tune</div>
      <div class="mt-2 text-white">Concurrency before context</div>
    </div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Verify</div>
      <div class="mt-2 text-white">Error trend stable</div>
    </div>
  </div>
</div>`,
    },
  ],
};
