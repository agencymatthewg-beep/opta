import type { Guide } from './index';

export const cliMasterclass: Guide = {
  slug: 'cli',
  title: 'CLI Masterclass',
  app: 'cli',
  category: 'reference',
  template: 'holistic-whole-app',
  summary: 'A comprehensive deep dive into the Opta CLI. Master interactive chat, autonomous task execution, and local daemon orchestration right from your terminal.',
  tags: ['cli', 'terminal', 'chat', 'do', 'daemon', 'tools', 'masterclass'],
  updatedAt: '2026-03-02',
  sections: [
    {
      heading: 'Ecosystem Role',
      body: 'The <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> is your primary interface to the Opta Local stack. It provides interactive AI chat, autonomous task execution, model management, session control, and daemon lifecycle commands. It seamlessly connects to the local daemon, which orchestrates sessions and proxies requests to <a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> for inference.',
      visual: `<div class="visual-wrapper my-6 p-6 rounded-xl border border-white/10 bg-[#0a0a0f] relative overflow-hidden group">
        <div class="absolute inset-0 bg-gradient-to-br from-[#22c55e]/10 to-transparent opacity-50"></div>
        <div class="flex items-center justify-between relative z-10 font-mono text-sm">
           <div class="flex flex-col items-center gap-2 p-4 bg-void border border-white/10 rounded-lg shadow-lg">
             <div class="w-8 h-8 rounded-full border border-[#22c55e] flex items-center justify-center text-[#22c55e]">CLI</div>
             <span class="text-text-muted text-xs">Terminal</span>
           </div>
           <div class="h-[2px] w-16 bg-gradient-to-r from-[#22c55e]/50 to-[#a855f7]/50 relative">
             <div class="absolute w-2 h-2 rounded-full bg-white top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_white]"></div>
           </div>
           <div class="flex flex-col items-center gap-2 p-4 bg-void border border-white/10 rounded-lg shadow-lg">
             <div class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/50">D</div>
             <span class="text-text-muted text-xs">Daemon</span>
           </div>
           <div class="h-[2px] w-16 bg-gradient-to-r from-white/20 to-[#a855f7]/50 relative"></div>
           <div class="flex flex-col items-center gap-2 p-4 bg-void border border-white/10 rounded-lg shadow-lg">
             <div class="w-8 h-8 rounded-full border border-[#a855f7] flex items-center justify-center text-[#a855f7]">LMX</div>
             <span class="text-text-muted text-xs">Inference</span>
           </div>
        </div>
      </div>`
    },
    {
      heading: 'Architecture & The Daemon',
      body: 'Under the hood, the CLI doesn\'t perform inference itself. Instead, it connects to the Opta Daemon (running in the background), which manages long-lived sessions, tool permissions, and communication with the <a href="/guides/lmx" class="app-link link-lmx">LMX</a> server. You can control the daemon directly using commands like <code>opta daemon start</code> or view its health via <code>opta status</code>.'
    },
    {
      heading: 'Two Modes of Operation: Chat vs. Do',
      body: 'The CLI operates in two fundamental modes designed for different workflows. <strong>Chat Mode</strong> is an interactive conversation session. You type messages, the model streams back responses token-by-token in real time, and you manually approve tool executions. <strong>Do Mode</strong> runs an autonomous agent loop. It takes a natural-language task, creates a plan, and automatically executes safe tools until the task is complete.',
      note: 'Use <code>opta chat</code> to explore and steer the conversation manually. Use <code>opta do "task"</code> when you have a well-defined goal and want the AI to execute it with minimal interruption.',
      visual: `<div class="visual-wrapper my-6 grid grid-cols-2 gap-4">
        <div class="p-5 border border-white/10 rounded-xl bg-void shadow-inner flex flex-col gap-3">
          <div class="flex items-center gap-2 text-[#06b6d4] font-mono text-sm uppercase tracking-wider">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
            Chat Mode
          </div>
          <div class="flex-1 border-l-2 border-white/10 pl-3 py-1 flex flex-col gap-2">
            <div class="w-3/4 h-2 bg-white/10 rounded"></div>
            <div class="w-1/2 h-2 bg-[#06b6d4]/40 rounded"></div>
            <div class="w-full h-2 bg-white/10 rounded"></div>
            <div class="w-2/3 h-2 bg-[#06b6d4]/40 rounded"></div>
          </div>
          <div class="text-xs text-text-muted mt-2">Interactive, user-steered, prompt-driven.</div>
        </div>
        <div class="p-5 border border-white/10 rounded-xl bg-void shadow-inner flex flex-col gap-3">
          <div class="flex items-center gap-2 text-[#f59e0b] font-mono text-sm uppercase tracking-wider">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Do Mode
          </div>
          <div class="flex-1 flex flex-col gap-2 relative">
             <div class="absolute left-[7px] top-2 bottom-2 w-[2px] bg-white/10"></div>
             <div class="flex items-center gap-3 relative z-10"><div class="w-4 h-4 rounded-full bg-void border-2 border-[#f59e0b]"></div><div class="w-1/2 h-2 bg-white/20 rounded"></div></div>
             <div class="flex items-center gap-3 relative z-10"><div class="w-4 h-4 rounded-full bg-void border-2 border-[#f59e0b]"></div><div class="w-2/3 h-2 bg-white/20 rounded"></div></div>
             <div class="flex items-center gap-3 relative z-10"><div class="w-4 h-4 rounded-full bg-[#f59e0b]"></div><div class="w-1/3 h-2 bg-[#f59e0b]/50 rounded"></div></div>
          </div>
          <div class="text-xs text-text-muted mt-2">Autonomous, agentic loop, goal-driven.</div>
        </div>
      </div>`
    },
    {
      heading: 'Working with Tools',
      body: 'Both chat and do modes have access to the same powerful toolset. Read-only tools like <code>read_file</code> and <code>search_files</code> are auto-approved by default. Destructive tools like <code>write_file</code> or <code>run_command</code> trigger a Permission Prompt where you can approve, deny, or auto-approve for the remainder of the session.',
      code: `Tool: write_file\nPath: src/auth/validate.ts\nContent: (47 lines)\n\n[A]pprove  [D]eny  [A]ll for this tool  [Q]uit`,
      visual: `<div class="visual-wrapper my-6 border border-[#f59e0b]/30 bg-[#f59e0b]/5 rounded-xl p-5 relative">
        <div class="absolute top-0 right-0 px-3 py-1 bg-[#f59e0b]/20 text-[#f59e0b] font-mono text-xs rounded-bl-lg rounded-tr-xl">Permission Gateway</div>
        <div class="flex flex-col gap-4 mt-2 font-mono text-sm">
          <div class="flex items-center gap-3 bg-void p-2 rounded border border-[#22c55e]/30">
             <div class="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></div>
             <span class="text-text-primary">read_file</span>
             <span class="ml-auto text-xs text-[#22c55e]">Auto-approved</span>
          </div>
          <div class="flex items-center gap-3 bg-void p-2 rounded border border-[#f59e0b]/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
             <div class="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
             <span class="text-text-primary">run_shell_command</span>
             <span class="ml-auto text-xs text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded">Requires Approval</span>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Managing Sessions & Models',
      body: 'Your conversations are persistently stored. Use <code>opta sessions</code> to list, view, export, or delete past sessions. To switch out the intelligence engine, use <code>opta models</code> to load, swap, or browse models cached on your machine via <a href="/guides/lmx" class="app-link link-lmx">LMX</a>.',
      code: `# Resume a previous session\nopta chat --session abc123\n\n# Start a chat with a specific model\nopta chat --model deepseek-r1`
    }
  ],
};