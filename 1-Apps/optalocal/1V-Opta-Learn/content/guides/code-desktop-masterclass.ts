import type { Guide } from './index';

export const codeDesktopMasterclass: Guide = {
  slug: 'code-desktop-masterclass',
  title: 'Code Desktop Masterclass',
  app: 'general',
  category: 'reference',
  template: 'holistic-whole-app',
  summary: 'A definitive guide to the Opta Code native application. Explore Tauri architecture, global telemetry, timeline virtualization, and desktop integration.',
  tags: ['desktop', 'tauri', 'ui', 'composer', 'telemetry', 'masterclass'],
  updatedAt: '2026-03-04',
  sections: [
    {
      heading: 'Ecosystem Role',
      body: '<a href="/guides/code-desktop" class="app-link link-general">Opta Code Desktop</a> is the canonical, high-fidelity visual interface for the Opta ecosystem. Built with Tauri v2, React 18, and Vite, it acts as a native macOS and Windows wrapper over the underlying <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> daemon. It does not run inference or orchestrate agents itself; it acts purely as a stateless viewport into the daemon\'s brain.',
      visual: `<div class="visual-wrapper my-8 p-6 rounded-xl border border-white/10 bg-[#09090b] relative overflow-hidden flex items-center justify-center gap-8">
        <div class="absolute inset-0 bg-[linear-gradient(45deg,rgba(34,197,94,0.03)_25%,transparent_25%,transparent_50%,rgba(34,197,94,0.03)_50%,rgba(34,197,94,0.03)_75%,transparent_75%,transparent)] bg-[length:24px_24px]"></div>
        
        <!-- Desktop App -->
        <div class="w-40 relative z-10 flex flex-col gap-2">
          <div class="h-32 bg-[#18181b] border border-white/20 rounded-lg shadow-2xl flex flex-col overflow-hidden">
             <div class="h-6 bg-white/5 border-b border-white/10 flex items-center px-2 gap-1.5">
               <div class="w-2 h-2 rounded-full bg-[#ef4444]"></div><div class="w-2 h-2 rounded-full bg-[#f59e0b]"></div><div class="w-2 h-2 rounded-full bg-[#22c55e]"></div>
             </div>
             <div class="flex-1 p-2 flex flex-col justify-end gap-1 relative">
                <div class="w-3/4 h-2 bg-white/10 rounded"></div>
                <div class="w-full h-4 bg-[#22c55e]/20 rounded border border-[#22c55e]/30 mt-2"></div>
             </div>
          </div>
          <span class="text-center font-mono text-[10px] text-text-muted">Opta Desktop (Tauri)</span>
        </div>
        
        <!-- WebSocket connection -->
        <div class="flex-1 relative z-10 flex flex-col items-center">
           <div class="text-[10px] font-mono text-[#06b6d4] mb-1 bg-[#06b6d4]/10 px-2 py-0.5 rounded border border-[#06b6d4]/20">WebSocket :3456</div>
           <div class="w-full flex justify-between items-center text-white/30 text-xs">
              <span>← State</span><span>Commands →</span>
           </div>
           <div class="w-full h-[2px] bg-white/10 mt-1 relative">
              <div class="absolute top-0 left-0 w-1/3 h-full bg-[#06b6d4] rounded shadow-[0_0_8px_#06b6d4] animate-[pulse_1s_ease-in-out_infinite]"></div>
           </div>
        </div>
        
        <!-- Daemon -->
        <div class="w-24 relative z-10 flex flex-col gap-2 items-center">
           <div class="w-16 h-16 bg-void border border-white/20 rounded-full flex items-center justify-center font-mono text-xs shadow-[0_0_20px_rgba(255,255,255,0.1)]">
             Daemon
           </div>
           <span class="text-center font-mono text-[10px] text-text-muted">Node.js</span>
        </div>
      </div>`
    },
    {
      heading: 'The Dynamic Composer',
      body: 'The heart of the Desktop UI is the <strong>Composer</strong>. This isn\'t just a text box; it is an intelligent context router. Inline pills above the input field allow you to inject per-turn overrides. You can instantly switch a single message from the fast local <code>LMX</code> provider to a universal provider like <code>DeepSeek</code>, or toggle "Dangerous Mode" on/off for specific shell executions without altering your global config.',
      visual: `<div class="visual-wrapper my-8 p-4 rounded-xl border border-white/10 bg-[#18181b] shadow-inner max-w-lg mx-auto">
        <div class="flex gap-2 mb-3">
          <div class="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[10px] font-mono flex items-center gap-1 text-[#22c55e]">
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            DO MODE
          </div>
          <div class="px-2 py-1 bg-[#a855f7]/10 border border-[#a855f7]/30 rounded-md text-[10px] font-mono flex items-center gap-1 text-[#a855f7]">
            DeepSeek (Universal)
          </div>
          <div class="px-2 py-1 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-md text-[10px] font-mono flex items-center gap-1 text-[#ef4444]">
            Level 4 (Dangerous)
          </div>
        </div>
        <div class="w-full h-24 bg-void border border-white/5 rounded-lg p-3 font-mono text-xs text-text-secondary flex flex-col justify-between">
          <span>Write a deployment script and push it...|</span>
          <div class="self-end text-[9px] text-white/30">Cmd + Enter to Send</div>
        </div>
      </div>`
    },
    {
      heading: 'Holographic Telemetry Dashboard',
      body: 'Replacing the raw terminal output, the Desktop App features a "Neon Nodes" aesthetic <strong>Telemetry Dashboard</strong>. It listens to the daemon\'s <code>v3</code> HTTP endpoints to visualize live tool progress bars, sub-agent dependency graphs, and resource usage. If <a href="/guides/lmx" class="app-link link-lmx">LMX</a> spikes your GPU VRAM, you will see it visually represented in the side-panel in real-time.',
      code: `// Daemon Emits:\n{\n  "type": "telemetry",\n  "metrics": { "vramUtilized": 28, "vramTotal": 32, "tokensPerSec": 94.2 }\n}`
    },
    {
      heading: 'Timeline Virtualization & Hydration',
      body: 'High-throughput local models can stream hundreds of tokens per second. Standard React applications crash under this DOM thrashing. Opta Code utilizes a custom <code>useStreamingMarkdown</code> hook to debounce raw markdown streams, paired with <code>react-window/virtuoso</code> to aggressively unmount off-screen chat cards. If you restart the app, it instantly hydrates its state from the persistent daemon, exactly where you left off.',
      visual: `<div class="visual-wrapper my-8 relative rounded-xl border border-white/10 bg-void p-6 flex flex-col gap-2 overflow-hidden h-48">
        <div class="absolute right-2 top-2 bottom-2 w-1.5 bg-white/5 rounded-full overflow-hidden">
           <div class="w-full h-1/3 bg-white/20 rounded-full mt-8"></div>
        </div>
        
        <div class="p-3 bg-white/5 border border-white/5 rounded-lg opacity-30 text-[10px] font-mono flex justify-between">
           <span>Virtual Node (Unmounted)</span><span>-200 DOM elements</span>
        </div>
        <div class="p-3 bg-white/5 border border-white/5 rounded-lg opacity-30 text-[10px] font-mono flex justify-between">
           <span>Virtual Node (Unmounted)</span><span>-150 DOM elements</span>
        </div>
        <div class="p-4 bg-[#18181b] border border-white/20 rounded-lg shadow-lg text-xs flex flex-col gap-2 relative z-10">
           <div class="flex items-center gap-2 mb-1">
             <div class="w-4 h-4 rounded-full bg-[#06b6d4]"></div>
             <span class="font-bold">Active Node (Rendered)</span>
           </div>
           <div class="w-full h-1.5 bg-white/10 rounded"></div>
           <div class="w-5/6 h-1.5 bg-white/10 rounded"></div>
           <div class="w-1/2 h-1.5 bg-white/10 rounded"></div>
        </div>
      </div>`
    }
  ],
};