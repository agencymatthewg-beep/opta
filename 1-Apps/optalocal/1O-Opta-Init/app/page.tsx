"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Box, Cpu, Shield, Database, Terminal, ChevronRight, Layers, Zap, Code2, Lock, Activity, Plug, Layout, Download, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { FEATURES, SHOWCASE_CONTENT, DOWNLOADS, DASHBOARD_URL } from "@/lib/constants";

// Icon mapper for features
const getIcon = (name: string) => {
  switch (name) {
    case 'shield': return <Shield className="w-5 h-5" />;
    case 'layout': return <Layout className="w-5 h-5" />;
    case 'layers': return <Layers className="w-5 h-5" />;
    case 'activity': return <Activity className="w-5 h-5" />;
    case 'cpu': return <Cpu className="w-5 h-5" />;
    case 'plug': return <Plug className="w-5 h-5" />;
    default: return <Box className="w-5 h-5" />;
  }
};

export default function Home() {
  const lineRevealX: Variants = {
    hidden: { scaleX: 0, originX: 0 },
    show: { scaleX: 1, transition: { duration: 1.5, ease: [0.77, 0, 0.175, 1] } }
  };
  
  const lineRevealY: Variants = {
    hidden: { scaleY: 0, originY: 0 },
    show: { scaleY: 1, transition: { duration: 1.5, ease: [0.77, 0, 0.175, 1] } }
  };

  const textUp: Variants = {
    hidden: { y: "100%", opacity: 0 },
    show: { y: "0%", opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };

  const fadeUp: Variants = {
    hidden: { y: 40, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100, damping: 20 } }
  };

  return (
    <div className="min-h-screen bg-void text-text-primary font-sans overflow-x-hidden selection:bg-primary/30 selection:text-white">
      <div className="film-grain"></div>
      
      {/* Opta Atmospheric Fog */}
      <div className="fixed inset-0 z-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.5)_0%,transparent_50%)] pointer-events-none"></div>
      <div className="fixed bottom-[-20%] left-[-10%] w-[600px] h-[600px] z-0 opacity-10 bg-[radial-gradient(circle,rgba(59,130,246,0.5)_0%,transparent_60%)] blur-3xl pointer-events-none"></div>
      
      {/* Structural HUD Grid Lines (Persistent Overlay) */}
      <motion.div initial="hidden" animate="show" variants={lineRevealY} className="fixed inset-y-0 left-[8%] w-px bg-gradient-to-b from-primary/50 via-neon-blue/20 to-transparent z-0 hidden md:block pointer-events-none" />
      <motion.div initial="hidden" animate="show" variants={lineRevealY} className="fixed inset-y-0 right-[8%] w-px bg-gradient-to-b from-primary/50 via-neon-blue/20 to-transparent z-0 hidden md:block pointer-events-none" />
      <motion.div initial="hidden" animate="show" variants={lineRevealX} className="fixed inset-x-0 top-[12%] h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent z-0 hidden md:block pointer-events-none" />
      
      {/* HEADER */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-void/50 border-b border-white/5">
        <div className="flex items-center justify-between px-[8%] py-6">
          <div className="font-bold text-lg tracking-tighter uppercase flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>
            </div>
            OPTA_INIT
          </div>
          <nav className="hidden md:flex gap-10 text-xs tracking-[0.2em] uppercase font-medium text-text-secondary">
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#showcase" className="hover:text-primary transition-colors">CLI</a>
            <a href="#install" className="hover:text-primary transition-colors">Install</a>
            <a href="#downloads" className="hover:text-primary transition-colors text-primary">Download</a>
          </nav>
        </div>
      </header>

      <main className="relative z-10 pt-40 pb-32">
        {/* --- HERO SECTION --- */}
        <motion.section 
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.1 }}
          className="px-[8%] grid grid-cols-1 md:grid-cols-12 gap-x-8 mb-40"
        >
          {/* Typographic Hero */}
          <div className="md:col-span-12 mb-20 relative">
            <div className="absolute -top-10 left-1/4 w-1 h-1 bg-white/40 rounded-full animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
            <div className="absolute top-20 right-1/3 w-1.5 h-1.5 bg-primary/40 rounded-full animate-[ping_6s_cubic-bezier(0,0,0.2,1)_infinite]"></div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary uppercase tracking-widest mb-8">
              <Zap className="w-3 h-3" /> Opta Local Stack v2.0
            </div>

            <h1 className="text-[10vw] leading-[0.9] font-bold tracking-tighter uppercase">
              <div className="overflow-hidden pb-4">
                <motion.div variants={textUp} className="text-moonlight">Deploy</motion.div>
              </div>
              <div className="overflow-hidden pb-4 ml-[8vw]">
                <motion.div variants={textUp}>
                  <span className="text-transparent" style={{ WebkitTextStroke: '1px rgba(168,85,247,0.6)' }}>Local</span>
                </motion.div>
              </div>
              <div className="overflow-hidden pb-4">
                <motion.div variants={textUp} className="text-moonlight">Intelligence.</motion.div>
              </div>
            </h1>
          </div>

          <div className="md:col-span-4 md:col-start-2">
            <motion.div variants={lineRevealX} className="h-px bg-white/10 w-full mb-8" />
            <motion.p variants={textUp} className="text-lg font-light leading-relaxed text-text-secondary">
              The definitive bootstrap for Apple Silicon AI. Run LLMs locally with our highly optimized, private inference stack. Zero cloud. Pure capability.
            </motion.p>
            
            <motion.a href="#install" variants={textUp} className="mt-12 group cursor-pointer inline-flex items-center gap-4 obsidian-interactive p-3 rounded-full pr-8 border border-white/10">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center drop-shadow-[0_0_12px_rgba(168,85,247,0.6)]">
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
              <span className="text-sm uppercase tracking-widest font-medium text-text-primary">
                Initialize System
              </span>
            </motion.a>
          </div>
        </motion.section>

        {/* --- APP SHOWCASE (CLI UI Mockups) --- */}
        <motion.section 
          id="showcase"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="px-[8%] mb-40 relative z-20"
        >
          <motion.div variants={fadeUp} className="mb-16 text-center">
            <h2 className="text-sm text-primary uppercase tracking-[0.2em] mb-4">Command Line Interface</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-moonlight">Visual Terminal App.</h3>
            <p className="mt-6 text-lg text-text-secondary font-light max-w-2xl mx-auto">
              A highly interactive TUI (Terminal User Interface). Navigate with menus, switch models, and chat—no complex arguments required.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Welcome Screen Mockup */}
            <motion.div variants={fadeUp} className="flex flex-col">
              <div className="glass-strong rounded-xl border border-white/10 overflow-hidden h-[300px] flex flex-col group">
                <div className="h-8 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                </div>
                <div className="p-6 font-mono text-xs flex-1 bg-[#0a0a0c] flex flex-col items-center justify-center relative">
                  <div className="text-primary mb-6 whitespace-pre leading-[1.2] text-[8px] sm:text-[10px] opacity-80 group-hover:opacity-100 transition-opacity">
                    {SHOWCASE_CONTENT.welcome.logo.join('\n')}
                  </div>
                  <div className="w-[180px] space-y-1">
                    <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">Quick Start</div>
                    {SHOWCASE_CONTENT.welcome.menuItems.map((item, i) => (
                      <div key={i} className={`flex justify-between px-2 py-1.5 rounded ${i === 0 ? 'bg-primary/20 text-primary' : 'text-text-secondary'}`}>
                        <span>{item.label}</span>
                        <span className="text-text-muted opacity-50">{item.shortcut}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 text-center">
                <h4 className="font-semibold text-text-primary">{SHOWCASE_CONTENT.welcome.heading}</h4>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">{SHOWCASE_CONTENT.welcome.caption}</p>
              </div>
            </motion.div>

            {/* Chat Mockup */}
            <motion.div variants={fadeUp} className="flex flex-col">
              <div className="glass-strong rounded-xl border border-white/10 overflow-hidden h-[300px] flex flex-col">
                <div className="h-8 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></div>
                  <span className="ml-auto text-[10px] text-text-muted font-mono">Opta — Chat</span>
                </div>
                <div className="p-6 font-mono text-[11px] flex-1 bg-[#0a0a0c] flex flex-col">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary self-start mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_5px_#22c55e]" /> {SHOWCASE_CONTENT.chat.model}
                  </div>
                  <div className="space-y-4">
                    {SHOWCASE_CONTENT.chat.messages.map((msg, i) => (
                      <div key={i}>
                        <div className={`mb-1 font-medium ${msg.role === 'user' ? 'text-neon-blue' : 'text-primary'}`}>
                          {msg.role === 'user' ? 'You' : 'Opta'}
                        </div>
                        <div className={`p-3 rounded-lg leading-relaxed ${msg.role === 'user' ? 'bg-white/5 text-text-primary' : 'bg-primary/5 text-text-secondary border border-primary/10'}`}>
                          {msg.text.split('\n').map((line, j) => <div key={j}>{line || <br />}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 text-center">
                <h4 className="font-semibold text-text-primary">{SHOWCASE_CONTENT.chat.heading}</h4>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">{SHOWCASE_CONTENT.chat.caption}</p>
              </div>
            </motion.div>

            {/* Menu Mockup */}
            <motion.div variants={fadeUp} className="flex flex-col">
              <div className="glass-strong rounded-xl border border-white/10 overflow-hidden h-[300px] flex flex-col">
                <div className="h-8 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]"></div>
                </div>
                <div className="p-6 font-mono text-[11px] flex-1 bg-[#0a0a0c] flex items-center justify-center">
                  <div className="w-full max-w-[220px] rounded-lg border border-white/10 bg-[#141419] p-3 shadow-2xl">
                    <div className="mb-3 text-[10px] uppercase tracking-widest text-text-muted">Select Model</div>
                    <div className="space-y-1">
                      {SHOWCASE_CONTENT.menu.items.map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 rounded px-2 py-1.5 ${item.active ? 'bg-primary/20 text-primary' : 'text-text-secondary'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-primary' : 'bg-transparent'}`} />
                          {item.label}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-[9px] text-text-muted text-center opacity-70">
                      {SHOWCASE_CONTENT.menu.hint}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 text-center">
                <h4 className="font-semibold text-text-primary">{SHOWCASE_CONTENT.menu.heading}</h4>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">{SHOWCASE_CONTENT.menu.caption}</p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* --- INSTALLATION SECTION --- */}
        <motion.section 
          id="install"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="px-[8%] mb-40 relative z-20"
        >
          <motion.div variants={fadeUp} className="obsidian rounded-2xl border border-white/10 overflow-hidden relative">
            <div className="momentum-border rounded-2xl absolute inset-0 opacity-50 pointer-events-none"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-12 lg:p-16 flex flex-col justify-center relative z-10">
                <div className="inline-flex items-center gap-2 text-neon-blue mb-6">
                  <Terminal className="w-5 h-5" />
                  <span className="text-sm font-mono uppercase tracking-widest">Bootstrap Command</span>
                </div>
                <h2 className="text-4xl font-bold mb-6 text-moonlight">One Command.<br/>Full Stack.</h2>
                <p className="text-text-secondary mb-10 font-light leading-relaxed">
                  Run the initialization script. We handle the Python environments, Node.js dependencies, MLX model pulling, and background daemon registration automatically.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-text-muted">
                    <CheckCircle2 className="w-4 h-4 text-neon-green" /> Requires macOS 13.0+
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-muted">
                    <CheckCircle2 className="w-4 h-4 text-neon-green" /> M1/M2/M3/M4 Apple Silicon
                  </div>
                  <div className="flex items-center gap-3 text-sm text-text-muted">
                    <CheckCircle2 className="w-4 h-4 text-neon-amber" /> 16GB Unified Memory minimum
                  </div>
                </div>
              </div>
              <div className="bg-[#05030a] p-8 lg:p-16 border-l border-white/5 flex flex-col justify-center font-mono">
                <div className="w-full rounded-xl border border-white/10 bg-[#0a0a0c] shadow-2xl overflow-hidden relative group">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  {/* Mac Window Controls */}
                  <div className="h-10 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/10"></div>
                    <div className="w-3 h-3 rounded-full bg-white/10"></div>
                    <div className="w-3 h-3 rounded-full bg-white/10"></div>
                    <div className="ml-auto text-[10px] text-text-muted">~ / opta-init</div>
                  </div>
                  <div className="p-6 text-sm text-text-secondary space-y-3 relative z-10">
                    <p className="flex items-center gap-3">
                      <span className="text-primary">❯</span>
                      <span className="text-white">curl -fsSL https://optalocal.com/init | bash</span>
                    </p>
                    <div className="pt-4 space-y-1 opacity-70">
                      <p className="text-neon-blue">==&gt; Provisioning Opta Environment...</p>
                      <p>==&gt; Checking hardware: <span className="text-neon-green">Apple M3 Max (128GB)</span></p>
                      <p>==&gt; Installing Opta CLI globally</p>
                      <p>==&gt; Setting up LMX Python environment</p>
                      <p>==&gt; Downloading default weights (4.2GB)</p>
                      <p className="text-neon-green mt-2">✔ System successfully initialized.</p>
                      <p className="text-text-muted mt-2">Run `opta tui` to open the dashboard.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* --- ARCHITECTURE SECTION --- */}
        <motion.section 
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="px-[8%] mb-40"
        >
          <motion.div variants={fadeUp} className="mb-16">
            <h2 className="text-sm text-primary uppercase tracking-[0.2em] mb-4">The Pipeline</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-moonlight">Layered Architecture</h3>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-[4.5rem] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent z-0"></div>

            {[
              { 
                step: "01",
                title: "Opta CLI Daemon", 
                icon: <Code2 className="w-5 h-5" />, 
                port: "127.0.0.1:9999",
                desc: "Session orchestration, permission gating, and event persistence. Proxies requests to LMX."
              },
              { 
                step: "02",
                title: "Opta LMX Server", 
                icon: <Layers className="w-5 h-5" />, 
                port: "127.0.0.1:1234",
                desc: "The core MLX inference server. OpenAI API-compatible. Automatically degrades on OOM rather than crashing."
              },
              { 
                step: "03",
                title: "Opta Local Web", 
                icon: <Box className="w-5 h-5" />, 
                port: "localhost:3004",
                desc: "React dashboard connecting directly to LMX. Runs in LAN mode or Cloud mode via Supabase auth."
              }
            ].map((node, i) => (
              <motion.div key={i} variants={fadeUp} className="relative z-10">
                <div className="obsidian p-8 rounded-2xl h-full border border-white/5 hover:border-primary/30 transition-colors group">
                  <div className="flex justify-between items-start mb-8">
                    <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center text-text-secondary group-hover:text-primary group-hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all">
                      {node.icon}
                    </div>
                    <span className="text-xs font-mono text-text-muted">{node.step}</span>
                  </div>
                  <h4 className="text-xl font-bold mb-3 text-text-primary">{node.title}</h4>
                  <div className="inline-block px-2 py-1 bg-white/5 rounded text-xs font-mono text-neon-blue mb-4 border border-neon-blue/10">
                    {node.port}
                  </div>
                  <p className="text-sm text-text-secondary font-light leading-relaxed">
                    {node.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* --- FEATURES GRID --- */}
        <motion.section 
          id="features"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="px-[8%] mb-40"
        >
          <motion.div variants={fadeUp} className="mb-16">
            <h2 className="text-sm text-primary uppercase tracking-[0.2em] mb-4">Capabilities</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-moonlight">Built for the Edge</h3>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <motion.div key={i} variants={fadeUp}>
                <div className="glass-subtle p-8 rounded-2xl h-full border border-white/5 hover:border-primary/20 transition-colors group">
                  <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center text-text-secondary mb-6 group-hover:text-primary group-hover:shadow-[0_0_15px_rgba(168,85,247,0.2)] transition-all">
                    {getIcon(feature.icon)}
                  </div>
                  <h4 className="text-lg font-bold mb-3 text-text-primary">{feature.title}</h4>
                  <p className="text-sm text-text-secondary font-light leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* --- DOWNLOADS SECTION --- */}
        <motion.section 
          id="downloads"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="px-[8%] mb-40"
        >
          <motion.div variants={fadeUp} className="text-center mb-16">
            <h2 className="text-sm text-primary uppercase tracking-[0.2em] mb-4">Direct Access</h2>
            <h3 className="text-4xl md:text-5xl font-bold text-moonlight">Download Packages</h3>
            <p className="mt-4 text-text-secondary font-light">Prefer manual installation? Grab the PKG files below.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {Object.entries(DOWNLOADS).map(([key, data]) => (
              <motion.div key={key} variants={fadeUp} className="obsidian p-8 rounded-2xl border border-white/10 hover:border-primary/40 transition-colors flex flex-col group">
                <div className="mb-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary font-mono text-xl font-bold flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    {key === 'cli' ? '>' : '~'}
                  </div>
                  <h3 className="text-2xl font-bold text-text-primary">{data.name}</h3>
                </div>
                <p className="text-text-secondary font-light leading-relaxed mb-8 flex-1">
                  {data.description}
                </p>
                
                <a href={data.macos} className="w-full h-12 rounded-lg bg-primary text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary-glow transition-colors">
                  <Download className="w-4 h-4" /> Download for macOS
                </a>
                <div className="text-center mt-4 text-xs text-text-muted uppercase tracking-widest">
                  Windows — Coming Soon
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* --- DASHBOARD CTA --- */}
        <motion.section 
          id="dashboard"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          variants={{ show: { transition: { staggerChildren: 0.1 } } }}
          className="px-[8%]"
        >
          <motion.div variants={fadeUp}>
            <div className="glass-strong border border-white/20 rounded-3xl p-16 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              {/* Internal glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
              
              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-bold mb-6 text-moonlight">Ready to manage your models?</h2>
                <p className="text-lg text-text-secondary font-light max-w-xl mx-auto mb-10">
                  Access your Web Dashboard to monitor performance, manage weights, and chat—all in a beautiful browser interface.
                </p>
                <a href={DASHBOARD_URL} className="inline-flex h-14 px-8 items-center justify-center gap-2 rounded-xl bg-white text-void font-bold text-lg hover:bg-white/90 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                  Open Web Dashboard <ArrowUpRight className="w-5 h-5" />
                </a>
              </div>
            </div>
          </motion.div>
        </motion.section>

      </main>

      <footer className="border-t border-white/5 bg-[#05030a] mt-24 relative z-20">
        <div className="max-w-7xl mx-auto px-[8%] py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 text-text-muted">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-light">Opta Operations © 2026. Secure by design.</span>
          </div>
          <div className="flex gap-8 text-sm font-medium tracking-wide text-text-secondary">
            <a href="#" className="hover:text-primary transition-colors">Manifesto</a>
            <a href="#" className="hover:text-primary transition-colors">Documentation</a>
            <a href="#" className="hover:text-primary transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
