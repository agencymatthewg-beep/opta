"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Briefcase, Cloud, Plug, Mic } from "lucide-react";

const features = [
  {
    icon: Briefcase,
    title: "Autonomous CEO Modes",
    description:
      "Explain your business idea and let the AI take over. Opta runs continuous, long-running agentic loops to build, manage, and execute money-making workflows while you sleep.",
  },
  {
    icon: Cloud,
    title: "Mass Cloud Support + Local Guardrails",
    description:
      "Don't have a Mac Studio? No problem. Hook up your OpenAI or Anthropic API keys for cloud-backed autonomy, or run 100% private locally via Opta LMX on Apple Silicon.",
  },
  {
    icon: Plug,
    title: "Frictionless Integration",
    description:
      "Drop-in OpenAI-compatible REST API. Point your existing LangChain, LlamaIndex, or custom scripts to localhost and our routing handles whether it hits the cloud or your local hardware.",
  },
  {
    icon: Mic,
    title: "Voice-Native AI",
    description:
      "Pitch ideas using built-in TTS and speech transcription — speak to your AI and hear responses. Works seamlessly across both cloud services and local mlx-whisper processing.",
  },
];

export function FeatureTrio() {
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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Intelligence that works for you.
          </h2>
          <p className="text-xl text-text-secondary max-w-xl mx-auto">
            From quick tasks to managing an entire digital business autonomously.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="obsidian-interactive rounded-2xl p-8"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-text-secondary leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
