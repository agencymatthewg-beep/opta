"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const heroEase = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-12 overflow-hidden bg-grid-subtle">
      <div className="relative z-10 max-w-[1200px] mx-auto w-full text-center">

        {/* Status badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle mb-8"
          initial={{ opacity: 1, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: heroEase }}
        >
          <span className="status-live" aria-hidden="true" />
          <span className="text-sm text-text-secondary font-mono">Opta Local: production entrypoint to the Opta platform</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.05]"
          initial={{ opacity: 1, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: heroEase }}
        >
          <span className="text-moonlight">Optimization, Engineered for Production.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto mb-12 leading-relaxed"
          initial={{ opacity: 1, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: heroEase }}
        >
          Opta unifies runtime strategy, execution policy, and delivery
          surfaces into one operating layer. Opta Local is the deployable
          entrypoint: run Opta AI on private LMX infrastructure or cloud
          capacity, then execute consistently through Opta CLI and Opta Code.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-24"
          initial={{ opacity: 1, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: heroEase }}
        >
          <a
            href="https://init.optalocal.com"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-lg transition-[background-color,box-shadow,transform] font-medium text-base group glow-violet"
          >
            Start with Opta Init
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <div className="inline-flex items-center gap-2 px-5 py-3.5 glass rounded-lg font-mono text-sm text-neon-cyan select-all cursor-text">
            curl -sL optalocal.com/install | bash
          </div>
        </motion.div>

        {/* Core apps — stepped arc layout */}
        <motion.div
          className="flex flex-col lg:flex-row items-center lg:items-start justify-between w-full mx-auto px-2 sm:px-8 gap-6 lg:gap-8 relative pb-12"
          initial={{ opacity: 1, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: heroEase }}
        >
          {/* 1. Opta Init (Shifted Up) */}
          <a href="https://init.optalocal.com" aria-label="Open Opta Init" className="relative z-10 flex flex-col items-center gap-5 group cursor-pointer w-44 sm:w-52 lg:-mt-14 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.07] hover:-translate-y-3">
            <div className="w-16 h-16 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-primary blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-full"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/opta-init-mark.svg" className="w-12 h-12 transition-transform duration-500 group-hover:-rotate-[5deg]" alt="Opta Init" width={48} height={48} loading="eager" decoding="async" />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent mb-1.5">Opta Init</div>
              <div className="text-xs text-text-muted font-light leading-relaxed">Provision and govern the full Opta stack from one control plane.</div>
            </div>
          </a>

          {/* Center Group: LMX & Code */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-10 sm:gap-16 md:gap-20 relative z-10 mx-auto">

            {/* 2. Opta LMX */}
            <a href="https://lmx.optalocal.com" aria-label="Open Opta LMX" className="flex flex-col items-center gap-6 group cursor-pointer w-56 sm:w-64 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.05] hover:-translate-y-3">
              <div className="w-24 h-24 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-primary blur-2xl opacity-0 group-hover:opacity-25 transition-opacity duration-700 rounded-full"></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-lmx-mark.svg" className="w-20 h-20 drop-shadow-[0_10px_20px_rgba(139,92,246,0.2)] group-hover:drop-shadow-[0_15px_30px_rgba(139,92,246,0.6)] transition-[filter]" alt="Opta LMX" width={80} height={80} loading="eager" decoding="async" />
              </div>
              <div className="text-center">
              <div className="text-2xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent mb-2">Opta LMX</div>
              <div className="text-sm text-text-muted font-light leading-relaxed">Private Apple Silicon inference runtime for low-latency, data-resident workloads.</div>
            </div>
          </a>

            {/* 3. Opta Code */}
            <a href="https://help.optalocal.com/docs/code-desktop" aria-label="Open Opta Code docs" className="flex flex-col items-center gap-6 group cursor-pointer w-56 sm:w-64 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.05] hover:-translate-y-3">
              <div className="w-24 h-24 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-primary blur-2xl opacity-0 group-hover:opacity-25 transition-opacity duration-700 rounded-full"></div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-code-mark.svg" className="w-20 h-20 drop-shadow-[0_10px_20px_rgba(139,92,246,0.2)] group-hover:drop-shadow-[0_15px_30px_rgba(139,92,246,0.6)] transition-[filter]" alt="Opta Code" width={80} height={80} loading="eager" decoding="async" />
              </div>
              <div className="text-center">
              <div className="text-2xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent mb-2">Opta Code</div>
              <div className="text-sm text-text-muted font-light leading-relaxed">IDE-native execution surface for high-context engineering workflows.</div>
            </div>
          </a>
          </div>

          {/* 4. Opta CLI (Shifted Up) */}
          <a href="https://help.optalocal.com/docs/cli" aria-label="Open Opta CLI docs" className="relative z-10 flex flex-col items-center gap-5 group cursor-pointer w-44 sm:w-52 lg:-mt-14 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-[1.07] hover:-translate-y-3">
            <div className="w-16 h-16 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-primary blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-full"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/opta-cli-mark.svg" className="w-12 h-12 transition-transform duration-500 group-hover:rotate-[5deg]" alt="Opta CLI" width={48} height={48} loading="eager" decoding="async" />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent mb-1.5">Opta CLI</div>
              <div className="text-xs text-text-muted font-light leading-relaxed">Terminal-native automation surface for reproducible operations.</div>
            </div>
          </a>

        </motion.div>

      </div>
    </section>
  );
}
