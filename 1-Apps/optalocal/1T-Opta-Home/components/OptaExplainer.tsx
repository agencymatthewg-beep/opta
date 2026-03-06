"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Compass, Bot, Flag } from "lucide-react";

const pillars = [
  {
    icon: Compass,
    title: "What is Opta?",
    tag: "Platform Layer",
    description:
      "Opta is the platform company behind optimization-native software delivery, connecting architecture, orchestration, and execution into a single operating model.",
  },
  {
    icon: Bot,
    title: "What is Opta AI?",
    tag: "Intelligence Layer",
    description:
      "Opta AI is the execution intelligence layer that maintains planning context, operating policy, and intent continuity across every Opta surface.",
  },
  {
    icon: Flag,
    title: "What is Opta Local?",
    tag: "Delivery Layer",
    description:
      "Opta Local operationalizes the Opta model for real teams: activate Opta AI through a governed runtime path and execute production workflows immediately.",
  },
];

export function OptaExplainer() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            How the Opta system fits together.
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Opta defines system architecture, Opta AI carries execution
            intelligence, and Opta Local turns both into an operational product.
          </p>
        </motion.div>

        <div className="space-y-5">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#10101a] via-[#0d0d15] to-[#0a0a12] p-6 md:p-7"
              initial={{ opacity: 1, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.08 * index,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="pointer-events-none absolute -right-16 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative z-10 grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
                <div className="flex items-center gap-4">
                  <pillar.icon className="h-8 w-8 text-primary drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]" />
                  <div>
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-primary/90">
                      0{index + 1}
                    </div>
                    <div className="mt-1 inline-flex rounded-full bg-primary/12 px-3 py-1 text-[11px] font-mono text-primary">
                      {pillar.tag}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-2xl font-bold text-white">{pillar.title}</h3>
                  <p className="max-w-3xl text-base leading-relaxed text-text-secondary">
                    {pillar.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
