"use client";

import { motion, useInView, Variants } from "framer-motion";
import { useRef } from "react";
import { Cloud, BarChart2, Cpu, Zap } from "lucide-react";

export function QuickStart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const item: Variants = {
    hidden: { opacity: 1, y: 0 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center">

        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
            Runtime to execution architecture
          </h2>
          <p className="text-xl text-text-secondary">
            How Opta Local turns model power into reliable delivery.
          </p>
        </motion.div>

        {/* The Pipeline */}
        <motion.div
          className="flex flex-col xl:flex-row items-stretch justify-center w-full gap-8 xl:gap-8 relative"
          variants={container}
          initial="visible"
          animate="visible"
        >

          {/* STAGE 1: Execution Engine */}
          <motion.div variants={item} className="flex flex-col gap-5 w-full xl:w-1/3">
            <h3 className="text-xs font-mono text-primary/80 uppercase tracking-widest mb-2">1. Runtime Sources</h3>

            {/* Cloud Models */}
            <div className="glass-subtle rounded-2xl p-6 transition-[transform,background-color] duration-500 hover:-translate-y-1 hover:bg-primary/5 h-full flex flex-col justify-center cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <Cloud className="w-6 h-6 text-primary" />
                <h3 className="text-lg font-bold text-white">Cloud API Route</h3>
              </div>
              <p className="text-sm text-text-secondary mb-4">Use provider APIs when you need external model capacity, long-context tasks, or hosted frontier models.</p>
              <div className="flex flex-wrap gap-2 text-[10px] sm:text-xs font-mono font-semibold text-text-muted uppercase">
                <span className="px-2 py-1 glass-subtle rounded">Claude 3.7</span>
                <span className="px-2 py-1 glass-subtle rounded">GPT-4o</span>
                <span className="px-2 py-1 glass-subtle rounded">Gemini</span>
              </div>
            </div>

            {/* Local LMX */}
            <div className="glass-subtle rounded-2xl p-6 transition-[transform,background-color] duration-500 hover:-translate-y-1 hover:bg-primary/5 h-full flex flex-col justify-center relative overflow-hidden cursor-default">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
              <div className="flex items-center gap-3 mb-3 relative z-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-lmx-mark.svg" className="w-6 h-6" alt="LMX" width={24} height={24} loading="lazy" decoding="async" />
                <h3 className="text-lg font-bold text-white">Opta LMX Local</h3>
                <span className="ml-auto px-2.5 py-0.5 bg-primary text-white text-[10px] font-bold uppercase rounded-full tracking-wider shadow-[0_0_15px_rgba(139,92,246,0.3)]">Private</span>
              </div>
              <p className="text-sm text-text-secondary mb-4 relative z-10">Use local inference on Apple Silicon when privacy, control, and predictable local execution are priorities.</p>
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-text-muted uppercase mt-auto relative z-10">
                <BarChart2 className="w-4 h-4 text-neon-cyan/70" />
                <span>Visualised via LMX Dashboard</span>
              </div>
            </div>
          </motion.div>

          {/* Connector */}
          <motion.div variants={item} className="hidden xl:flex flex-col justify-center w-12 shrink-0">
            <div className="h-[2px] w-full bg-gradient-to-r from-primary/10 to-primary/60 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-primary rotate-45 transform translate-x-1" />
            </div>
          </motion.div>

          {/* STAGE 2: The Daemon */}
          <motion.div variants={item} className="flex flex-col gap-5 w-full xl:w-1/3 justify-center">
            <h3 className="text-xs font-mono text-primary/80 uppercase tracking-widest mb-2">2. Opta AI Activation</h3>

            <div className="glass rounded-3xl p-8 transition-[transform,box-shadow] duration-700 hover:scale-[1.02] hover:-translate-y-2 relative overflow-hidden group shadow-[0_0_40px_rgba(139,92,246,0.1)] cursor-default">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.15)_0%,transparent_70%)] opacity-20 group-hover:opacity-100 transition-opacity duration-700"></div>

              <div className="flex flex-col items-center text-center relative z-10">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-500">
                  <Cpu className="w-8 h-8 text-[#c084fc]" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent mb-3">Opta AI Core</h3>
                <p className="text-base text-text-secondary leading-relaxed">
                  Opta AI keeps execution context, intent, and policy aligned so runtime and interface changes do not break workflow continuity.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Connector */}
          <motion.div variants={item} className="hidden xl:flex flex-col justify-center w-12 shrink-0">
            <div className="h-[2px] w-full bg-gradient-to-r from-primary/10 to-primary/60 relative">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-primary rotate-45 transform translate-x-1" />
            </div>
          </motion.div>

          {/* STAGE 3: Control Surfaces */}
          <motion.div variants={item} className="flex flex-col gap-5 w-full xl:w-1/3">
            <h3 className="text-xs font-mono text-primary/80 uppercase tracking-widest mb-2">3. Execution Surfaces</h3>

            {/* Opta CLI */}
            <div className="glass-subtle rounded-2xl p-6 transition-[transform,background-color] duration-500 hover:-translate-y-1 hover:bg-primary/5 h-full flex flex-col justify-center cursor-default">
              <div className="flex items-center gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-cli-mark.svg" className="w-6 h-6" alt="CLI" width={24} height={24} loading="lazy" decoding="async" />
                <h3 className="text-lg font-bold text-white">Opta CLI</h3>
              </div>
              <p className="text-sm text-text-secondary">Terminal-first execution surface for coding, automation, and operations workflows.</p>
            </div>

            {/* Opta Code */}
            <div className="glass-subtle rounded-2xl p-6 transition-[transform,background-color] duration-500 hover:-translate-y-1 hover:bg-primary/5 h-full flex flex-col justify-center cursor-default">
              <div className="flex items-center gap-3 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-code-mark.svg" className="w-6 h-6" alt="Code" width={24} height={24} loading="lazy" decoding="async" />
                <h3 className="text-lg font-bold text-white">Opta Code App</h3>
              </div>
              <p className="text-sm text-text-secondary">Desktop execution surface for coding sessions, project control, and richer interactive workflows.</p>
            </div>
          </motion.div>

        </motion.div>

        {/* Explanatory Text Below */}
        <motion.div
          className="mt-24 max-w-4xl mx-auto glass-subtle rounded-3xl p-8 md:p-10 relative overflow-hidden group"
          initial={{ opacity: 1, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent opacity-50"></div>
          <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Zap className="w-8 h-8 text-[#a855f7]" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">One coherent optimization chain</h3>
              <p className="text-base text-text-secondary leading-relaxed">
                Opta Local is intentionally structured as one system: runtime
                selection, Opta AI activation, and execution in CLI or Code.
                That structure reduces tool drift and keeps delivery predictable.
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
