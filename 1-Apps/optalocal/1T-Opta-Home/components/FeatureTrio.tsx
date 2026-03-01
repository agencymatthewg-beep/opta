"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Shield, Infinity, Plug } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Air-Gapped Privacy",
    description:
      "Zero telemetry. No silent API calls. Your code, prompts, and intellectual property never leave your local network.",
  },
  {
    icon: Infinity,
    title: "Unmetered Inference",
    description:
      "No API bills. No rate limits. Run heavy agentic loops and massive context windows continuously without watching a usage meter.",
  },
  {
    icon: Plug,
    title: "Frictionless Integration",
    description:
      "Drop-in OpenAI-compatible REST API. Point your existing LangChain, LlamaIndex, or custom scripts to localhost and they just work.",
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
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Built differently.
          </h2>
          <p className="text-xl text-text-secondary max-w-xl mx-auto">
            Every design decision in Opta Local starts from one premise: you own the compute.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="obsidian-interactive rounded-2xl p-8"
              initial={{ opacity: 0, y: 20 }}
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
