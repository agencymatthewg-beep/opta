import type { Guide } from './index';

export const browserAutomationGuide: Guide = {
  slug: 'browser-automation',
  title: 'Browser Automation Deep Dive',
  app: 'general',
  category: 'feature',
  template: 'feature-deep-dive',
  summary:
    'Understand how the Opta agent navigates the web, executes JavaScript, and interacts with UI elements using Playwright-based browser automation.',
  tags: ['browser', 'playwright', 'automation', 'mcp', 'agent'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: '[Setup] What is Browser Automation?',
      body: 'Browser automation gives your local agent control of a real browser runtime. It can navigate, inspect state, and perform UI interactions based on accessibility snapshots and DOM-level feedback loops. The practical start-to-end use case is: define a business outcome, let the agent execute the browser flow, then inspect timeline evidence for correctness before promoting the pattern into repeatable automation.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-4 gap-2 text-xs font-mono">
    <div class="rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-3 text-[#93c5fd]">navigate</div>
    <div class="rounded-lg border border-white/20 bg-white/[0.03] p-3 text-white">snapshot</div>
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3 text-[#86efac]">act</div>
    <div class="rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/10 p-3 text-[#c4b5fd]">verify</div>
  </div>
</div>`,
    },
    {
      heading: '[Configuration] Playwright + MCP Foundation',
      body: 'The system is built on Playwright tools surfaced through MCP, enabling robust navigation, element interaction, and tab/session management while preserving deterministic tool telemetry. Configure explicit permissions and prefer stable selectors to avoid brittle scripts that pass once and fail later under real-world UI variation.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#06b6d4]/30 bg-[#06b6d4]/10 p-3">
      <div class="text-[#67e8f9] uppercase tracking-wider">Tooling layer</div>
      <div class="mt-2 text-white">Playwright via MCP</div>
    </div>
    <div class="rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 p-3">
      <div class="text-[#fdba74] uppercase tracking-wider">Reliability guard</div>
      <div class="mt-2 text-white">stable selectors + explicit permissions</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Operation] Agentic Navigation Loop',
      body: 'Typical loop: <code>navigate</code> → <code>snapshot</code> → select target action (<code>click</code>/<code>type</code>/<code>press</code>) → re-snapshot and verify goal progression. This loop is what enables adaptive behavior vs brittle fixed scripts. In production-style tasks, capture checkpoints after each major transition (page load, auth boundary, form submit) so recovery can restart from a known state.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs font-mono">
    <div class="grid md:grid-cols-5 gap-2">
      <div class="rounded bg-white/5 p-2 text-white">navigate</div>
      <div class="rounded bg-white/5 p-2 text-white">snapshot</div>
      <div class="rounded bg-white/5 p-2 text-white">interact</div>
      <div class="rounded bg-white/5 p-2 text-white">snapshot</div>
      <div class="rounded bg-[#22c55e]/15 border border-[#22c55e]/30 p-2 text-[#86efac]">verify</div>
    </div>
  </div>
</div>`,
    },
    {
      heading: '[Troubleshooting] Policy & Permission Controls',
      body: 'Browser tool calls are routed through daemon policy guards. Safe actions can auto-run; sensitive actions (script eval, file upload, high-risk extraction) require explicit approval.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-2 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-3">
      <div class="text-[#86efac] uppercase tracking-wider">Auto-run safe</div>
      <div class="mt-2 text-text-secondary">navigate, snapshot, basic click</div>
    </div>
    <div class="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-3">
      <div class="text-[#fca5a5] uppercase tracking-wider">Approval required</div>
      <div class="mt-2 text-text-secondary">eval, upload, sensitive extraction</div>
    </div>
  </div>
</div>`,
      note: 'In autonomous mode, safe browsing remains fluid while data-sensitive edges are always human-gated. If execution stalls, inspect the last required approval before re-running the same step.',
    },
    {
      heading: '[Optimization] Reliability Checklist',
      body: 'For stable runs, force deterministic selectors, avoid hidden timing assumptions, and use state assertions after each major transition. Combine browser automation with <a href="/guides/cli" class="app-link link-cli">CLI</a> task decomposition to isolate failures faster. A useful optimization pattern is to split long tasks into smaller browser jobs that can be retried independently, reducing total rerun cost after any single-page failure.',
      visual: `<div class="visual-wrapper my-6 p-5">
  <div class="grid md:grid-cols-3 gap-3 text-xs font-mono">
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">selector stability</div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">state assertions</div>
    <div class="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-white">small retriable jobs</div>
  </div>
</div>`,
      code: 'opta do "open docs, capture key API changes, and produce a markdown summary with sources"',
    },
  ],
};
