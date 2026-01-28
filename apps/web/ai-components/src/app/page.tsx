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
      {/* Background decorative diamonds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <FloatingDiamond className="absolute top-20 left-[10%]" delay={0} size={16} color="neon-orange" />
        <FloatingDiamond className="absolute top-40 right-[15%]" delay={0.5} size={12} color="neon-cyan" />
        <FloatingDiamond className="absolute top-[30%] left-[5%]" delay={1} size={10} color="neon-purple" />
        <FloatingDiamond className="absolute top-[45%] right-[8%]" delay={1.5} size={14} color="neon-pink" />
        <FloatingDiamond className="absolute top-[60%] left-[12%]" delay={2} size={8} color="neon-orange" />
        <FloatingDiamond className="absolute top-[75%] right-[20%]" delay={2.5} size={16} color="neon-cyan" />
        <FloatingDiamond className="absolute bottom-40 left-[8%]" delay={3} size={12} color="neon-purple" />
        <FloatingDiamond className="absolute bottom-20 right-[12%]" delay={3.5} size={10} color="neon-pink" />
      </div>

      {/* Header */}
      <motion.div
        className="text-center mb-12 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* LEADERBOARD label */}
        <motion.p
          className="text-sm md:text-base font-semibold tracking-[0.3em] uppercase mb-4 gradient-text-pink"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Leaderboard
        </motion.p>

        {/* Main title */}
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Top 10 AI Models
        </h1>

        <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto">
          Compare the top AI models across key benchmarks. Hover over cards to see detailed scores.
        </p>
      </motion.div>

      {/* Model Cards */}
      <div className="space-y-6 max-w-5xl mx-auto px-4 relative z-10">
        {models.map((model, index) => (
          <motion.div
            key={model.rank}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
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

      {/* Footer hint */}
      <motion.div
        className="text-center mt-12 text-text-muted text-sm relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <p className="hidden md:block">Hover over a card to view benchmark details • Click to pin</p>
        <p className="md:hidden">Scroll to focus on a card and view benchmark details</p>
      </motion.div>
    </div>
  );
}
