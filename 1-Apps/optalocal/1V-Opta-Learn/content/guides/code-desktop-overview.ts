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
      heading: 'What is Code Desktop?',
      body: 'While the <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> is terminal-native, Code Desktop provides a visual operations layer on the same daemon. It renders timeline events, tool calls, and streaming output for high-speed debugging and review.',
      visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-void"><div class="grid grid-cols-3 gap-3 text-xs font-mono"><div class="p-3 border border-white/20 rounded">Session Rail</div><div class="p-3 border border-[#22c55e]/30 rounded">Live Stream</div><div class="p-3 border border-[#a855f7]/30 rounded">Tool Events</div></div></div>`,
    },
    {
      heading: 'Runtime Architecture',
      body: 'Code Desktop is a Vite + React app that communicates with daemon endpoints over localhost. The daemon then brokers calls to <a href="/guides/lmx" class="app-link link-lmx">LMX</a>, keeping transport and policy centralized.',
    },
    {
      heading: 'Session Rail & Timeline',
      body: 'The left rail indexes active and historical sessions. Selecting a session opens a full timeline with model turns, tool invocations, and latency spans, making post-mortem analysis practical for autonomous runs.',
    },
    {
      heading: 'Streaming + Performance Panels',
      body: 'During generation, Code Desktop surfaces token velocity, elapsed runtime, and event granularity. This gives immediate signal on regressions after model/config changes.',
      note: 'Use this panel as your first stop after dependency, model, or daemon policy changes.',
    },
    {
      heading: 'Ops Workflow Integration',
      body: 'Optimal workflow: start or verify daemon in CLI, execute tasks, then use Code Desktop for visual debugging and replay. This prevents hidden failures and improves intervention speed when tools drift or prompts overreach.',
      code: 'opta status\nopta do "run repo health check and summarize blockers"',
    },
  ],
};
