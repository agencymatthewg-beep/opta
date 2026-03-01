"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const coreApps = [
  { name: "Opta LMX", role: "Inference Engine", icon: "/icons/icon-lmx.svg" },
  { name: "Opta CLI", role: "Control Plane",    icon: "/icons/icon-cli.svg" },
  { name: "Opta Code", role: "IDE Assistant",   icon: "/icons/icon-code.svg" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-12 overflow-hidden bg-grid-subtle">
      <div className="relative z-10 max-w-6xl mx-auto w-full text-center">

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
          <span className="text-white">The complete local</span>
          <br />
          <span className="text-moonlight">AI stack for developers.</span>
        </motion.h1>

        {/* Subhead */}
        <motion.p
          className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          A unified ecosystem to serve, manage, and code with open-weight models.
          Drop-in OpenAI API compatibility, entirely on your own hardware.
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
          <div className="inline-flex items-center gap-2 px-5 py-3.5 glass border border-primary/30 rounded-lg font-mono text-sm text-primary select-all cursor-text">
            curl -sL optalocal.com/install | bash
          </div>
        </motion.div>

        {/* Core apps stack diagram */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {coreApps.map((app, i) => (
            <div key={app.name} className="flex items-center">
              {/* App node */}
              <motion.div
                className="obsidian border border-primary/30 rounded-xl px-6 py-4 flex flex-col items-center gap-2 min-w-[140px]"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.5 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ borderColor: "rgba(168,85,247,0.6)", y: -2 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={app.icon} alt={app.name} className="w-7 h-7" />
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{app.name}</div>
                  <div className="text-[10px] text-text-muted font-mono mt-0.5">{app.role}</div>
                </div>
              </motion.div>

              {/* Connector line between nodes */}
              {i < coreApps.length - 1 && (
                <motion.div
                  className="hidden sm:flex items-center w-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                >
                  <div className="w-full h-px border-t-2 border-dashed border-primary/40" />
                </motion.div>
              )}
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
