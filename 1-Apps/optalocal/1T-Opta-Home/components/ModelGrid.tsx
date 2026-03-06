"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Zap } from "lucide-react";

const models = [
  {
    class: "7B – 9B Params",
    vram: "8 GB+",
    useCase: "Opta Code assistant, chat",
    formats: "MLX · GGUF",
    highlight: false,
  },
  {
    class: "13B – 34B Params",
    vram: "16 GB+",
    useCase: "Complex reasoning, agents",
    formats: "MLX · GGUF",
    highlight: false,
  },
  {
    class: "70B+ Params",
    vram: "64 GB+",
    useCase: "Enterprise RAG, heavy tasks",
    formats: "MLX · GGUF",
    highlight: true,
  },
  {
    class: "MoE / 100B+",
    vram: "128 GB+",
    useCase: "Frontier inference",
    formats: "MLX · GGUF",
    highlight: false,
  },
  {
    class: "Cloud Frontier Models",
    vram: "0 GB (API)",
    useCase: "Long-running autonomous agents",
    formats: "REST API",
    highlight: false,
    type: "cloud",
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
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Model class planning matrix.
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Align workload class, memory profile, and serving format before
            activation so delivery stays predictable at scale.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          className="obsidian rounded-2xl overflow-hidden"
          initial={{ opacity: 1, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <ul className="md:hidden divide-y divide-white/5" role="list">
            {models.map((model, i) => (
              <motion.li
                key={model.class}
                className={`px-5 py-4 transition-colors hover:bg-white/5 ${model.highlight ? "bg-primary/5" : ""
                  }`}
                initial={{ opacity: 1, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <h3 className={`font-semibold ${model.highlight ? "text-primary" : "text-white"}`}>
                    {model.class}
                  </h3>
                  {model.highlight && <Zap className="w-4 h-4 text-primary" aria-hidden="true" />}
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted uppercase tracking-wide text-xs">Min VRAM</dt>
                    <dd className="font-mono text-text-secondary">{model.vram}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted uppercase tracking-wide text-xs">Use Case</dt>
                    <dd className="text-right text-text-secondary">{model.useCase}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted uppercase tracking-wide text-xs">Formats</dt>
                    <dd>
                      <span className="font-mono text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                        {model.formats}
                      </span>
                    </dd>
                  </div>
                </dl>
              </motion.li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <caption className="sr-only">
                Model classes, minimum VRAM, recommended use case, and supported formats
              </caption>
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-left">
                  <th scope="col" className="px-6 py-4 text-sm font-semibold text-text-secondary uppercase tracking-wide">
                    Model Class
                  </th>
                  <th scope="col" className="px-6 py-4 text-sm font-semibold text-text-secondary uppercase tracking-wide">
                    Min VRAM
                  </th>
                  <th scope="col" className="px-6 py-4 text-sm font-semibold text-text-secondary uppercase tracking-wide">
                    Use Case
                  </th>
                  <th scope="col" className="px-6 py-4 text-sm font-semibold text-text-secondary uppercase tracking-wide">
                    Formats
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((model, i) => (
                  <motion.tr
                    key={model.class}
                    className={`border-b border-white/5 last:border-0 transition-colors hover:bg-white/5 ${model.highlight ? "bg-primary/5" : ""
                      }`}
                    initial={{ opacity: 1, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <th scope="row" className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${model.highlight ? "text-primary" : "text-white"}`}>
                          {model.class}
                        </span>
                        {model.highlight && <Zap className="w-4 h-4 text-primary" aria-hidden="true" />}
                      </div>
                    </th>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-text-secondary">{model.vram}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-secondary">{model.useCase}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                        {model.formats}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer note */}
        <motion.p
          className="text-center text-sm text-text-muted mt-8"
          initial={{ opacity: 1 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          Use this matrix to size hardware and model selection before rollout.
          Runtime activation and interface execution are then handled through
          Opta Init, Opta CLI, and Opta Code.
        </motion.p>
      </div>
    </section>
  );
}
