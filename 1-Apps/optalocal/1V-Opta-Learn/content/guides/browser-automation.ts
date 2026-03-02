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
      heading: 'What is Browser Automation?',
      body: 'Browser automation gives your local agent control of a real browser runtime. It can navigate, inspect state, and perform UI interactions based on accessibility snapshots and DOM-level feedback loops.',
      visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0f]"><div class="flex items-center justify-between text-xs font-mono"><span class="px-2 py-1 rounded border border-[#3b82f6]/30">navigate</span><span>→</span><span class="px-2 py-1 rounded border border-white/20">snapshot</span><span>→</span><span class="px-2 py-1 rounded border border-[#22c55e]/30">act</span><span>→</span><span class="px-2 py-1 rounded border border-[#a855f7]/30">verify</span></div></div>`,
    },
    {
      heading: 'Playwright + MCP Foundation',
      body: 'The system is built on Playwright tools surfaced through MCP, enabling robust navigation, element interaction, and tab/session management while preserving deterministic tool telemetry.',
    },
    {
      heading: 'Agentic Navigation Loop',
      body: 'Typical loop: <code>navigate</code> → <code>snapshot</code> → select target action (<code>click</code>/<code>type</code>/<code>press</code>) → re-snapshot and verify goal progression. This loop is what enables adaptive behavior vs brittle fixed scripts.',
    },
    {
      heading: 'Policy & Permission Controls',
      body: 'Browser tool calls are routed through daemon policy guards. Safe actions can auto-run; sensitive actions (script eval, file upload, high-risk extraction) require explicit approval.',
      note: 'In autonomous mode, safe browsing remains fluid while data-sensitive edges are always human-gated.',
    },
    {
      heading: 'Reliability Checklist',
      body: 'For stable runs, force deterministic selectors, avoid hidden timing assumptions, and use state assertions after each major transition. Combine browser automation with <a href="/guides/cli" class="app-link link-cli">CLI</a> task decomposition to isolate failures faster.',
      code: 'opta do "open docs, capture key API changes, and produce a markdown summary with sources"',
    },
  ],
};
