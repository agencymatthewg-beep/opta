"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { HardDrive, Lock, Cloud, X, ArrowRight } from "lucide-react";

export function ArchDiagram() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6 bg-dot-subtle">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Your data never leaves your machine.
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Air-gap capable architecture. Every byte stays on your hardware.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Local Architecture (ENABLED) */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Opta Local Architecture</h3>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-green/10 border border-neon-green/30 text-neon-green text-sm font-medium">
                <Lock className="w-3.5 h-3.5" />
                Active
              </span>
            </div>

            <div className="relative obsidian rounded-2xl p-8 border-2 border-primary/40 glow-violet-sm">
              {/* YOUR COMPUTE NODE */}
              <div className="flex flex-col items-center justify-center mb-6 gap-2">
                <div className="w-20 h-20 rounded-xl bg-primary/10 border-2 border-primary/40 flex items-center justify-center">
                  <HardDrive className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <div className="text-xs font-bold text-white font-mono tracking-widest uppercase">Your Compute Node</div>
                  <div className="text-[10px] text-text-muted font-mono">Apple Silicon / NVIDIA / AMD</div>
                </div>
              </div>

              {/* Arrow down */}
              <div className="flex justify-center mb-6">
                <ArrowRight className="w-6 h-6 text-primary rotate-90" />
              </div>

              {/* Local Storage + LMX */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass-subtle rounded-lg p-4 border border-primary/20 text-center">
                  <HardDrive className="w-8 h-8 text-primary mx-auto mb-2" />
                  <span className="text-xs text-text-secondary font-mono">Local Storage</span>
                </div>
                <div className="glass-subtle rounded-lg p-4 border border-primary/20 text-center">
                  <div className="w-8 h-8 rounded bg-primary/20 mx-auto mb-2 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">LMX</span>
                  </div>
                  <span className="text-xs text-text-secondary font-mono">Inference</span>
                </div>
              </div>

              {/* Data stays local indicator */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-green/10 border border-neon-green/30">
                  <Lock className="w-4 h-4 text-neon-green" />
                  <span className="text-sm font-medium text-neon-green">Data stays on device</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Cloud Architecture (BLOCKED) */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, x: 20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-text-muted mb-2">Cloud AI Services</h3>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-red/10 border border-neon-red/30 text-neon-red text-sm font-medium">
                <X className="w-3.5 h-3.5" />
                Disabled
              </span>
            </div>

            <div className="relative opacity-50">
              <div className="obsidian rounded-2xl p-8 border border-white/5">
                {/* YOUR COMPUTE NODE (cloud side — dimmed) */}
                <div className="flex flex-col items-center justify-center mb-6 gap-2">
                  <div className="w-20 h-20 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <HardDrive className="w-10 h-10 text-text-muted" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold text-text-muted font-mono tracking-widest uppercase">Your Compute Node</div>
                  </div>
                </div>

                {/* Crossed-out arrow */}
                <div className="relative flex justify-center mb-6">
                  <ArrowRight className="w-6 h-6 text-text-muted rotate-90" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <X className="w-12 h-12 text-neon-red stroke-[3]" />
                  </div>
                </div>

                {/* Cloud */}
                <div className="flex justify-center mb-6">
                  <div className="w-32 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Cloud className="w-12 h-12 text-text-muted" />
                  </div>
                </div>

                {/* Risk indicator */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-red/10 border border-neon-red/30">
                    <X className="w-4 h-4 text-neon-red" />
                    <span className="text-sm font-medium text-neon-red">Data exfiltration risk</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
