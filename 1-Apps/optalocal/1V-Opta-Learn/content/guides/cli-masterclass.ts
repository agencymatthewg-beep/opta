import type { Guide } from './index';

export const cliMasterclass: Guide = {
  slug: 'cli-masterclass',
  title: 'Opta CLI Masterclass',
  app: 'cli',
  category: 'reference',
  summary: 'A comprehensive deep dive into the Opta CLI. Master interactive chat, autonomous task execution, and local daemon orchestration right from your terminal.',
  tags: ['cli', 'terminal', 'chat', 'do', 'daemon', 'tools', 'masterclass'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'Ecosystem Role',
      body: 'The <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> is your primary interface to the Opta Local stack. It provides interactive AI chat, autonomous task execution, model management, session control, and daemon lifecycle commands. It seamlessly connects to the local daemon, which orchestrates sessions and proxies requests to <a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> for inference.'
    },
    {
      heading: 'Architecture & The Daemon',
      body: 'Under the hood, the CLI doesn\'t perform inference itself. Instead, it connects to the Opta Daemon (running in the background), which manages long-lived sessions, tool permissions, and communication with the <a href="/guides/lmx" class="app-link link-lmx">LMX</a> server. You can control the daemon directly using commands like <code>opta daemon start</code> or view its health via <code>opta status</code>.'
    },
    {
      heading: 'Two Modes of Operation: Chat vs. Do',
      body: 'The CLI operates in two fundamental modes designed for different workflows. <strong>Chat Mode</strong> is an interactive conversation session. You type messages, the model streams back responses token-by-token in real time, and you manually approve tool executions. <strong>Do Mode</strong> runs an autonomous agent loop. It takes a natural-language task, creates a plan, and automatically executes safe tools until the task is complete.',
      note: 'Use <code>opta chat</code> to explore and steer the conversation manually. Use <code>opta do "task"</code> when you have a well-defined goal and want the AI to execute it with minimal interruption.'
    },
    {
      heading: 'Working with Tools',
      body: 'Both chat and do modes have access to the same powerful toolset. Read-only tools like <code>read_file</code> and <code>search_files</code> are auto-approved by default. Destructive tools like <code>write_file</code> or <code>run_command</code> trigger a Permission Prompt where you can approve, deny, or auto-approve for the remainder of the session.',
      code: `Tool: write_file\nPath: src/auth/validate.ts\nContent: (47 lines)\n\n[A]pprove  [D]eny  [A]ll for this tool  [Q]uit`
    },
    {
      heading: 'Managing Sessions & Models',
      body: 'Your conversations are persistently stored. Use <code>opta sessions</code> to list, view, export, or delete past sessions. To switch out the intelligence engine, use <code>opta models</code> to load, swap, or browse models cached on your machine via <a href="/guides/lmx" class="app-link link-lmx">LMX</a>.',
      code: `# Resume a previous session\nopta chat --session abc123\n\n# Start a chat with a specific model\nopta chat --model deepseek-r1`
    }
  ],
};
