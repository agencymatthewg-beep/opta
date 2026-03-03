import type { Guide } from './index';

export const lmxMasterclass: Guide = {
  slug: 'lmx-masterclass',
  title: 'LMX Masterclass',
  app: 'lmx',
  category: 'reference',
  template: 'holistic-whole-app',
  summary: 'A deep dive into Opta LMX. Master Apple Silicon native inference, MLX tensor optimization, VRAM management, and zero-latency local execution.',
  tags: ['lmx', 'inference', 'mlx', 'apple-silicon', 'vram', 'masterclass'],
  updatedAt: '2026-03-04',
  sections: [
    {
      heading: 'Ecosystem Role',
      body: '<a href="/guides/lmx" class="app-link link-lmx">Opta LMX</a> is the foundational AI engine of the Opta ecosystem. It acts as a hyper-optimized, local inference server specifically engineered for Apple Silicon (M1/M2/M3/M4). Rather than the <a href="/guides/cli" class="app-link link-cli">Opta CLI</a> communicating with a cloud API, it streams requests via localhost to LMX, which computes the responses using your machine\'s native unified memory.',
      visual: `<div class="visual-wrapper my-8 relative flex items-center justify-between p-8 rounded-xl border border-white/10 bg-[#080510] overflow-hidden shadow-2xl">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.05)_0%,transparent_70%)] pointer-events-none"></div>
        
        <div class="flex flex-col items-center z-10 w-24">
          <div class="w-12 h-12 rounded-xl bg-void border border-[#22c55e]/30 flex items-center justify-center text-[#22c55e] font-bold shadow-[0_0_15px_rgba(34,197,94,0.1)]">CLI</div>
          <span class="text-[10px] font-mono text-text-muted mt-2">127.0.0.1:3456</span>
        </div>

        <div class="flex-1 relative h-16 mx-4">
          <div class="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-[#22c55e]/50 via-white/20 to-[#a855f7]/50 -translate-y-1/2"></div>
          <!-- Pulse dots -->
          <div class="absolute top-1/2 left-[20%] w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white] -translate-y-1/2 animate-[ping_2s_linear_infinite]"></div>
          <div class="absolute top-1/2 left-[70%] w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7] -translate-y-1/2 animate-[ping_2s_linear_0.5s_infinite]"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-4 text-[9px] font-mono text-white/50 tracking-widest uppercase">OpenAI Spec</div>
        </div>

        <div class="flex flex-col items-center z-10 w-32 relative">
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#a855f7]/20 to-void border border-[#a855f7]/40 flex items-center justify-center text-[#a855f7] font-bold text-xl shadow-[0_0_30px_rgba(168,85,247,0.2)]">LMX</div>
          <span class="text-[10px] font-mono text-text-muted mt-2">Metal GPU</span>
          <div class="absolute -right-4 -top-4 px-2 py-1 bg-[#a855f7]/20 text-[#a855f7] text-[8px] font-mono rounded border border-[#a855f7]/30">8.2k TOK/s</div>
        </div>
      </div>`
    },
    {
      heading: 'Native MLX Architecture',
      body: 'Unlike legacy wrappers that rely on llama.cpp or PyTorch (which often suffer from CPU bottlenecks or translation overhead), Opta LMX is built natively on top of Apple\'s <strong>MLX framework</strong>. MLX is designed from the ground up for Apple\'s Unified Memory Architecture (UMA). This allows LMX to stream tensor data directly between the CPU and the Metal GPU without costly memory copies across a PCIe bus.',
      visual: `<div class="visual-wrapper my-8 grid grid-cols-2 gap-6 font-mono text-sm">
        <div class="p-5 border border-white/10 rounded-xl bg-[rgba(239,68,68,0.05)] flex flex-col items-center text-center opacity-80">
          <div class="text-[#ef4444] text-xs font-bold mb-4 uppercase">Legacy (llama.cpp)</div>
          <div class="flex gap-4 mb-4">
            <div class="px-4 py-2 border border-white/20 rounded bg-void text-text-muted">RAM</div>
            <div class="flex items-center text-[#ef4444] animate-pulse">⟷</div>
            <div class="px-4 py-2 border border-[#ef4444]/30 rounded bg-void text-[#ef4444]">VRAM</div>
          </div>
          <div class="text-[10px] text-text-muted">High latency PCIe bus transfers required for every tensor slice.</div>
        </div>
        
        <div class="p-5 border border-[#a855f7]/30 rounded-xl bg-[rgba(168,85,247,0.05)] flex flex-col items-center text-center shadow-[0_0_20px_rgba(168,85,247,0.05)]">
          <div class="text-[#a855f7] text-xs font-bold mb-4 uppercase">Opta LMX</div>
          <div class="w-full max-w-[150px] mb-4">
            <div class="border-2 border-[#a855f7] p-2 rounded-lg bg-void text-[#a855f7] font-bold shadow-[0_0_15px_rgba(168,85,247,0.2)]">Unified Memory</div>
            <div class="flex justify-center -mt-1"><div class="w-[2px] h-4 bg-[#a855f7]"></div></div>
            <div class="flex justify-between border-t-2 border-[#a855f7] pt-2 px-2 text-xs text-text-muted">
               <span>CPU</span><span>GPU</span>
            </div>
          </div>
          <div class="text-[10px] text-[#a855f7]/80">Zero-copy tensor execution natively on Apple Silicon.</div>
        </div>
      </div>`
    },
    {
      heading: 'VRAM & Model Paging',
      body: 'Running large models locally requires strict memory discipline. LMX utilizes <strong>Dynamic Model Paging</strong>. If you load an 8B model (approx 5GB VRAM) and a 32B model (approx 20GB VRAM) on a 32GB Mac, LMX will proactively offload inactive model weights to high-speed NVMe swap space when the Context KV Cache expands, preventing OOM (Out of Memory) crashes without killing the daemon.',
      code: `opta serve logs\n\n[LMX-Core] VRAM threshold (85%) breached.\n[LMX-Core] Paging deepseek-r1-8b weights to NVMe (1.2GB/s)...\n[LMX-Core] Reserving 8GB for context KV cache.`
    },
    {
      heading: 'Context Routing & The KV Cache',
      body: 'When you are chatting in the <a href="/guides/code-desktop" class="app-link link-general">Opta Code Desktop</a>, your conversation history constantly grows. Re-evaluating the entire history for every new message is inefficient. LMX implements a persistent <strong>Key-Value (KV) Cache</strong> mapped to session IDs. When you send a new message, LMX only computes the new tokens and appends them to the pre-computed mathematical state of the previous conversation.',
      visual: `<div class="visual-wrapper my-8 p-6 rounded-xl border border-white/10 bg-void relative overflow-hidden">
        <div class="flex flex-col gap-4 max-w-md mx-auto">
           <div class="flex justify-between items-end text-xs font-mono text-text-muted mb-2">
              <span>Session KV State</span>
              <span>128k Limit</span>
           </div>
           
           <div class="w-full flex gap-1 h-8">
              <div class="bg-[#a855f7]/20 border border-[#a855f7]/50 rounded w-[40%] flex items-center justify-center text-[10px] text-[#a855f7] font-mono">Turn 1 (Cached)</div>
              <div class="bg-[#a855f7]/20 border border-[#a855f7]/50 rounded w-[25%] flex items-center justify-center text-[10px] text-[#a855f7] font-mono">Turn 2 (Cached)</div>
              <div class="bg-white/10 border border-white/20 rounded w-[15%] flex items-center justify-center text-[10px] text-white font-mono animate-pulse">Computing...</div>
           </div>
           
           <div class="flex items-center gap-3 mt-4 text-[10px] font-mono text-text-muted bg-white/5 p-3 rounded border border-white/5">
             <div class="w-2 h-2 rounded-full bg-[#22c55e]"></div>
             <span>Time to First Token (TTFT) optimized from 4.2s to 120ms via cache hit.</span>
           </div>
        </div>
      </div>`
    }
  ],
};