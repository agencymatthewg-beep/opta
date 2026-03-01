"use client";

import { motion } from "framer-motion";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { Cpu, Terminal, Shield, ArrowRight } from "lucide-react";

const apps = [
  {
    name: "Opta CLI",
    role: "Core App 1",
    description: "Terminal-first control for the Opta Local stack.",
    icon: Terminal,
    href: "https://help.optalocal.com/docs/cli",
  },
  {
    name: "Opta LMX + Dashboard",
    role: "Core App 2",
    description: "Local inference engine with a real-time dashboard.",
    icon: Cpu,
    href: "https://lmx.optalocal.com",
  },
  {
    name: "Opta Code Desktop",
    role: "Core App 3",
    description: "Desktop app for Opta workflows on macOS and Windows.",
    icon: Shield,
    href: "https://help.optalocal.com/docs/code-desktop",
  },
];

export function Ecosystem() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            One stack. Three core apps.
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Opta Local is delivered as three core apps, with Home/Init/Help/Accounts acting as web surfaces.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app, i) => (
            <motion.a
              key={app.name}
              href={app.href}
              className="obsidian-interactive rounded-2xl p-8 group cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <app.icon className="w-6 h-6 text-primary" />
                </div>
                <ArrowRight className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
              <div className="mb-2">
                <h3 className="text-2xl font-bold text-white mb-1">{app.name}</h3>
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {app.role}
                </span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                {app.description}
              </p>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
