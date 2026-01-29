"use client";

import { ModelCard } from "@/components/features/ModelCard";
import { motion } from "framer-motion";

// Animated diamond decoration component
function FloatingDiamond({
  className,
  delay = 0,
  size = 12,
  color = "neon-orange"
}: {
  className?: string;
  delay?: number;
  size?: number;
  color?: "neon-orange" | "neon-cyan" | "neon-purple" | "neon-pink";
}) {
  const colorClasses = {
    "neon-orange": "border-neon-orange bg-neon-orange/20",
    "neon-cyan": "border-neon-cyan bg-neon-cyan/20",
    "neon-purple": "border-purple-glow bg-purple-glow/20",
    "neon-pink": "border-neon-pink bg-neon-pink/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0.4, 0.8, 0.4],
        scale: 1,
        y: [0, -8, 0],
      }}
      transition={{
        opacity: { duration: 2, repeat: Infinity, delay },
        y: { duration: 3, repeat: Infinity, delay, ease: "easeInOut" },
        scale: { duration: 0.5, delay },
      }}
      className={className}
      style={{ width: size, height: size }}
    >
      <div
        className={`w-full h-full rotate-45 border-2 ${colorClasses[color]}`}
      />
    </motion.div>
  );
}

// Sample AI model data with benchmarks
const models = [
  {
    rank: 1,
    name: "Claude 3.5 Opus",
    company: "Anthropic",
    update: "2h ago",
    status: "active" as const,
    score: 1847,
    tags: [
      { type: "llm" as const, parameters: "~175B" },
      { type: "api" as const },
      { type: "web" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 92.3, maxScore: 100 },
      { name: "HumanEval", score: 91.8, maxScore: 100 },
      { name: "GPQA", score: 65.2, maxScore: 100 },
      { name: "MATH", score: 78.4, maxScore: 100 },
      { name: "GSM8K", score: 96.1, maxScore: 100 },
      { name: "ARC-C", score: 97.2, maxScore: 100 },
    ],
  },
  {
    rank: 2,
    name: "GPT-4 Turbo",
    company: "OpenAI",
    update: "4h ago",
    status: "trending" as const,
    score: 1823,
    tags: [
      { type: "llm" as const, parameters: "~1.8T" },
      { type: "api" as const },
      { type: "web" as const },
      { type: "multimodal" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 91.8, maxScore: 100 },
      { name: "HumanEval", score: 87.2, maxScore: 100 },
      { name: "GPQA", score: 63.8, maxScore: 100 },
      { name: "MATH", score: 76.4, maxScore: 100 },
      { name: "GSM8K", score: 95.1, maxScore: 100 },
      { name: "ARC-C", score: 96.8, maxScore: 100 },
    ],
  },
  {
    rank: 3,
    name: "Gemini 2.0 Ultra",
    company: "Google",
    update: "6h ago",
    status: "new" as const,
    score: 1798,
    tags: [
      { type: "llm" as const },
      { type: "multimodal" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 90.5, maxScore: 100 },
      { name: "HumanEval", score: 85.3, maxScore: 100 },
      { name: "GPQA", score: 61.2, maxScore: 100 },
      { name: "MATH", score: 75.8, maxScore: 100 },
      { name: "GSM8K", score: 94.7, maxScore: 100 },
      { name: "ARC-C", score: 95.4, maxScore: 100 },
    ],
  },
  {
    rank: 4,
    name: "Claude 3.5 Sonnet",
    company: "Anthropic",
    update: "8h ago",
    status: "active" as const,
    score: 1752,
    tags: [
      { type: "llm" as const },
      { type: "api" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 88.7, maxScore: 100 },
      { name: "HumanEval", score: 92.0, maxScore: 100 },
      { name: "GPQA", score: 59.4, maxScore: 100 },
      { name: "MATH", score: 71.2, maxScore: 100 },
      { name: "GSM8K", score: 91.3, maxScore: 100 },
      { name: "ARC-C", score: 93.8, maxScore: 100 },
    ],
  },
  {
    rank: 5,
    name: "Llama 3.1 405B",
    company: "Meta",
    update: "12h ago",
    status: "active" as const,
    score: 1698,
    tags: [{ type: "llm" as const }],
    benchmarks: [
      { name: "MMLU", score: 85.2, maxScore: 100 },
      { name: "HumanEval", score: 81.4, maxScore: 100 },
      { name: "GPQA", score: 54.6, maxScore: 100 },
      { name: "MATH", score: 68.9, maxScore: 100 },
      { name: "GSM8K", score: 89.5, maxScore: 100 },
      { name: "ARC-C", score: 91.2, maxScore: 100 },
    ],
  },
  {
    rank: 6,
    name: "Mistral Large 2",
    company: "Mistral AI",
    update: "1d ago",
    status: "trending" as const,
    score: 1654,
    tags: [
      { type: "llm" as const },
      { type: "api" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 84.1, maxScore: 100 },
      { name: "HumanEval", score: 79.8, maxScore: 100 },
      { name: "GPQA", score: 52.1, maxScore: 100 },
      { name: "MATH", score: 65.3, maxScore: 100 },
      { name: "GSM8K", score: 87.2, maxScore: 100 },
      { name: "ARC-C", score: 89.6, maxScore: 100 },
    ],
  },
  {
    rank: 7,
    name: "DeepSeek V3",
    company: "DeepSeek",
    update: "1d ago",
    status: "new" as const,
    score: 1621,
    tags: [{ type: "llm" as const }],
    benchmarks: [
      { name: "MMLU", score: 82.6, maxScore: 100 },
      { name: "HumanEval", score: 78.2, maxScore: 100 },
      { name: "GPQA", score: 49.8, maxScore: 100 },
      { name: "MATH", score: 72.1, maxScore: 100 },
      { name: "GSM8K", score: 85.9, maxScore: 100 },
      { name: "ARC-C", score: 88.3, maxScore: 100 },
    ],
  },
  {
    rank: 8,
    name: "Grok-2",
    company: "xAI",
    update: "2d ago",
    status: "active" as const,
    score: 1587,
    tags: [
      { type: "llm" as const },
      { type: "web" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 81.3, maxScore: 100 },
      { name: "HumanEval", score: 76.5, maxScore: 100 },
      { name: "GPQA", score: 47.2, maxScore: 100 },
      { name: "MATH", score: 63.8, maxScore: 100 },
      { name: "GSM8K", score: 84.1, maxScore: 100 },
      { name: "ARC-C", score: 86.9, maxScore: 100 },
    ],
  },
  {
    rank: 9,
    name: "Qwen 2.5 72B",
    company: "Alibaba",
    update: "3d ago",
    status: "active" as const,
    score: 1543,
    tags: [{ type: "llm" as const }],
    benchmarks: [
      { name: "MMLU", score: 79.8, maxScore: 100 },
      { name: "HumanEval", score: 74.2, maxScore: 100 },
      { name: "GPQA", score: 44.5, maxScore: 100 },
      { name: "MATH", score: 61.5, maxScore: 100 },
      { name: "GSM8K", score: 82.7, maxScore: 100 },
      { name: "ARC-C", score: 85.1, maxScore: 100 },
    ],
  },
  {
    rank: 10,
    name: "Gemini 1.5 Pro",
    company: "Google",
    update: "4d ago",
    status: "active" as const,
    score: 1498,
    tags: [
      { type: "llm" as const },
      { type: "multimodal" as const },
      { type: "api" as const },
    ],
    benchmarks: [
      { name: "MMLU", score: 78.4, maxScore: 100 },
      { name: "HumanEval", score: 72.8, maxScore: 100 },
      { name: "GPQA", score: 42.1, maxScore: 100 },
      { name: "MATH", score: 58.9, maxScore: 100 },
      { name: "GSM8K", score: 80.3, maxScore: 100 },
      { name: "ARC-C", score: 83.7, maxScore: 100 },
    ],
  },
];

