"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Cloud, Settings2, ShieldCheck } from "lucide-react";

const syncItems = [
  {
    icon: Settings2,
    title: "You control what syncs",
    text:
      "Opta Accounts is the control plane for profile sync. Users explicitly choose whether significant data categories sync at all, then configure exactly which credentials, model aliases, and safety preferences are pushed to connected devices.",
  },
  {
    icon: Cloud,
    title: "Selective cross-device state",
    text:
      "Enable or disable sync categories such as defaults, tool permissions, and fallback routing so each environment remains compliant with your operational constraints.",
  },
  {
    icon: ShieldCheck,
    title: "Security-first propagation",
    text:
      "Every synced change stays in your identity boundary and can be revoked. Use Accounts to rotate credentials and re-scope connected apps without reinstalling the stack.",
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
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">Sync that is explicitly yours.</h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Accounts does not treat sync as one-way magic. You decide what state moves across devices and where.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {syncItems.map((item, i) => (
            <motion.div
              key={item.title}
              className="obsidian-interactive rounded-2xl p-8"
              initial={{ opacity: 0, y: 16 }}
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
