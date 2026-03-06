"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stats = [
  { value: "512", label: "GB", sub: "Unified memory (reference node)" },
  { value: "22.2", label: "tok/s", sub: "Observed throughput (reference run)" },
  { value: "836", label: "GB", sub: "Model footprint tested" },
  { value: "0", label: "", sub: "Required cloud calls (local mode)" },
];

export function HardwareStats() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Reference local performance envelope.
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.sub}
              className="text-center"
              initial={{ opacity: 1, y: 20 }}
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
          initial={{ opacity: 1 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Metrics shown are from an internal Apple Silicon validation setup and
          are provided for planning context. Real-world results vary by model,
          quantization, prompt profile, and hardware.
        </motion.p>
      </div>
    </section>
  );
}
