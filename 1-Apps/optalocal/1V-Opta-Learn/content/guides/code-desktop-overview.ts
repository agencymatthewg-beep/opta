import type { Guide } from './index';

export const codeDesktopOverview: Guide = {
  slug: 'code-desktop',
  title: 'Code Desktop Overview',
  app: 'general',
  category: 'feature',
  summary: 'Discover the Opta Code Desktop, a graphical interface for monitoring daemon activity, managing sessions, and controlling local intelligence.',
  tags: ['code desktop', 'gui', 'daemon', 'monitoring', 'sessions'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'What is Code Desktop?',
      body: 'While the <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> is a terminal-native experience, Code Desktop offers a rich, visual interface to the exact same daemon. It connects via WebSocket and HTTP, presenting your session history as an intuitive timeline, tool calls as collapsible cards, and real-time streaming model responses with live token counters.'
    },
    {
      heading: 'Under the Hood',
      body: 'Code Desktop is a pure Vite + React web application. It does not rely on heavy wrappers like Electron or Tauri. Instead, it communicates directly with the Opta Daemon over localhost (<code>127.0.0.1:9999</code>). The daemon then proxies inference requests to <a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a>.'
    },
    {
      heading: 'Workspace Rail & Timeline',
      body: 'The interface is anchored by the Workspace Rail—a sidebar listing all active and historical daemon sessions. Selecting a session opens the Timeline View, which chronologically displays user messages, model responses, and tool executions. This makes it incredibly easy to review past agentic loops or debug complex tasks.'
    },
    {
      heading: 'Real-Time Streaming & Stats',
      body: 'As the daemon processes inference, Code Desktop displays live token counters and progress indicators. Upon completion, each turn displays rich statistics including total tokens, generation speed (tok/s), and execution time.',
      note: 'Code Desktop includes a Daemon Panel that allows you to start, stop, or restart the background daemon, and tail its logs in real time.'
    },
    {
      heading: 'Connection Model',
      body: 'Authentication is handled seamlessly. The app reads a Bearer token from the daemon's local <code>state.json</code> file and stores it in your browser's <code>localStorage</code>. If the daemon restarts, Code Desktop detects the disconnection and automatically reconnects with exponential backoff.',
    }
  ],
};
