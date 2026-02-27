"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Cpu,
  Terminal as TerminalIcon,
  Zap,
  Settings,
  Send,
  Database,
  Network,
} from "lucide-react";

import { useConnectionContextSafe } from "@/components/shared/ConnectionProvider";
import type { ServerStatus } from "@/types/lmx";

// --- Framer Motion Variants for "Ignition" Sequence ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

// --- Reusable Obsidian Panel with Momentum Border ---
const ObsidianPanel = ({
  children,
  className = "",
  noPadding = false,
}: {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) => {
  return (
    <motion.div
      variants={itemVariants}
      className={`group relative overflow-hidden rounded-xl bg-[rgba(5,3,10,0.8)] backdrop-blur-xl border border-white/5 transition-all duration-500 hover:bg-[rgba(10,6,20,0.85)] hover:border-white/10 ${className}`}
    >
      {/* Momentum Border Glow Lines */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-20">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-momentum-x" />
        <div className="absolute bottom-0 right-0 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent animate-momentum-x-reverse" />
        <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent animate-momentum-y" />
        <div className="absolute bottom-0 left-0 w-[1px] h-full bg-gradient-to-b from-transparent via-purple-500 to-transparent animate-momentum-y-reverse" />
      </div>

      {/* Content */}
      <div className={`relative h-full w-full z-10 ${noPadding ? "" : "p-5"}`}>
        {children}
      </div>
    </motion.div>
  );
};

// --- Typography Helpers ---
const MoonlightHeading = ({
  children,
  className = "",
  as: Component = "h2",
}: any) => (
  <Component
    className={`font-semibold bg-clip-text text-transparent bg-[linear-gradient(135deg,#ffffff_0%,#ffffff_50%,rgba(168,85,247,0.5)_100%)] ${className}`}
  >
    {children}
  </Component>
);

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  // Real data integration
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const [status, setStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!client) return;

    // Initial fetch
    client.getStatus().then(setStatus).catch(console.error);

    // Set up polling since we don't have the SSE hook imported yet
    const interval = setInterval(() => {
      client.getStatus().then(setStatus).catch(console.error);
    }, 2000);

    return () => clearInterval(interval);
  }, [client]);

  if (!mounted) return null;

  const isOnline = !!client && !!status;
  const memoryPercent = status
    ? (status.vram_used_gb / status.vram_total_gb) * 100
    : 0;
  const activeModel = status?.loaded_models?.[0];

  return (
    <div className="min-h-screen w-full bg-[#09090b] text-neutral-200 overflow-hidden relative flex flex-col font-sans selection:bg-purple-500/30">
      {/* --- INJECTED CUSTOM CSS --- */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');
        
        body { font-family: 'Sora', sans-serif; }
        
        /* Film Grain Noise Overlay */
        .film-grain {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          pointer-events: none; z-index: 50; opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        /* Structural HUD Grid */
        .hud-grid {
          background-size: 4rem 4rem;
          background-image: 
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          mask-image: radial-gradient(circle at 50% 50%, black 20%, transparent 80%);
        }

        /* Momentum Border Animations */
        @keyframes momentum-x { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes momentum-x-reverse { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        @keyframes momentum-y { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes momentum-y-reverse { 0% { transform: translateY(100%); } 100% { transform: translateY(-100%); } }
        
        .animate-momentum-x { animation: momentum-x 3s linear infinite; }
        .animate-momentum-x-reverse { animation: momentum-x-reverse 3s linear infinite; }
        .animate-momentum-y { animation: momentum-y 3s linear infinite; }
        .animate-momentum-y-reverse { animation: momentum-y-reverse 3s linear infinite; }
        
        /* Neon Accents */
        .neon-green { color: #34d399; text-shadow: 0 0 10px rgba(52, 211, 153, 0.6); }
        .neon-amber { color: #fbbf24; text-shadow: 0 0 10px rgba(251, 191, 36, 0.6); }
        .neon-purple { color: #a855f7; text-shadow: 0 0 10px rgba(168, 85, 247, 0.6); }
        .neon-red { color: #f87171; text-shadow: 0 0 10px rgba(248, 113, 113, 0.6); }
      `,
        }}
      />

      {/* --- ENVIRONMENT LAYERS --- */}
      <div className="absolute inset-0 hud-grid z-0" />
      <div className="film-grain" />

      {/* --- MAIN DASHBOARD LAYOUT --- */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex-1 flex p-6 gap-6 h-[calc(100vh-32px)] overflow-hidden"
      >
        {/* LEFT COLUMN: TELEMETRY & HARDWARE */}
        <section className="w-80 flex flex-col gap-6 shrink-0">
          {/* Header Identity */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-3 px-2"
          >
            <div className="w-8 h-8 rounded-md bg-white/10 flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
              <TerminalIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white leading-none">
                OPTA LMX
              </h1>
              <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
                Core Dashboard
              </span>
            </div>
          </motion.div>

          {/* Daemon Status Panel */}
          <ObsidianPanel>
            <div className="flex justify-between items-start mb-4">
              <MoonlightHeading
                as="h3"
                className="text-sm tracking-wide uppercase"
              >
                Daemon Status
              </MoonlightHeading>
              {isOnline ? (
                <Activity className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              ) : (
                <Activity className="w-4 h-4 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
              )}
            </div>
            <div className="flex flex-col gap-1 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">STATE</span>
                {isOnline ? (
                  <span className="neon-green">ONLINE</span>
                ) : (
                  <span className="neon-red">OFFLINE</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">LATENCY</span>
                <span className="text-neutral-300">
                  {connection?.latencyMs ? `${connection.latencyMs}ms` : "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">TYPE</span>
                <span className="text-neutral-300 uppercase">
                  {connection?.connectionType ?? "None"}
                </span>
              </div>
            </div>
          </ObsidianPanel>

          {/* Active Model Panel */}
          <ObsidianPanel>
            <div className="flex justify-between items-start mb-4">
              <MoonlightHeading
                as="h3"
                className="text-sm tracking-wide uppercase"
              >
                Active Matrix
              </MoonlightHeading>
              <Database className="w-4 h-4 text-white/50 group-hover:text-purple-400 transition-colors" />
            </div>
            {activeModel ? (
              <>
                <div className="bg-[#000000]/40 border border-white/5 rounded-lg p-3 mb-3">
                  <div
                    className="font-mono text-xs text-purple-300 mb-1 truncate"
                    title={activeModel.id}
                  >
                    {activeModel.id}
                  </div>
                  <div className="font-mono text-[10px] text-neutral-500">
                    LOADED
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider">
                    Ready
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="bg-[#000000]/40 border border-white/5 rounded-lg p-3 mb-3">
                  <div className="font-mono text-xs text-neutral-500 mb-1">
                    No model loaded
                  </div>
                  <div className="font-mono text-[10px] text-neutral-600">
                    -
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-neutral-600" />
                  <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                    Standby
                  </span>
                </div>
              </>
            )}
          </ObsidianPanel>

          {/* Apple Silicon Memory Pressure */}
          <ObsidianPanel>
            <div className="flex justify-between items-start mb-4">
              <MoonlightHeading
                as="h3"
                className="text-sm tracking-wide uppercase"
              >
                Silicon Pressure
              </MoonlightHeading>
              <Cpu className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
            </div>

            {/* Unified Memory Bar */}
            <div className="mb-4">
              <div className="flex justify-between font-mono text-[10px] mb-2">
                <span className="text-neutral-400">UNIFIED MEMORY</span>
                <span className="text-white">
                  {status
                    ? `${status.vram_used_gb.toFixed(1)} / ${status.vram_total_gb.toFixed(1)} GB`
                    : "- / -"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-purple-500/80 transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(memoryPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Neural Engine / GPU proxy */}
            <div>
              <div className="flex justify-between font-mono text-[10px] mb-2">
                <span className="text-neutral-400">ACTIVE REQUESTS</span>
                <span className="text-white">
                  {status?.active_requests ?? 0}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] transition-all duration-500"
                  style={{ width: status?.active_requests ? "100%" : "0%" }}
                />
              </div>
            </div>
          </ObsidianPanel>

          {/* Speed / Tokens */}
          <ObsidianPanel className="mt-auto flex-1 flex flex-col justify-center items-center relative">
            <Zap className="w-16 h-16 absolute opacity-5 text-purple-500 right-4 top-4" />
            <div className="text-5xl font-light font-mono tracking-tighter text-white mb-1">
              {status?.tokens_per_second?.toFixed(1) ?? "0.0"}
            </div>
            <div className="text-xs font-mono tracking-widest text-neutral-500 uppercase">
              Tokens / Sec
            </div>
          </ObsidianPanel>
        </section>

        {/* CENTER/RIGHT: MAIN INFERENCE TERMINAL */}
        <ObsidianPanel
          className="flex-1 flex flex-col shadow-2xl shadow-black/50"
          noPadding
        >
          {/* Terminal Header */}
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#000000]/20">
            <div className="flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/10 hover:bg-red-500/80 transition-colors cursor-pointer" />
                <div className="w-3 h-3 rounded-full bg-white/10 hover:bg-amber-500/80 transition-colors cursor-pointer" />
                <div className="w-3 h-3 rounded-full bg-white/10 hover:bg-emerald-500/80 transition-colors cursor-pointer" />
              </div>
              <div className="h-4 w-[1px] bg-white/10" />
              <div className="font-mono text-xs tracking-wider text-neutral-400">
                inference_tty1
              </div>
            </div>
            <button className="p-2 hover:bg-white/5 rounded-md transition-colors text-neutral-500 hover:text-white">
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Terminal Output Area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 font-sans text-sm">
            {/* Example User Message */}
            <div className="self-end max-w-[80%]">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm px-5 py-4 text-neutral-200">
                Execute a standard architectural review of the current memory
                dump. Look for anomalies in the neural cache allocations.
              </div>
            </div>

            {/* Example System/AI Message */}
            <div className="self-start max-w-[80%] flex gap-4">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-1">
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="bg-transparent text-neutral-300 leading-relaxed pt-2">
                <p className="mb-4">
                  Acknowledged. Scanning neural cache allocations within the
                  unified memory architecture...
                </p>
                <div className="font-mono text-xs bg-[#000000]/50 border border-white/5 rounded-md p-4 mb-4 text-neutral-400">
                  <span className="text-purple-400">0x1F2A90</span>: Nominal
                  allocation block.
                  <br />
                  <span className="text-emerald-400">0x1F2B00</span>: KV Cache
                  hit rate 98.4%.
                  <br />
                  <span className="neon-amber">0x1F2C40</span>: Warning -
                  fragmentation detected in context window block 4.
                </div>
                <p>
                  The system is performing optimally, though context window
                  block 4 shows minor fragmentation. No immediate restructuring
                  required.
                </p>
              </div>
            </div>
          </div>

          {/* Terminal Input Area */}
          <div className="p-4 bg-[#000000]/40 border-t border-white/5">
            <div className="relative group/input">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-transparent rounded-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-500 blur-md pointer-events-none" />
              <div className="relative flex items-end bg-[#09090b] border border-white/10 rounded-xl overflow-hidden focus-within:border-purple-500/50 transition-colors duration-300">
                <textarea
                  placeholder="Initiate command sequence..."
                  className="w-full bg-transparent p-4 outline-none text-sm text-white resize-none min-h-[56px] max-h-40 placeholder:text-neutral-600 font-sans"
                  rows={1}
                />
                <div className="p-2">
                  <button className="h-10 w-10 bg-white/5 hover:bg-white/10 text-white rounded-lg flex items-center justify-center transition-colors border border-white/5">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 px-2">
              <span className="font-mono text-[10px] text-neutral-600">
                SHIFT + ENTER for new line
              </span>
              <span className="font-mono text-[10px] text-neutral-600 flex items-center gap-1">
                <Network className="w-3 h-3" /> LOCAL_INFERENCE_ONLY
              </span>
            </div>
          </div>
        </ObsidianPanel>
      </motion.main>

      {/* --- BOTTOM FULL-WIDTH DATA ROW --- */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="h-8 w-full border-t border-white/10 bg-[#09090b]/80 backdrop-blur-xl flex items-center px-6 font-mono text-[10px] tracking-widest text-neutral-500 relative z-20 shrink-0"
      >
        <div className="flex items-center gap-8 w-full">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-white font-medium">SYS.NOMINAL</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                <span className="text-white font-medium">SYS.OFFLINE</span>
              </>
            )}
          </div>
          <div className="hidden md:block w-px h-3 bg-white/10" />
          <div className="hidden md:block" title={connection?.baseUrl}>
            {connection?.baseUrl
              ?.replace("http://", "")
              .replace("https://", "") ?? "DISCONNECTED"}
          </div>
          <div className="hidden md:block w-px h-3 bg-white/10" />
          <div className="hidden lg:block">CTX_WIN: 4096 / 8192</div>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <span className="neon-amber">TEMP: 42°C</span>
            <div className="w-px h-3 bg-white/10" />
            <span className="text-white">OPTA.OS v5.0.1</span>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