export default function ModelsPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Purple ambient background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-deep/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[300px] bg-purple-glow/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-1/4 w-[500px] h-[250px] bg-purple-deep/15 rounded-full blur-[100px]" />
      </div>

      {/* Background decorative diamonds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <FloatingDiamond className="absolute top-20 left-[10%]" delay={0} size={18} color="neon-orange" />
        <FloatingDiamond className="absolute top-32 right-[15%]" delay={0.5} size={14} color="neon-cyan" />
        <FloatingDiamond className="absolute top-[25%] left-[5%]" delay={1} size={12} color="neon-purple" />
        <FloatingDiamond className="absolute top-[40%] right-[6%]" delay={1.5} size={16} color="neon-pink" />
        <FloatingDiamond className="absolute top-[55%] left-[8%]" delay={2} size={10} color="neon-orange" />
        <FloatingDiamond className="absolute top-[65%] right-[18%]" delay={2.5} size={18} color="neon-cyan" />
        <FloatingDiamond className="absolute top-[80%] left-[15%]" delay={3} size={14} color="neon-purple" />
        <FloatingDiamond className="absolute bottom-20 right-[10%]" delay={3.5} size={12} color="neon-pink" />
        {/* Extra diamonds for richer effect */}
        <FloatingDiamond className="absolute top-[15%] right-[25%]" delay={0.8} size={8} color="neon-purple" />
        <FloatingDiamond className="absolute top-[35%] left-[20%]" delay={1.8} size={10} color="neon-orange" />
        <FloatingDiamond className="absolute top-[70%] right-[30%]" delay={2.8} size={8} color="neon-cyan" />
      </div>

      {/* Header */}
      <motion.div
        className="text-center mb-12 md:mb-16 pt-8 md:pt-12 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* LEADERBOARD label - Opta Subtitle style */}
        <motion.p
          className="opta-subtitle text-sm md:text-base mb-4"
          style={{
            textShadow: "0 0 30px rgba(244, 114, 182, 0.5), 0 0 60px rgba(244, 114, 182, 0.3)"
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Leaderboard
        </motion.p>

        {/* Main title - Opta Hero typography with Moonlight gradient */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-[0.08em] gradient-text-purple">
          Top 10 AI Models
        </h1>

        {/* Opta accent line */}
        <div className="opta-accent-line mb-6 hidden md:block" />

        <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto px-4">
          Compare the top AI models across key benchmarks. Hover over cards to see detailed scores.
        </p>
      </motion.div>

      {/* Model Cards */}
      <div className="space-y-5 md:space-y-6 max-w-5xl mx-auto px-4 relative z-10 pb-8">
        {models.map((model, index) => (
          <motion.div
            key={model.rank}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.5 }}
          >
            <ModelCard
              rank={model.rank}
              name={model.name}
              company={model.company}
              update={model.update}
              status={model.status}
              score={model.score}
              tags={model.tags}
              benchmarks={model.benchmarks}
            />
          </motion.div>
        ))}
      </div>

      {/* Interaction hint */}
      <motion.div
        className="text-center mt-8 md:mt-12 text-text-muted text-sm relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <p className="hidden md:block">Hover over a card to view benchmark details • Click to pin</p>
        <p className="md:hidden">Scroll to focus on a card and view benchmark details</p>
      </motion.div>

      {/* Informative Footer */}
      <motion.footer
        className="relative z-10 mt-16 md:mt-24 border-t border-purple-glow/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
      >
        {/* Benchmark Legend */}
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="opta-section-header mb-6">
            <h2>Benchmark Reference</h2>
            <div className="line" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-xl bg-purple-deep/10 border border-purple-glow/10">
              <h3 className="font-medium text-purple-light mb-1">MMLU</h3>
              <p className="text-text-muted">Massive Multitask Language Understanding. Tests knowledge across 57 subjects.</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-deep/10 border border-purple-glow/10">
              <h3 className="font-medium text-purple-light mb-1">HumanEval</h3>
              <p className="text-text-muted">Code generation benchmark. Measures functional correctness of synthesized programs.</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-deep/10 border border-purple-glow/10">
              <h3 className="font-medium text-purple-light mb-1">GPQA</h3>
              <p className="text-text-muted">Graduate-level science questions. Tests expert-level reasoning in physics, biology, chemistry.</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-deep/10 border border-purple-glow/10">
              <h3 className="font-medium text-purple-light mb-1">MATH</h3>
              <p className="text-text-muted">Competition mathematics problems. Covers algebra, geometry, calculus, and more.</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-deep/10 border border-purple-glow/10">
              <h3 className="font-medium text-purple-light mb-1">GSM8K</h3>
              <p className="text-text-muted">Grade school math word problems. Tests multi-step arithmetic reasoning.</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-deep/10 border border-purple-glow/10">
              <h3 className="font-medium text-purple-light mb-1">ARC-C</h3>
              <p className="text-text-muted">AI2 Reasoning Challenge. Science questions requiring reasoning beyond retrieval.</p>
            </div>
          </div>
        </div>

        {/* Methodology & Sources */}
        <div className="border-t border-purple-glow/10">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
              <div>
                <h3 className="font-medium text-white mb-3">Scoring Methodology</h3>
                <p className="text-text-muted leading-relaxed">
                  Composite scores are calculated using a weighted average of benchmark results,
                  normalized across all models. Weights reflect real-world task importance:
                  reasoning (35%), coding (25%), knowledge (20%), math (20%).
                </p>
              </div>
              <div>
                <h3 className="font-medium text-white mb-3">Data Sources</h3>
                <p className="text-text-muted leading-relaxed">
                  Benchmark data is aggregated from official model papers,
                  provider documentation, and independent evaluations.
                  Last updated: January 2025.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-purple-glow/10 bg-purple-deep/5">
          <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-3">
              <p>aicomp.optamize.biz</p>
              <span className="text-purple-glow/30">•</span>
              <a
                href="https://optamize.biz"
                target="_blank"
                rel="noopener noreferrer"
                className="powered-by-opta group"
              >
                Powered by <span className="opta-mark">OPTA</span>
              </a>
            </div>
            <div className="flex items-center gap-4">
              <span>Updated daily</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Open source data</span>
            </div>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
