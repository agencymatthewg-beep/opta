import type { Guide } from './index';

export const optaLocalIntro: Guide = {
  slug: 'opta-local-intro',
  title: 'Introduction to Opta Local',
  app: 'general',
  category: 'getting-started',
  summary: 'A private, local-first AI stack designed for developers running Apple Silicon. No cloud dependencies, no data leakage, zero monthly fees.',
  tags: ['opta local', 'intro', 'architecture', 'privacy', 'local-first'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'What is Opta Local?',
      body: 'Opta Local is a vertically integrated ecosystem that connects a command-line interface, a local inference server, and a visual dashboard into a single cohesive developer experience. It lets you converse with AI models, execute autonomous coding tasks, and manage long-running daemon sessions entirely on your own local network.'
    },
    {
      heading: 'The Three Core Apps',
      body: 'The stack is distributed across three core applications:<br/><br/>1. <strong><a href="/guides/cli" class="app-link link-cli">Opta CLI</a>:</strong> The terminal-first control surface for chat, autonomous task execution, and tool routing.<br/>2. <strong><a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a>:</strong> The high-performance local inference engine and web dashboard, designed for Mac Studio / Mac Pro hardware.<br/>3. <strong><a href="/guides/code-desktop" class="app-link link-general">Opta Code Desktop</a>:</strong> A visual application surface for managing Opta workflows and daemon sessions on macOS and Windows.'
    },
    {
      heading: 'Key Benefits',
      body: '<strong>Privacy:</strong> Every prompt, model response, and session trace stays on your local network. There is no cloud telemetry or data retention.<br/><strong>Speed:</strong> Leveraging Apple Silicon unified memory, Opta loads models directly into GPU-accessible memory, often achieving 40+ tokens per second on 70B parameter models.<br/><strong>Control:</strong> You maintain absolute authority over the active models, permitted toolsets, and system-level guardrails.'
    },
    {
      heading: 'Architectural Overview',
      body: 'The <a href="/guides/cli" class="app-link link-cli">CLI</a> connects to a local daemon (running on <code>127.0.0.1:9999</code>). This daemon orchestrates tool executions, enforces strict policy permissions, and proxies inference requests via HTTP REST and WebSockets to the <a href="/guides/lmx" class="app-link link-lmx">LMX</a> inference server (typically running on your network at <code>port 1234</code>).'
    }
  ],
};
