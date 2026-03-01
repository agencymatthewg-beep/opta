"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

const coreApps = [
  {
    name: "Opta LMX",
    role: "Inference Engine",
    description:
      "High-performance local inference server and management dashboard. Load, quantize, and serve open weights with drop-in OpenAI API compatibility.",
    icon: "/icons/icon-lmx.svg",
    href: "https://lmx.optalocal.com",
  },
  {
    name: "Opta CLI",
    role: "Control Plane",
    description:
      "A powerful terminal interface for your AI stack. Manage models, monitor resources, and orchestrate environments directly from your command line.",
    icon: "/icons/icon-cli.svg",
    href: "#cli",
  },
  {
    name: "Opta Code",
    role: "IDE Assistant",
    description:
      "Your local coding co-pilot. Powered by your models, connected to your codebase, with zero telemetry and no API limits.",
    icon: "/icons/icon-code.svg",
    href: "#code",
  },
];

const mgmtApps = [
  { name: "Opta Accounts", desc: "Unified auth & SSO",          href: "https://accounts.optalocal.com" },
  { name: "Opta Status",   desc: "System health monitoring",    href: "https://status.optalocal.com"   },
  { name: "Opta Help",     desc: "Documentation & guides",      href: "https://help.optalocal.com"     },
];

export function Ecosystem() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Three apps. One ecosystem.
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Each core app does exactly one job at production grade. Together they form a complete local AI environment.
          </p>
        </motion.div>

        {/* Core apps — 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {coreApps.map((app, i) => (
            <motion.a
              key={app.name}
              href={app.href}
              className="obsidian-interactive rounded-2xl p-8 group cursor-pointer border border-white/5"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={app.icon} alt={app.name} className="w-9 h-9" />
                </div>
                <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{app.name}</h3>
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium font-mono mb-4">
                {app.role}
              </span>
              <p className="text-text-secondary leading-relaxed text-sm">{app.description}</p>
            </motion.a>
          ))}
        </div>

        {/* Management layer strip */}
        <motion.div
          className="rounded-xl border border-white/5 bg-[#0e0e14] px-8 py-6"
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-xs font-mono text-text-muted uppercase tracking-widest mb-5">
            [ Infrastructure &amp; Support Layer ]
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-0 sm:divide-x sm:divide-white/5">
            {mgmtApps.map((app) => (
              <a
                key={app.name}
                href={app.href}
                className="sm:flex-1 sm:px-8 first:pl-0 last:pr-0 group"
              >
                <div className="text-sm font-semibold text-text-secondary group-hover:text-white transition-colors">
                  {app.name}
                </div>
                <div className="text-xs text-text-muted mt-0.5">{app.desc}</div>
              </a>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
