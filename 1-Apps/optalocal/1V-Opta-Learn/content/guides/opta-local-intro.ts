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
      heading: 'What is Opta Local?',
      body: 'Opta Local is a vertically integrated ecosystem that connects a command-line interface, a local inference server, and visual app surfaces into one cohesive developer system. You can chat with models, execute autonomous tasks, and orchestrate daemon-managed workflows entirely on your own infrastructure.',
      visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0f]"><div class="grid grid-cols-3 gap-4 font-mono text-xs"><div class="p-3 rounded-lg border border-[#22c55e]/40">CLI<br/><span class="text-text-muted">control</span></div><div class="p-3 rounded-lg border border-[#a855f7]/40">LMX<br/><span class="text-text-muted">inference</span></div><div class="p-3 rounded-lg border border-[#3b82f6]/40">Apps<br/><span class="text-text-muted">visual ops</span></div></div></div>`,
    },
    {
      heading: 'Core Surfaces and Responsibilities',
      body: 'The stack is distributed across core surfaces:<br/><br/>1. <strong><a href="/guides/cli" class="app-link link-cli">Opta CLI</a>:</strong> terminal-first control surface for chat, autonomous execution, and policy-aware tooling.<br/>2. <strong><a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a>:</strong> local inference runtime and performance dashboard.<br/>3. <strong><a href="/guides/code-desktop" class="app-link link-general">Opta Code Desktop</a>:</strong> visual session timeline and daemon operations.<br/>4. <strong><a href="/guides/accounts" class="app-link link-accounts">Opta Accounts</a>:</strong> identity + preference sync without exporting local session payloads.',
    },
    {
      heading: 'Architecture & Data Flow',
      body: 'The <a href="/guides/cli" class="app-link link-cli">CLI</a> connects to the local daemon (typically <code>127.0.0.1:9999</code>). The daemon enforces policy, routes tool calls, and forwards inference requests to <a href="/guides/lmx" class="app-link link-lmx">LMX</a> (commonly <code>localhost:1234</code>). This separation keeps policy/control deterministic while model runtime remains independently scalable.',
      visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-void"><div class="flex items-center justify-between font-mono text-xs"><span class="px-2 py-1 rounded bg-[#22c55e]/10 border border-[#22c55e]/30">CLI</span><span class="text-text-muted">→</span><span class="px-2 py-1 rounded bg-white/5 border border-white/20">Daemon</span><span class="text-text-muted">→</span><span class="px-2 py-1 rounded bg-[#a855f7]/10 border border-[#a855f7]/30">LMX</span></div></div>`,
    },
    {
      heading: 'Security and Privacy Model',
      body: 'By default, prompts, responses, and execution traces remain local. Sensitive actions are guarded by explicit approval pathways in the daemon policy engine. Account-level sync is limited to non-sensitive metadata and preferences; private code and local reasoning traces stay on-device.',
      note: 'Use <a href="/guides/accounts" class="app-link link-accounts">Accounts Local Sync</a> to understand exactly what can and cannot leave your machine.',
    },
    {
      heading: 'Performance Envelope on Apple Silicon',
      body: 'The architecture is tuned for Apple Silicon unified memory. LMX keeps model execution close to memory bandwidth limits while the daemon handles orchestration overhead. In practice this means low-latency agent loops, predictable throughput, and fewer context handoff bottlenecks between control and inference planes.',
    },
    {
      heading: 'First-Week Operating Playbook',
      body: 'Best path to mastery: start in <a href="/guides/cli" class="app-link link-cli">CLI Masterclass</a>, then operationalize model/runtime behavior in <a href="/guides/lmx" class="app-link link-lmx">LMX</a>, and finally move into visual orchestration via <a href="/guides/code-desktop" class="app-link link-general">Code Desktop</a>. This sequence gives you architecture understanding before UI abstraction.',
      code: 'opta status\nopta chat\nopta do "summarize repository architecture and identify highest-risk files"',
    },
  ],
};
