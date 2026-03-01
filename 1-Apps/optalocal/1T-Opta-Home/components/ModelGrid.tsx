"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Zap } from "lucide-react";

const models = [
  {
    class: "7B – 9B Params",
    vram: "8 GB+",
    useCase: "Opta Code assistant, chat",
    formats: "GGUF · AWQ · MLX",
    highlight: false,
  },
  {
    class: "13B – 34B Params",
    vram: "16 GB+",
    useCase: "Complex reasoning, agents",
    formats: "GGUF · EXL2 · MLX",
    highlight: false,
  },
  {
    class: "70B+ Params",
    vram: "64 GB+",
    useCase: "Enterprise RAG, heavy tasks",
    formats: "GGUF · MLX",
    highlight: true,
  },
  {
    class: "MoE / 100B+",
    vram: "128 GB+",
    useCase: "Frontier inference",
    formats: "GGUF · MLX",
    highlight: false,
  },
];

export function ModelGrid() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Built for the open-weight ecosystem.
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Run any open model that fits your hardware. From lightweight assistants to frontier-scale inference.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          className="obsidian rounded-2xl border border-primary/20 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Header */}
          <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Model Class</div>
            <div className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Min VRAM</div>
            <div className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Use Case</div>
            <div className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Formats</div>
          </div>

          {/* Rows */}
          {models.map((model, i) => (
            <motion.div
              key={model.class}
              className={`grid grid-cols-4 gap-4 px-6 py-4 border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${
                model.highlight ? "bg-primary/5" : ""
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${model.highlight ? "text-primary" : "text-white"}`}>
                  {model.class}
                </span>
                {model.highlight && <Zap className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex items-center">
                <span className="font-mono text-sm text-text-secondary">{model.vram}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-text-secondary">{model.useCase}</span>
              </div>
              <div className="flex items-center">
                <span className="font-mono text-xs px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary">
                  {model.formats}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="text-center text-sm text-text-muted mt-8"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Compatible with any hardware meeting minimum VRAM requirements.
          <br />
          MLX format recommended for Apple Silicon.
        </motion.p>
      </div>
    </section>
  );
}
