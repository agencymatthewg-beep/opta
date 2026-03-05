"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-12 overflow-hidden bg-grid-subtle">
      <div className="relative z-10 max-w-[1400px] mx-auto w-full text-center">

        {/* Status badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-subtle border border-primary/20 mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="status-live" />
          <span className="text-sm text-text-secondary font-mono">System operational</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.05]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-white">Run autonomous AI.</span>
          <br />
          <span className="text-white">Build your business.</span>
          <br />
          <span className="text-white">Powered by </span><span className="text-moonlight">Cloud or Local.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          The intelligent operating system for mass audiences and developers alike. Run long-running money-making sessions via OpenAI/Anthropic, or switch to Opta LMX to run entirely private on Apple Silicon.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <a
            href="https://init.optalocal.com"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-medium text-base group glow-violet"
          >
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <div className="inline-flex items-center gap-2 px-5 py-3.5 glass border border-white/10 rounded-lg font-mono text-sm text-neon-cyan select-all cursor-text">
            curl -sL optalocal.com/install | bash
          </div>
        </motion.div>

        {/* Core apps — Stepped Arc Layout */}
        <motion.div
          className="flex flex-col xl:flex-row items-center justify-between w-full mx-auto px-4 sm:px-8 relative mt-20 sm:mt-24 pb-12"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* 1. Opta Init (Shifted Up) */}
          <a href="https://init.optalocal.com" className="relative z-10 flex flex-col items-center gap-6 group w-64 xl:-mt-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:-translate-y-4 mb-14 xl:mb-0">
            <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center relative">
              {/* Premium Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#8b5cf6]/30 via-[#c084fc]/20 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full scale-150 group-hover:scale-[2] mix-blend-screen -rotate-45"></div>
              <div className="absolute z-0 inset-0 bg-primary blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-700 rounded-full animate-pulse"></div>
              {/* Icon */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/opta-init-mark.svg" className="w-16 h-16 md:w-20 md:h-20 transition-all duration-700 group-hover:-rotate-6 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)] group-hover:drop-shadow-[0_0_25px_rgba(139,92,246,0.8)] relative z-10" alt="Init" />
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-[0_4px_15px_rgba(139,92,246,0.3)] mb-2 transition-all">Opta Init</div>
              <div className="text-sm text-text-muted font-light leading-relaxed group-hover:text-text-secondary transition-colors">Distribution + lifecycle manager.</div>
            </div>
          </a>

          {/* Center Group: LMX & Code */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-16 md:gap-24 relative z-10 mx-auto my-8 xl:my-0 mb-14 md:mb-0">

            {/* 2. Opta LMX */}
            <a href="https://lmx.optalocal.com" className="flex flex-col items-center gap-8 group w-72 md:w-80 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:-translate-y-4">
              <div className="w-40 h-40 md:w-48 md:h-48 flex items-center justify-center relative">
                {/* Premium Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#8b5cf6]/40 via-[#ec4899]/30 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full scale-110 group-hover:scale-[1.6] mix-blend-screen animate-pulse rotate-12"></div>
                <div className="absolute z-0 inset-0 bg-primary blur-[50px] opacity-20 group-hover:opacity-50 transition-all duration-700 rounded-full"></div>
                {/* Icon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-lmx-mark.svg" className="w-28 h-28 md:w-36 md:h-36 drop-shadow-[0_15px_30px_rgba(139,92,246,0.3)] group-hover:drop-shadow-[0_20px_40px_rgba(139,92,246,0.8)] transition-all duration-700 relative z-10 group-hover:scale-110" alt="LMX" />
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(139,92,246,0.4)] mb-3 transition-all tracking-tight">Opta LMX</div>
                <div className="text-base text-text-muted font-light leading-relaxed group-hover:text-text-secondary transition-colors">Local inference engine.</div>
              </div>
            </a>

            {/* 3. Opta Code */}
            <a href="https://help.optalocal.com/docs/opta-code" className="flex flex-col items-center gap-8 group w-72 md:w-80 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-105 hover:-translate-y-4">
              <div className="w-40 h-40 md:w-48 md:h-48 flex items-center justify-center relative">
                {/* Premium Glow */}
                <div className="absolute inset-0 bg-gradient-to-bl from-[#8b5cf6]/40 via-[#ec4899]/30 to-transparent blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full scale-110 group-hover:scale-[1.6] mix-blend-screen animate-pulse rotate-12"></div>
                <div className="absolute z-0 inset-0 bg-primary blur-[50px] opacity-20 group-hover:opacity-50 transition-all duration-700 rounded-full"></div>
                {/* Icon */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logos/opta-code-mark.svg" className="w-28 h-28 md:w-36 md:h-36 drop-shadow-[0_15px_30px_rgba(139,92,246,0.3)] group-hover:drop-shadow-[0_20px_40px_rgba(139,92,246,0.8)] transition-all duration-700 relative z-10 group-hover:scale-110" alt="Code" />
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-[0_4px_20px_rgba(139,92,246,0.4)] mb-3 transition-all tracking-tight">Opta Code</div>
                <div className="text-base text-text-muted font-light leading-relaxed group-hover:text-text-secondary transition-colors">Developer desktop.</div>
              </div>
            </a>

          </div>

          {/* 4. Opta CLI (Shifted Up) */}
          <a href="https://help.optalocal.com/docs/cli" className="relative z-10 flex flex-col items-center gap-6 group w-64 xl:-mt-20 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:scale-110 hover:-translate-y-4">
            <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center relative">
              {/* Premium Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-[#8b5cf6]/30 via-[#c084fc]/20 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full scale-150 group-hover:scale-[2] mix-blend-screen rotate-45"></div>
              <div className="absolute z-0 inset-0 bg-primary blur-3xl opacity-20 group-hover:opacity-40 transition-all duration-700 rounded-full animate-pulse"></div>
              {/* Icon */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/opta-cli-mark.svg" className="w-16 h-16 md:w-20 md:h-20 transition-all duration-700 group-hover:rotate-6 drop-shadow-[0_0_15px_rgba(139,92,246,0.3)] group-hover:drop-shadow-[0_0_25px_rgba(139,92,246,0.8)] relative z-10" alt="CLI" />
            </div>
            <div className="text-center">
              <div className="text-xl md:text-2xl font-bold bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] bg-clip-text text-transparent drop-shadow-[0_4px_15px_rgba(139,92,246,0.3)] mb-2 transition-all">Opta CLI</div>
              <div className="text-sm text-text-muted font-light leading-relaxed group-hover:text-text-secondary transition-colors">Terminal control plane.</div>
            </div>
          </a>

        </motion.div>

      </div>
    </section>
  );
}
