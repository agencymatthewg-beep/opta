"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Briefcase, Cloud, Plug, Mic } from "lucide-react";

const features = [
  {
    icon: Briefcase,
    title: "Closed-Loop Optimization",
    description:
      "Opta AI keeps architecture, tooling, and execution decisions aligned from setup through delivery, reducing system-level entropy.",
  },
  {
    icon: Cloud,
    title: "Elastic Runtime Governance",
    description:
      "Switch between private local inference and cloud capacity without reworking orchestration, policy, or operator workflow.",
  },
  {
    icon: Plug,
    title: "Surface Parity",
    description:
      "Execute through Opta CLI or Opta Code under the same optimizer context, so teams can change interface without process loss.",
  },
  {
    icon: Mic,
    title: "Multimodal Operations",
    description:
      "Voice and text interaction run through the same stack, enabling hands-free control without introducing a parallel architecture.",
  },
];

export function FeatureTrio() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6 bg-grid-subtle">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Designed for disciplined production execution.
          </h2>
          <p className="text-xl text-text-secondary max-w-xl mx-auto">
            Runtime, optimizer, identity, and interface layers remain coherent as
            workload complexity and team size scale.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="obsidian-interactive rounded-2xl p-8"
              initial={{ opacity: 1, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-text-secondary leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
