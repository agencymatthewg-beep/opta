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
      visual: `<div class="visual-wrapper my-8 border border-[#f59e0b]/30 bg-[rgba(245,158,11,0.05)] rounded-xl p-6 relative shadow-[0_0_30px_rgba(245,158,11,0.05)]">
        <div class="absolute -top-3 right-6 px-3 py-1 bg-[#f59e0b]/20 border border-[#f59e0b]/30 text-[#f59e0b] font-mono text-xs rounded backdrop-blur-md shadow-lg">Permission Gateway</div>
        <div class="flex flex-col gap-4 mt-2 font-mono text-sm">
          <div class="flex items-center gap-3 bg-void/80 backdrop-blur-md p-3 rounded-lg border border-[#22c55e]/20">
             <div class="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
             <span class="text-text-primary">read_file</span>
             <span class="ml-auto text-xs text-[#22c55e] bg-[#22c55e]/10 px-2 py-1 rounded">Auto-approved</span>
          </div>
          <div class="flex items-center gap-3 bg-void/80 backdrop-blur-md p-3 rounded-lg border border-[#f59e0b]/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
             <div class="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
             <span class="text-text-primary">run_shell_command</span>
             <span class="ml-auto text-xs text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-1 rounded">Requires Approval</span>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Context Constellations',
      body: 'Understanding what the AI "sees" is critical. Use <code>opta context map</code> to generate a live Context Constellation. This visualizes exactly which files, terminal buffers, and API documentation are currently loaded into the AI\'s active memory, along with their associated token weight. It helps you trim unnecessary context to improve latency.',
      visual: `<div class="visual-wrapper my-8 relative rounded-xl border border-white/10 bg-[#0a0a0f] overflow-hidden p-8 shadow-2xl">
        <div class="absolute inset-0 opacity-[0.03]" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 32px 32px;"></div>
        
        <div class="relative z-10 font-mono text-sm max-w-sm mx-auto">
          <!-- Center Node -->
          <div class="flex justify-center mb-10">
            <div class="relative">
              <div class="w-16 h-16 rounded-full bg-void border-2 border-[#a855f7] flex items-center justify-center text-[#a855f7] shadow-[0_0_20px_rgba(168,85,247,0.3)] z-10 relative">LMX</div>
              <div class="absolute inset-0 rounded-full border border-[#a855f7]/30 animate-opta-breathe"></div>
            </div>
          </div>

          <!-- Connecting Lines -->
          <div class="absolute top-[3.5rem] left-1/2 -translate-x-1/2 w-full h-full pointer-events-none">
            <svg class="w-full h-full text-white/10" overflow="visible">
              <path d="M 190 20 L 80 100" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" fill="none" />
              <path d="M 190 20 L 190 100" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" fill="none" />
              <path d="M 190 20 L 300 100" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4" fill="none" />
            </svg>
          </div>

          <!-- Bottom Nodes -->
          <div class="flex justify-between items-start gap-4">
            <!-- Node 1 -->
            <div class="flex flex-col items-center gap-2">
              <div class="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[#06b6d4] text-xs backdrop-blur-md">app.tsx</div>
              <div class="text-[10px] text-text-muted flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></div> 4.2k tkns</div>
            </div>
            <!-- Node 2 -->
            <div class="flex flex-col items-center gap-2">
              <div class="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-text-primary text-xs backdrop-blur-md">Terminal #1</div>
              <div class="text-[10px] text-text-muted flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></div> 840 tkns</div>
            </div>
            <!-- Node 3 -->
            <div class="flex flex-col items-center gap-2">
              <div class="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-text-primary text-xs backdrop-blur-md">auth.js</div>
              <div class="text-[10px] text-text-muted flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse"></div> 12k tkns</div>
            </div>
          </div>
          
          <!-- Context Pressure Bar -->
          <div class="mt-12 bg-white/5 p-3 rounded-lg border border-white/10">
            <div class="flex justify-between text-xs mb-2">
              <span class="text-text-muted">Context Pressure</span>
              <span class="text-[#f59e0b]">78%</span>
            </div>
            <div class="w-full h-1.5 bg-void rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-[#22c55e] via-[#f59e0b] to-[#ef4444]" style="width: 78%"></div>
            </div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Time-Travel Introspection',
      body: 'Autonomous execution involves risk. Opta CLI mitigates this using Time-Travel Introspection (<code>opta rewind</code>). Before triggering a chain of tools in <strong class="text-[#f59e0b]">Do Mode</strong>, the Daemon captures an ephemeral snapshot of your workspace. If the agent hallucinates or goes down a destructive path, you can instantly roll back not just the files, but the AI\'s internal short-term memory to the exact moment before divergence.',
      visual: `<div class="visual-wrapper my-8 p-6 rounded-xl border border-white/5 bg-[rgba(5,3,10,0.8)] backdrop-blur-[16px] overflow-hidden">
        <div class="font-mono text-sm">
          <div class="flex items-center gap-4 mb-3">
             <div class="w-24 text-right text-text-muted text-xs">10:42:01</div>
             <div class="w-3 h-3 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
             <div class="px-3 py-1 bg-white/5 rounded text-text-primary">Created AuthGuard</div>
          </div>
          <div class="flex items-center gap-4 mb-3">
             <div class="w-24 text-right text-text-muted text-xs">10:42:05</div>
             <div class="w-3 h-3 rounded-full bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
             <div class="px-3 py-1 bg-white/5 rounded text-text-primary border border-[#a855f7]/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]">Snapshot Saved</div>
          </div>
          <div class="flex items-center gap-4 mb-3 opacity-50 relative">
             <div class="absolute w-[2px] h-12 bg-[#ef4444]/30 left-[118px] -top-8 -z-10"></div>
             <div class="w-24 text-right text-text-muted text-xs">10:42:15</div>
             <div class="w-3 h-3 rounded-full bg-[#ef4444]"></div>
             <div class="px-3 py-1 text-[#ef4444] line-through decoration-[#ef4444]/50">Deleted layout.tsx</div>
          </div>
          <div class="flex items-center gap-4 mt-6 p-3 bg-[#a855f7]/10 rounded border border-[#a855f7]/20 relative">
             <div class="absolute -left-[30px] top-1/2 -translate-y-1/2 flex items-center text-[#a855f7]">
               <svg class="w-5 h-5 ml-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
             </div>
             <div class="text-[#a855f7] ml-6">
                <span class="font-bold">opta rewind</span> · Reverted to 10:42:05
             </div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Local Swarm Sub-Agents',
      body: 'For massive refactoring tasks, a single thread is a bottleneck. By appending <code>--swarm</code> to your command, the CLI orchestrates multiple local models via LMX. A Director Agent breaks down the prompt into sub-tasks, spins up 2-3 worker agents (e.g., DeepSeek for business logic, Llama 3 for unit tests), and merges their outputs asynchronously—all executing privately on your metal.',
      code: `opta do --swarm "Refactor the authentication flow to use JWTs instead of session cookies, and write unit tests for the new middleware."`,
      visual: `<div class="visual-wrapper my-8 relative rounded-xl border border-white/10 bg-void p-1 overflow-hidden">
        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]"></div>
        <div class="grid grid-cols-3 gap-1 relative z-10 h-48">
          <!-- Pane 1 -->
          <div class="bg-[#0a0a0f]/90 border border-white/5 rounded-l-lg p-3 font-mono text-[10px] flex flex-col">
            <div class="text-[#a855f7] border-b border-white/5 pb-2 mb-2 flex items-center justify-between">
              <span>[DIRECTOR]</span><span class="w-1.5 h-1.5 rounded-full bg-[#a855f7] animate-pulse"></span>
            </div>
            <div class="text-text-muted space-y-1">
              <p>> Analyzing prompt...</p>
              <p>> Spawning workers...</p>
              <p class="text-[#22c55e]">> Assigning Task A</p>
              <p class="text-[#22c55e]">> Assigning Task B</p>
            </div>
          </div>
          <!-- Pane 2 -->
          <div class="bg-[#0a0a0f]/90 border border-white/5 p-3 font-mono text-[10px] flex flex-col relative">
            <div class="absolute -left-[5px] top-6 w-[10px] h-[1px] bg-[#a855f7]/50"></div>
            <div class="text-[#06b6d4] border-b border-white/5 pb-2 mb-2 flex items-center justify-between">
              <span>[01_LOGIC]</span><span class="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse"></span>
            </div>
            <div class="text-text-muted space-y-1">
              <p>> Reading auth.ts...</p>
              <p>> Generating JWT...</p>
              <p class="animate-terminal-blink">_</p>
            </div>
          </div>
          <!-- Pane 3 -->
          <div class="bg-[#0a0a0f]/90 border border-white/5 rounded-r-lg p-3 font-mono text-[10px] flex flex-col relative">
            <div class="absolute -left-[5px] top-10 w-[10px] h-[1px] bg-[#a855f7]/50"></div>
            <div class="text-[#f59e0b] border-b border-white/5 pb-2 mb-2 flex items-center justify-between">
              <span>[02_TESTS]</span><span class="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
            </div>
            <div class="text-text-muted space-y-1">
              <p>> Awaiting 01_LOGIC...</p>
            </div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Holographic Daemon Dashboard',
      body: 'Keeping track of resource constraints is vital when running local LLMs. Run <code>opta top</code> to open the Holographic TUI. It provides a real-time, high-density stream of active session memory banks, context shifting overhead, and VRAM pressure—rendering the normally invisible daemon operations into a beautiful, matrix-like control center.',
      visual: `<div class="visual-wrapper my-8 p-4 rounded-xl border border-[#22c55e]/30 bg-[#050f05] font-mono text-xs text-[#22c55e] leading-tight shadow-[0_0_20px_rgba(34,197,94,0.05)]">
        <div class="flex justify-between border-b border-[#22c55e]/30 pb-2 mb-3">
          <span class="font-bold flex items-center gap-2"><span class="w-2 h-2 bg-[#22c55e] rounded-sm animate-pulse"></span> OPTA-TOP v2.1.0</span>
          <span>UP: 04:12:33</span>
        </div>
        <div class="grid grid-cols-2 gap-8 mb-4">
          <div>
            <div class="text-[#22c55e]/50 mb-1">VRAM PRESSURE [LMX]</div>
            <div class="flex items-center gap-2">
              <div class="w-full h-3 bg-[#22c55e]/10 border border-[#22c55e]/30 p-0.5">
                <div class="h-full bg-[#a855f7]" style="width: 82%"></div>
              </div>
              <span>28GB/32GB</span>
            </div>
          </div>
          <div>
            <div class="text-[#22c55e]/50 mb-1">REQ / SEC</div>
            <div class="text-xl font-bold text-white text-shadow-glow">142<span class="text-[#22c55e] text-sm font-normal">.4</span></div>
          </div>
        </div>
        <table class="w-full text-left">
          <thead class="text-[#22c55e]/50 border-b border-[#22c55e]/20">
            <tr><th class="font-normal pb-1">PID</th><th class="font-normal pb-1">SESSION</th><th class="font-normal pb-1">MODEL</th><th class="font-normal pb-1 text-right">TOK/S</th></tr>
          </thead>
          <tbody class="text-white/90">
            <tr><td class="pt-2">9102</td><td class="pt-2 flex items-center gap-2 text-[#a855f7]"><span class="w-1.5 h-1.5 rounded-full bg-[#a855f7]"></span> ctx-map</td><td class="pt-2 text-[#06b6d4]">deepseek-r1</td><td class="pt-2 text-right">45.2</td></tr>
            <tr><td class="pt-1 text-[#22c55e]/70">8841</td><td class="pt-1 text-[#22c55e]/70">idle-worker</td><td class="pt-1 text-[#22c55e]/70">llama3-8b</td><td class="pt-1 text-right text-[#22c55e]/70">0.0</td></tr>
          </tbody>
        </table>
      </div>`
    }
  ],
};