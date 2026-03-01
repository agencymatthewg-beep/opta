"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const stats = [
  { value: "0",    unit: "",    label: "Cloud Calls"       },
  { value: "100%", unit: "",    label: "OpenAI Compatible" },
  { value: "∞",    unit: "",    label: "Unmetered Tokens"  },
  { value: "3",    unit: "",    label: "Core Apps"         },
  { value: "<1s",  unit: "",    label: "Stack Boot Time"   },
];

export function BenchmarkStrip() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <section ref={ref} className="relative py-14 border-y border-white/5 bg-elevated">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="font-mono text-3xl md:text-4xl font-bold mb-2 text-primary">
                {stat.value}
                {stat.unit && <span className="text-text-secondary text-2xl ml-1">{stat.unit}</span>}
              </div>
              <div className="text-xs text-text-muted uppercase tracking-widest">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
