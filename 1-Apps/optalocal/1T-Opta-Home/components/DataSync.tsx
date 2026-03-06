"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Cloud, Settings2, ShieldCheck } from "lucide-react";

const syncItems = [
  {
    icon: Settings2,
    title: "Centralized Authentication",
    text:
      "Sign in once through Opta Accounts and use scoped sessions across connected Opta Local surfaces, including CLI-linked and browser flows.",
  },
  {
    icon: Cloud,
    title: "Scoped Session Handling",
    text:
      "Session cookies are scoped to Opta domains and delivered over TLS, reducing cross-site credential exposure in day-to-day usage.",
  },
  {
    icon: ShieldCheck,
    title: "Zero Profile Lock-in",
    text:
      "Provider keys and model preferences can remain local by design, with account services used for identity and optional sync policy.",
  },
];

export function DataSync() {
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">Identity designed for local-first operation.</h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Opta Accounts provides the identity control plane while preserving
            local execution choices across the Opta Local stack.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {syncItems.map((item, i) => (
            <motion.div
              key={item.title}
              className="obsidian-interactive rounded-2xl p-8"
              initial={{ opacity: 1, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <item.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-text-secondary leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
