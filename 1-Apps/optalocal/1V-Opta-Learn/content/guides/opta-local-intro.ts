import type { Guide } from './index';

export const optaLocalIntro: Guide = {
  slug: 'opta-local-intro',
  title: 'Introduction to Local',
  app: 'general',
  category: 'getting-started',
  template: 'holistic-whole-app',
  summary:
    'A private, local-first AI stack designed for developers running Apple Silicon. No cloud dependencies, no data leakage, zero monthly fees.',
  tags: ['opta local', 'intro', 'architecture', 'privacy', 'local-first'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: '[Setup] What is Opta Local?',
      body: 'Opta Local is a vertically integrated ecosystem that connects a command-line interface, a local inference server, and visual app surfaces into one cohesive developer system. You can chat with models, execute autonomous tasks, and orchestrate daemon-managed workflows entirely on your own infrastructure.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 font-mono text-xs">
    <div class="p-3 rounded-lg border border-[#22c55e]/35 bg-[#22c55e]/10">
      <div class="text-[#86efac] uppercase tracking-wider">CLI</div>
      <div class="mt-2 text-white">control + execution</div>
    </div>
    <div class="p-3 rounded-lg border border-[#a855f7]/35 bg-[#a855f7]/10">
      <div class="text-[#c4b5fd] uppercase tracking-wider">LMX</div>
      <div class="mt-2 text-white">inference runtime</div>
    </div>
    <div class="p-3 rounded-lg border border-[#3b82f6]/35 bg-[#3b82f6]/10">
      <div class="text-[#93c5fd] uppercase tracking-wider">Apps</div>
      <div class="mt-2 text-white">visual operations</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Configuration] Core Surfaces and Responsibilities',
      body: 'The stack is distributed across core surfaces:<br/><br/>1. <strong><a href="/guides/cli" class="app-link link-cli">Opta CLI</a>:</strong> terminal-first control surface for chat, autonomous execution, and policy-aware tooling.<br/>2. <strong><a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a>:</strong> local inference runtime and performance dashboard.<br/>3. <strong><a href="/guides/code-desktop" class="app-link link-general">Opta Code Desktop</a>:</strong> visual session timeline and daemon operations.<br/>4. <strong><a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a>:</strong> identity + preference sync without exporting local session payloads.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 font-mono text-xs">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/8 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Execution Plane</div>
      <div class="mt-2 text-white">CLI + LMX</div>
      <div class="mt-1 text-text-muted">commands, policy, inference</div>
    </div>
    <div class="rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/8 p-3">
      <div class="text-[#93c5fd] uppercase tracking-wider">Experience Plane</div>
      <div class="mt-2 text-white">Code Desktop + Accounts</div>
      <div class="mt-1 text-text-muted">visual ops, identity, continuity</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Operation] Architecture & Data Flow',
      body: 'The <a href="/guides/cli" class="app-link link-cli">CLI</a> connects to the local daemon (typically <code>127.0.0.1:9999</code>). The daemon enforces policy, routes tool calls, and forwards inference requests to <a href="/guides/lmx" class="app-link link-lmx">LMX</a> (commonly <code>localhost:1234</code>). This separation keeps policy/control deterministic while model runtime remains independently scalable.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="flex items-center justify-between font-mono text-xs gap-2">
    <span class="px-3 py-1.5 rounded-md bg-[#22c55e]/12 border border-[#22c55e]/35 text-[#86efac]">CLI :9999</span>
    <span class="text-text-muted">policy + tools</span>
    <span class="px-3 py-1.5 rounded-md bg-white/5 border border-white/20 text-white">Daemon</span>
    <span class="text-text-muted">inference route</span>
    <span class="px-3 py-1.5 rounded-md bg-[#a855f7]/12 border border-[#a855f7]/35 text-[#c4b5fd]">LMX :1234</span>
  </div>
</div>`,
    },
    {
      heading: '[Troubleshooting] Security and Privacy Model',
      body: 'By default, prompts, responses, and execution traces remain local. Sensitive actions are guarded by explicit approval pathways in the daemon policy engine. Account-level sync is limited to non-sensitive metadata and preferences; private code and local reasoning traces stay on-device.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 font-mono text-xs">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/8 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Stays local</div>
      <ul class="mt-2 space-y-1 text-text-secondary">
        <li>• prompts + responses</li>
        <li>• code + traces</li>
        <li>• model reasoning context</li>
      </ul>
    </div>
    <div class="rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/8 p-3">
      <div class="text-[#93c5fd] uppercase tracking-wider">Sync eligible</div>
      <ul class="mt-2 space-y-1 text-text-secondary">
        <li>• identity metadata</li>
        <li>• non-sensitive preferences</li>
        <li>• policy version pointers</li>
      </ul>
    </div>
  </div>
</div>`,
      note: 'Use <a href="/guides/accounts" class="app-link link-accounts">Accounts Local Sync</a> to understand exactly what can and cannot leave your machine.',
    },
    {
      heading: '[Optimization] Performance Envelope on Apple Silicon',
      body: 'The architecture is tuned for Apple Silicon unified memory. LMX keeps model execution close to memory bandwidth limits while the daemon handles orchestration overhead. In practice this means low-latency agent loops, predictable throughput, and fewer context handoff bottlenecks between control and inference planes.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 font-mono text-xs">
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd] uppercase tracking-wider">Latency</div>
      <div class="mt-2 text-white">tight token loop</div>
    </div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Throughput</div>
      <div class="mt-2 text-white">stable under load</div>
    </div>
    <div class="rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 p-3">
      <div class="text-[#67e8f9] uppercase tracking-wider">Reliability</div>
      <div class="mt-2 text-white">fewer handoff stalls</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: 'First-Week Operating Playbook',
      body: 'Best path to mastery: start in <a href="/guides/cli" class="app-link link-cli">CLI Masterclass</a>, then operationalize model/runtime behavior in <a href="/guides/lmx" class="app-link link-lmx">LMX</a>, and finally move into visual orchestration via <a href="/guides/code-desktop" class="app-link link-general">Code Desktop</a>. This sequence gives you architecture understanding before UI abstraction.',
      code: 'opta status\nopta chat\nopta do "summarize repository architecture and identify highest-risk files"',
    },
    {
      heading: 'Production Readiness Baseline',
      body: 'Before treating Opta Local as your daily production assistant, lock in a baseline operating contract: known model profiles, approved tool permissions, and a recovery path for daemon or inference failures. Document your default prompt workflow, verify local-only data boundaries, and define escalation steps for high-risk automation tasks. This small baseline dramatically reduces drift between solo usage and team usage while preserving the local-first privacy model.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 font-mono text-xs">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">Profiles</div>
      <div class="mt-2 text-text-secondary">known model set</div>
    </div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">Policy</div>
      <div class="mt-2 text-text-secondary">tool permission guardrails</div>
    </div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">Recovery</div>
      <div class="mt-2 text-text-secondary">escalation + rollback path</div>
    </div>
  </div>
</div>`,
      note: 'If your team uses shared runbooks, align the Opta Local baseline with the same escalation and rollback vocabulary used in deployment playbooks.',
      code: 'opta status --json\nopta daemon status --json\nopta models list',
    },
  ],
};
