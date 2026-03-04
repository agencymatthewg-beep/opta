"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Cloud, Settings2, ShieldCheck } from "lucide-react";

const syncItems = [
  {
    icon: Settings2,
    title: "Centralized Authentication",
    text:
      "A single identity provider for the entire Opta ecosystem. Sign in via CLI or browser once, and your session is automatically trusted across LMX, Code Desktop, and all management portals.",
  },
  {
    icon: Cloud,
    title: "Secure Edge Sessions",
    text:
      "Opta Accounts issues encrypted session cookies scoped exclusively to the .optalocal.com domain, ensuring your local authentication state never leaks to the public web.",
  },
  {
    icon: ShieldCheck,
    title: "Zero Profile Lock-in",
    text:
      "Your credentials, API keys, and model preferences remain within your local system boundaries. The auth layer grants access without requiring centralized storage of your operational data.",
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">One identity. Universal local access.</h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Opta Accounts is the SSO control plane for your entire local stack. Sign in once, authenticate everywhere.
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
