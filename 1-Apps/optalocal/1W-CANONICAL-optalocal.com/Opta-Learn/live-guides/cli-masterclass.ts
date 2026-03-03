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
    },
    {
      heading: 'The Opta Browser & Visual Automation',
      body: 'Agentic tasks frequently require interacting with the outside world. By running <code>opta do --browser</code>, the CLI spins up an automated Chromium instance equipped with a custom <strong>Opta Chrome Overlay</strong>. The agent natively navigates websites, extracts DOM data, and interacts with complex UIs just like a human, while providing a clear visual indicator of its active operations.',
      visual: `<div class="visual-wrapper my-8 relative rounded-xl border border-white/10 bg-[#0f1115] overflow-hidden shadow-2xl">
        <!-- Browser Header -->
        <div class="h-8 bg-[#1a1b22] border-b border-white/10 flex items-center px-4 gap-4">
          <div class="flex gap-1.5"><div class="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div><div class="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div><div class="w-2.5 h-2.5 rounded-full bg-[#22c55e]"></div></div>
          <div class="flex-1 max-w-sm h-5 bg-white/5 rounded mx-auto border border-white/10 flex items-center px-2 text-[10px] text-text-muted font-mono justify-center">github.com/optalocal</div>
        </div>
        <!-- Browser Content -->
        <div class="relative h-48 bg-white/5 p-4">
          <div class="w-3/4 h-32 bg-[#1a1b22] border border-white/5 rounded shadow-sm mx-auto mt-4 p-4 flex flex-col gap-3">
             <div class="w-1/3 h-4 bg-white/10 rounded"></div>
             <div class="w-full h-2 bg-white/5 rounded"></div>
             <div class="w-5/6 h-2 bg-white/5 rounded"></div>
             <div class="mt-auto flex gap-2"><div class="w-16 h-6 bg-[#22c55e]/20 rounded border border-[#22c55e]/40"></div></div>
          </div>
          <!-- Opta Chrome Overlay -->
          <div class="absolute inset-0 pointer-events-none">
             <!-- Cursor -->
             <div class="absolute top-[85px] left-[180px] z-20 flex flex-col items-start drop-shadow-lg animate-pulse">
                <svg class="w-4 h-4 text-[#f59e0b] drop-shadow-[0_0_5px_rgba(245,158,11,1)]" fill="currentColor" viewBox="0 0 320 512"><path d="M302.189 329.126H196.105l55.831 135.993c3.889 9.428-.555 19.999-9.444 23.999l-22.333 10c-8.889 3.889-19.444-.555-23.333-9.444l-53.596-130.546L114.4 456.227c-7.222 6.666-17.777 6.666-25 0-4.444-4.444-6.666-10-6.666-16.111V43.896c0-6.111 2.222-11.667 6.666-16.111 7.222-6.666 17.778-6.666 25 0l200.555 193.889c6.666 6.111 8.889 15.555 5.555 24.444-3.333 8.333-11.666 13.889-20.555 13.889z"></path></svg>
                <div class="mt-1 px-2 py-0.5 bg-[#f59e0b] text-void text-[9px] font-bold rounded-sm shadow-[0_0_10px_rgba(245,158,11,0.5)] whitespace-nowrap">Agent Active: click()</div>
             </div>
             <!-- Highlight -->
             <div class="absolute top-[125px] left-[150px] w-20 h-8 border-2 border-[#f59e0b] bg-[#f59e0b]/10 rounded z-10 box-border"></div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Atpo: Critical Code Analyzer',
      body: 'To ensure maximum code quality, invoke Opta\'s partner persona via <code>/atpo</code>. Atpo is an abrasive, hyper-critical analyzer that evaluates your repository across 5 rigorous dimensions (Performance, Quality, Consistency, Architecture, Security) and generates a structured GenUI HTML report before handing execution targets back to Opta.',
      visual: `<div class="visual-wrapper my-8 p-5 rounded-xl border border-white/10 bg-void font-mono text-sm relative overflow-hidden group">
        <div class="absolute right-0 top-0 w-32 h-32 bg-[#ef4444]/10 rounded-full blur-[40px] -z-10 group-hover:bg-[#ef4444]/20 transition-all duration-700"></div>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/40 flex items-center justify-center text-[#ef4444] font-bold shadow-[0_0_10px_rgba(239,68,68,0.3)]">AT</div>
          <div class="text-white/90 font-bold tracking-wide">OPTA GENUI REPORT</div>
        </div>
        <div class="grid grid-cols-4 gap-2 mb-4">
          <div class="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded p-2 text-center text-[#ef4444]">
            <div class="text-lg font-bold">2</div><div class="text-[9px] uppercase">Critical</div>
          </div>
          <div class="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded p-2 text-center text-[#f59e0b]">
            <div class="text-lg font-bold">7</div><div class="text-[9px] uppercase">High</div>
          </div>
          <div class="bg-[#eab308]/10 border border-[#eab308]/30 rounded p-2 text-center text-[#eab308]">
            <div class="text-lg font-bold">14</div><div class="text-[9px] uppercase">Medium</div>
          </div>
          <div class="bg-[#06b6d4]/10 border border-[#06b6d4]/30 rounded p-2 text-center text-[#06b6d4]">
            <div class="text-lg font-bold">5</div><div class="text-[9px] uppercase">Minor</div>
          </div>
        </div>
        <div class="border-t border-white/5 pt-3 space-y-2">
          <div class="flex items-start gap-2 bg-[#ef4444]/5 p-2 rounded">
             <div class="w-2 h-2 rounded-full bg-[#ef4444] mt-1 shrink-0"></div>
             <div><div class="text-xs text-[#ef4444]">auth.ts:142</div><div class="text-[10px] text-text-muted mt-0.5">Race condition detected in session token refresh logic. High risk of 401s under load.</div></div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Opta Accounts & Identity',
      body: 'Opta CLI integrates directly with <code>accounts.optalocal.com</code>. Run <code>opta login</code> to securely pull your Cloud identity, LMX API keys, tool configurations, and autonomy presets into your local machine. This guarantees a unified session experience across all Opta Local apps via Supabase SSO.',
      visual: `<div class="visual-wrapper my-8 relative flex items-center justify-between px-8 py-10 rounded-xl border border-white/10 bg-[#0a0a0f]">
        <!-- Left: CLI -->
        <div class="flex flex-col items-center gap-2 relative z-10 w-24">
           <div class="w-12 h-12 rounded-xl bg-void border border-white/20 flex items-center justify-center shadow-lg">
             <svg class="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
           </div>
           <span class="font-mono text-xs text-text-muted">Opta CLI</span>
        </div>
        <!-- Middle: Flow -->
        <div class="flex-1 px-4 relative">
           <div class="absolute top-[8px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#06b6d4]/50 to-transparent border-dashed"></div>
           <div class="absolute top-[28px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#22c55e]/50 to-transparent border-dashed"></div>
           <div class="w-full flex justify-center text-[10px] font-mono text-[#06b6d4] absolute -top-2">Browser Auth Callback</div>
           <div class="w-full flex justify-center text-[10px] font-mono text-[#22c55e] absolute top-8">Secure Token Sync</div>
        </div>
        <!-- Right: Accounts -->
        <div class="flex flex-col items-center gap-2 relative z-10 w-24">
           <div class="w-12 h-12 rounded-xl bg-void border border-[#06b6d4]/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.15)] relative overflow-hidden">
             <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#06b6d4]/20 to-transparent"></div>
             <svg class="w-6 h-6 text-[#06b6d4] relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
           </div>
           <span class="font-mono text-xs text-[#06b6d4]">Accounts</span>
        </div>
      </div>`
    },
    {
      heading: 'CEO Mode Orchestration',
      body: 'When solving massively complex tasks, the standard agent loop may get lost in the weeds. Run <code>opta do --ceo</code> to shift the AI\'s role from "worker" to "executive director". In CEO Mode, Opta does not write code. It drafts architectural strategies, spawns specialized child agents (e.g., Designer, Database, DevOps), reviews their PRs, and dictates the overall merge timeline.',
      visual: `<div class="visual-wrapper my-8 p-6 rounded-xl border border-white/10 bg-[#0a0a0f] relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/5 via-void to-void">
        <div class="flex flex-col items-center">
           <!-- CEO Node -->
           <div class="w-32 bg-void border border-[#f59e0b]/50 rounded-lg p-2.5 text-center shadow-[0_0_20px_rgba(245,158,11,0.15)] relative z-10 mb-8 backdrop-blur-md">
             <div class="text-[10px] text-[#f59e0b] uppercase font-bold tracking-widest mb-1">Director</div>
             <div class="font-mono text-xs text-white">CEO-Agent</div>
           </div>
           
           <!-- Tree Lines -->
           <div class="absolute top-[4.5rem] w-[70%] h-8 border-t border-l border-r border-[#f59e0b]/20 rounded-t-xl z-0"></div>
           <div class="absolute top-[4.5rem] w-[2px] h-8 bg-[#f59e0b]/20 z-0"></div>
           
           <!-- Workers -->
           <div class="grid grid-cols-3 gap-8 w-full relative z-10 px-4">
             <div class="bg-void border border-[#06b6d4]/30 rounded-lg p-2 text-center">
                <div class="text-[9px] text-[#06b6d4] uppercase">Sub-Task Alpha</div>
                <div class="font-mono text-[10px] text-text-muted mt-1">UX/UI</div>
             </div>
             <div class="bg-void border border-[#a855f7]/30 rounded-lg p-2 text-center">
                <div class="text-[9px] text-[#a855f7] uppercase">Sub-Task Beta</div>
                <div class="font-mono text-[10px] text-text-muted mt-1">Database</div>
             </div>
             <div class="bg-void border border-[#22c55e]/30 rounded-lg p-2 text-center">
                <div class="text-[9px] text-[#22c55e] uppercase">Sub-Task Gamma</div>
                <div class="font-mono text-[10px] text-text-muted mt-1">Infra</div>
             </div>
           </div>
        </div>
      </div>`
    },
    {
      heading: 'Long-term Autonomy (1hr+ Runs)',
      body: 'Opta is designed for endurance. While most agents crash or loop infinitely when left unattended, the Opta CLI utilizes advanced error-recovery state machines, self-correction protocol limits, and exponential backoff loops. You can assign a 60-minute background refactor, step away, and trust the daemon to navigate <code>npm ERR!</code> traps safely without nuking your directory.',
      visual: `<div class="visual-wrapper my-8 flex items-center justify-center p-8 rounded-xl border border-white/5 bg-void relative">
        <div class="relative w-48 h-48">
           <!-- Outer Ring -->
           <svg class="absolute inset-0 w-full h-full text-white/5 animate-[spin_10s_linear_infinite]" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 2"></circle></svg>
           <!-- Active Ring -->
           <svg class="absolute inset-0 w-full h-full text-[#06b6d4] drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" viewBox="0 0 100 100" style="transform: rotate(-90deg);"><circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="220" stroke-dashoffset="140"></circle></svg>
           <!-- Center Content -->
           <div class="absolute inset-0 flex flex-col items-center justify-center font-mono">
              <div class="text-2xl text-white font-light">48<span class="text-[10px] text-text-muted ml-1">MIN</span></div>
              <div class="text-[8px] text-[#06b6d4] tracking-widest mt-1 uppercase">Autonomy Loop</div>
           </div>
           
           <!-- State Dots -->
           <div class="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/20"></div>
           <div class="absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#06b6d4] shadow-[0_0_10px_#06b6d4]"></div>
           <div class="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20"></div>
           <div class="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/20"></div>
        </div>
      </div>`
    },
    {
      heading: 'Opta Benchmark Suite',
      body: 'Evaluate local hardware capabilities via the integrated benchmarking suite (<code>opta bench</code>). Built on a local Fastify and React runtime, it performs adversarial stress-tests comparing <code>Llama3</code> against <code>DeepSeek</code> across metrics like TOK/S, latency-to-first-token (TTFT), and structural logic consistency under heavy payload tasks like AI News synthesis.',
      visual: `<div class="visual-wrapper my-8 bg-[#0a0f0a] border border-[#22c55e]/20 p-5 rounded-xl font-mono text-xs shadow-[inset_0_0_20px_rgba(34,197,94,0.02)]">
        <div class="text-[#22c55e] border-b border-[#22c55e]/20 pb-2 mb-4 flex justify-between">
          <span>> opta bench --suite heavy</span>
          <span class="animate-pulse">RUNNING... [02/05]</span>
        </div>
        <div class="space-y-4 text-white/80">
          <div class="flex flex-col gap-1">
             <div class="flex justify-between text-[10px] text-text-muted"><span>DEEPSEEK-R1 (LMX)</span><span>92.4 TOK/S</span></div>
             <div class="w-full h-1.5 bg-[#22c55e]/10 rounded overflow-hidden"><div class="h-full bg-[#06b6d4]" style="width: 85%"></div></div>
          </div>
          <div class="flex flex-col gap-1">
             <div class="flex justify-between text-[10px] text-text-muted"><span>LLAMA-3-8B (LMX)</span><span>114.2 TOK/S</span></div>
             <div class="w-full h-1.5 bg-[#22c55e]/10 rounded overflow-hidden"><div class="h-full bg-[#f59e0b]" style="width: 100%"></div></div>
          </div>
          <div class="flex flex-col gap-1 opacity-50">
             <div class="flex justify-between text-[10px] text-text-muted"><span>GPT-4O-MINI (CLOUD)</span><span>45.1 TOK/S</span></div>
             <div class="w-full h-1.5 bg-[#22c55e]/10 rounded overflow-hidden"><div class="h-full bg-white/30" style="width: 40%"></div></div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Session & Context Management (RAG)',
      body: 'The CLI automatically serializes the semantic intent of your completed sessions into local vector storage. During future, unrelated tasks, if the Daemon detects similar stack traces or error archetypes, it uses <strong>Retrieval-Augmented Generation (RAG)</strong> to quietly inject your past successful debugging steps into the agent\'s prompt, saving countless tokens.',
      visual: `<div class="visual-wrapper my-8 p-6 rounded-xl border border-white/10 bg-void relative overflow-hidden flex items-center justify-center">
        <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        <div class="flex gap-8 relative z-10 items-center">
           <!-- active session -->
           <div class="w-32 bg-white/5 border border-white/10 p-3 rounded-lg flex flex-col gap-2 backdrop-blur-sm">
             <div class="text-[10px] text-text-muted font-mono">ACTIVE ID: e8f...</div>
             <div class="w-full h-1 bg-[#06b6d4] rounded shadow-[0_0_8px_#06b6d4]"></div>
             <div class="h-2 w-3/4 bg-white/10 rounded mt-1"></div>
           </div>
           
           <!-- RAG flow -->
           <div class="flex flex-col gap-1 absolute left-[43%] top-1/2 -translate-y-1/2 -translate-x-12 opacity-80 z-20">
             <div class="w-3 h-0.5 bg-[#a855f7] rounded translate-x-1 animate-[pulse_1.5s_ease-out_infinite]"></div>
             <div class="w-3 h-0.5 bg-[#a855f7] rounded translate-x-2 animate-[pulse_1.5s_ease-out_0.2s_infinite]"></div>
             <div class="w-3 h-0.5 bg-[#a855f7] rounded translate-x-3 animate-[pulse_1.5s_ease-out_0.4s_infinite]"></div>
           </div>

           <!-- memory banks -->
           <div class="flex flex-col gap-2">
             <div class="px-3 py-1 bg-[#a855f7]/10 border border-[#a855f7]/30 text-[#a855f7] text-[10px] font-mono rounded inline-flex items-center gap-2"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg> Past Fixed Bug #1</div>
             <div class="px-3 py-1 bg-white/5 border border-white/10 text-text-muted text-[10px] font-mono rounded inline-flex items-center gap-2"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg> PR Draft #12</div>
           </div>
        </div>
      </div>`
    },
    {
      heading: 'LMX Model Management',
      body: 'You do not need a secondary application to orchestrate your local weights. You can securely pull HuggingFace models (e.g., GGUF format) and configure system prompts directly through the CLI lifecycle commands like <code>opta models pull &lt;repo/name&gt;</code>. The daemon streams the multi-gigabyte files efficiently to your centralized cache path.',
      visual: `<div class="visual-wrapper my-8 bg-black border border-white/20 rounded-lg p-4 font-mono text-sm shadow-xl">
        <div class="text-text-muted mb-2">$ opta models pull deepseek-ai/DeepSeek-R1-Distill-Llama-8B</div>
        <div class="text-white/90 space-y-2 text-xs">
          <div class="flex items-center gap-2 text-[#06b6d4]"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Resolved manifest...</div>
          <div class="flex items-center gap-2 text-[#06b6d4]"><svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Checked local cache...</div>
          
          <div class="pt-2">
            <div class="flex justify-between text-text-muted mb-1">
              <span>model-00001-of-00008.safetensors</span>
              <span>2.1GB / 4.8GB (44%)</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex-1 font-mono text-white/50 tracking-[-2px] overflow-hidden text-clip whitespace-nowrap bg-void">
                <span class="text-white bg-white">##################</span>------------------------
              </div>
              <span class="text-white whitespace-nowrap">24 MB/s</span>
            </div>
          </div>
        </div>
      </div>`
    },
    {
      heading: 'Conclusion: The Local Development Orchestrator',
      body: 'The <strong>Opta CLI</strong> is not just a chat interface; it is a hyper-capable, local orchestration engine. It unifies all these disparate features—interactive steerage (Chat mode), autonomous agency (Do mode), Time-Travel rewind, multi-agent swarms, the ATPO critical analyzer, visual DOM interactions, and executive CEO mode—into a single terminal experience. The ultimate purpose of the CLI is to transform your local machine into a private, zero-latency software factory where models execute massive refactors natively alongside you without compromising security or context awareness.',
      visual: `<div class="visual-wrapper mt-8 mb-4 relative rounded-xl border border-white/20 bg-void overflow-hidden p-8 shadow-[0_0_40px_rgba(255,255,255,0.05)] text-center">
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_70%)]"></div>
        <div class="relative z-10 font-mono">
          <div class="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#22c55e] to-[#06b6d4] p-0.5 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.3)]">
            <div class="w-full h-full bg-void rounded-xl flex items-center justify-center">
              <span class="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#22c55e] to-[#06b6d4]">CLI</span>
            </div>
          </div>
          <h3 class="text-white text-lg font-bold mb-2">The Ultimate Local AI Engine</h3>
          <div class="flex flex-wrap justify-center gap-2 mt-6 max-w-lg mx-auto">
            <span class="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-text-muted">Interactive Chat</span>
            <span class="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-text-muted">Autonomous Do</span>
            <span class="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-text-muted">Time-Travel Rewind</span>
            <span class="px-2 py-1 bg-[#06b6d4]/10 border border-[#06b6d4]/20 rounded text-[10px] text-[#06b6d4]">Local Swarms</span>
            <span class="px-2 py-1 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded text-[10px] text-[#ef4444]">Atpo Analyzer</span>
            <span class="px-2 py-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded text-[10px] text-[#f59e0b]">CEO Mode</span>
            <span class="px-2 py-1 bg-[#a855f7]/10 border border-[#a855f7]/20 rounded text-[10px] text-[#a855f7]">LMX Backends</span>
          </div>
        </div>
      </div>`
    }
  ],
};