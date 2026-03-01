"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

export function CtaBlock() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="relative obsidian rounded-3xl p-12 md:p-16 text-center overflow-hidden"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-moonlight">
              Ready to own your compute?
            </h2>
            <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
              Set up the full Opta Local stack in under 10 minutes.
            </p>
            <a
              href="https://init.optalocal.com"
              className="inline-flex items-center gap-3 px-10 py-5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-medium text-lg group shadow-[0_0_40px_-10px_rgba(168,85,247,0.5)]"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
