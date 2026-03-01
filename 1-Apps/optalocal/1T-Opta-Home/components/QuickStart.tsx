"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const lines = [
  { type: "cmd",    text: "$ opta stack start" },
  { type: "blank",  text: "" },
  { type: "ok",     text: "[✓] Starting Opta LMX on localhost:8080..." },
  { type: "ok",     text: "[✓] Loading model: Meta-Llama-3.1-8B-Instruct.Q4_K_M.gguf" },
  { type: "ok",     text: "[✓] Starting Opta Code server on port 8081..." },
  { type: "ok",     text: "[✓] Attaching Opta CLI daemon..." },
  { type: "blank",  text: "" },
  { type: "url",    text: "Stack running. API at http://localhost:8080/v1" },
];

export function QuickStart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Up and running in seconds.
          </h2>
          <p className="text-xl text-text-secondary">
            One command initialises the full stack.
          </p>
        </motion.div>

        {/* Terminal window */}
        <motion.div
          className="rounded-2xl overflow-hidden border border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Window chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a] border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-text-muted font-mono">opta — zsh</span>
          </div>

          {/* Terminal body */}
          <div className="bg-[#050505] px-6 py-5 font-mono text-sm leading-7">
            {lines.map((line, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -4 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
              >
                {line.type === "blank" ? (
                  <div className="h-2" />
                ) : line.type === "cmd" ? (
                  <div className="text-primary">{line.text}</div>
                ) : line.type === "ok" ? (
                  <div>
                    <span className="text-neon-green">[✓]</span>
                    <span className="text-text-secondary">
                      {line.text.replace("[✓]", "")}
                    </span>
                  </div>
                ) : (
                  <div className="text-neon-cyan">{line.text}</div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Platform badges */}
        <motion.div
          className="flex items-center justify-center gap-3 mt-6"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {["v0.5 beta", "macOS", "Linux (coming soon)"].map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 text-xs font-mono text-text-muted glass-subtle border border-white/10 rounded-full"
            >
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
