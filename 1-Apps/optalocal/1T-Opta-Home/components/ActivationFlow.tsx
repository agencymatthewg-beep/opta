"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Cloud, Cpu, TerminalSquare, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Cloud,
    title: "Select compute strategy",
    description:
      "Choose private LMX execution for sovereignty and low latency, or cloud capacity for elastic scale and frontier model access.",
  },
  {
    number: "02",
    icon: Cpu,
    title: "Provision optimizer context",
    description:
      "Use Opta Init to bootstrap the stack, enforce baseline policy, and activate Opta AI as the shared operational context.",
  },
  {
    number: "03",
    icon: TerminalSquare,
    title: "Execute across surfaces",
    description:
      "Run terminal workflows in Opta CLI or IDE workflows in Opta Code with synchronized intent, memory, and execution policy.",
  },
  {
    number: "04",
    icon: Rocket,
    title: "Ship with controlled variance",
    description:
      "Move from intent to release through one governed path rather than fragmented tooling, disconnected runtimes, or ad-hoc handoffs.",
  },
];

export function ActivationFlow() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-24 px-6 bg-grid-subtle">
      <div className="max-w-7xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Production activation architecture.
          </h2>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto">
            Standardize runtime selection, optimizer activation, and execution
            surfaces so teams deliver with less drift and higher reliability.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              className="relative obsidian-interactive rounded-2xl p-7 border border-white/5"
              initial={{ opacity: 1, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.08 * index,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="font-mono text-xs text-primary tracking-widest">
                  {step.number}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
