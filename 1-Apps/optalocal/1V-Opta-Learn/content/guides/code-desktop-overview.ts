import type { Guide } from './index';

export const codeDesktopOverview: Guide = {
  slug: 'code-desktop',
  title: 'Code Desktop Overview',
  app: 'general',
  category: 'feature',
  template: 'feature-deep-dive',
  summary:
    'Discover the Opta Code Desktop, a graphical interface for monitoring daemon activity, managing sessions, and controlling local intelligence.',
  tags: ['code desktop', 'gui', 'daemon', 'monitoring', 'sessions'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: '[Setup] What is Code Desktop?',
      body: 'While the <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> is terminal-native, Code Desktop provides a visual operations layer on the same daemon. It renders timeline events, tool calls, and streaming output for high-speed debugging and review. Treat it as your primary observability surface once tasks leave first-run setup and enter steady execution.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="p-3 border border-white/20 rounded-lg bg-white/[0.03]"><div class="text-white">Session rail</div><div class="mt-2 text-text-muted">index + context</div></div>
    <div class="p-3 border border-[#22c55e]/30 rounded-lg bg-[#22c55e]/10"><div class="text-[#86efac]">Live stream</div><div class="mt-2 text-text-muted">tokens + status</div></div>
    <div class="p-3 border border-[#a855f7]/30 rounded-lg bg-[#a855f7]/10"><div class="text-[#c4b5fd]">Tool events</div><div class="mt-2 text-text-muted">invocations + outcomes</div></div>
  </div>
</div>`,
    },
    {
      heading: '[Configuration] Runtime Architecture',
      body: 'Code Desktop is a Vite + React app that communicates with daemon endpoints over localhost. The daemon then brokers calls to <a href="/guides/lmx" class="app-link link-lmx">LMX</a>, keeping transport and policy centralized. Key configuration surfaces are daemon host/port, session retention preferences, and any policy profile that governs high-risk tools.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
    <span class="px-3 py-1.5 rounded border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#93c5fd]">Desktop UI</span>
    <span class="text-text-muted">localhost transport</span>
    <span class="px-3 py-1.5 rounded border border-white/20 bg-white/[0.03] text-white">Daemon</span>
    <span class="text-text-muted">policy + broker</span>
    <span class="px-3 py-1.5 rounded border border-[#a855f7]/30 bg-[#a855f7]/10 text-[#c4b5fd]">LMX runtime</span>
  </div>
</div>`,
    },
    {
      heading: '[Operation] Session Rail & Timeline',
      body: 'The left rail indexes active and historical sessions. Selecting a session opens a full timeline with model turns, tool invocations, and latency spans, making post-mortem analysis practical for autonomous runs. A clean operating pattern is: execute in CLI, watch live events in Code Desktop, then annotate any anomaly before moving to the next run.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-[0.7fr_1.3fr] gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div class="text-white uppercase tracking-wider">Session rail</div>
      <div class="mt-2 space-y-1 text-text-secondary">
        <div>• run-1842 (active)</div>
        <div>• run-1841 (completed)</div>
        <div>• run-1840 (investigate)</div>
      </div>
    </div>
    <div class="rounded-lg border border-[#06b6d4]/25 bg-[#06b6d4]/10 p-3">
      <div class="text-[#67e8f9] uppercase tracking-wider">Timeline</div>
      <div class="mt-2 grid grid-cols-3 gap-2 text-text-secondary">
        <div class="rounded bg-white/5 p-2">Turn</div>
        <div class="rounded bg-white/5 p-2">Tool</div>
        <div class="rounded bg-white/5 p-2">Latency</div>
      </div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Troubleshooting] Streaming + Performance Panels',
      body: 'During generation, Code Desktop surfaces token velocity, elapsed runtime, and event granularity. This gives immediate signal on regressions after model/config changes.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac]">Token velocity</div>
      <div class="mt-2 text-white">92 tok/s</div>
    </div>
    <div class="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3">
      <div class="text-[#fdba74]">Elapsed runtime</div>
      <div class="mt-2 text-white">00:02:14</div>
    </div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3">
      <div class="text-[#c4b5fd]">Event density</div>
      <div class="mt-2 text-white">31 events / min</div>
    </div>
  </div>
</div>`,
      note: 'Use this panel as your first stop after dependency, model, or daemon policy changes. If stream cadence suddenly degrades, verify daemon health first before touching prompt or model settings.',
    },
    {
      heading: '[Optimization] Ops Workflow Integration',
      body: 'Optimal workflow: start or verify daemon in CLI, execute tasks, then use Code Desktop for visual debugging and replay. This prevents hidden failures and improves intervention speed when tools drift or prompts overreach. For teams, standardize a short post-run checklist (latency, errors, blocked tool calls, recovered incidents) so session reviews are comparable across operators.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-4 gap-2 text-xs font-mono">
    <div class="rounded-lg bg-white/[0.03] border border-white/10 p-2 text-white">1. Verify daemon</div>
    <div class="rounded-lg bg-white/[0.03] border border-white/10 p-2 text-white">2. Execute task</div>
    <div class="rounded-lg bg-white/[0.03] border border-white/10 p-2 text-white">3. Review timeline</div>
    <div class="rounded-lg bg-white/[0.03] border border-white/10 p-2 text-white">4. Log outcomes</div>
  </div>
</div>`,
      code: 'opta status\nopta do "run repo health check and summarize blockers"',
    },
  ],
};
