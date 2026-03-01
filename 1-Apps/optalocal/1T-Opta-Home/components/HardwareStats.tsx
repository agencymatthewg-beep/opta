"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stats = [
  { value: "512", label: "GB", sub: "Unified memory" },
  { value: "22.2", label: "tok/s", sub: "Inference speed" },
  { value: "836", label: "GB", sub: "Largest model" },
  { value: "0", label: "ms", sub: "Cloud latency" },
];

export function HardwareStats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Built for 512GB unified memory.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.sub}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <div className="text-5xl md:text-6xl font-bold text-primary mb-2 font-mono">
                {stat.value}
                <span className="text-3xl ml-1">{stat.label}</span>
              </div>
              <div className="text-sm text-text-muted uppercase tracking-wider">
                {stat.sub}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="text-center text-xl text-text-secondary max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Kimi K2.5 running live on M3 Ultra. No GPU. No cloud. No waiting.
        </motion.p>
      </div>
    </section>
  );
}
