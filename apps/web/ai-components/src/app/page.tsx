"use client";

import { ModelCard } from "@/components/features/ModelCard";

// Sample AI model data with benchmarks
const models = [
  {
    rank: 1,
    name: "Claude Opus 4.5",
    company: "Anthropic",
    status: "new" as const,
    score: 1423,
    tags: [{ type: "llm" as const }, { type: "multimodal" as const }],
    benchmarks: [
      { name: "MMLU", score: 92.3, maxScore: 100 },
      { name: "HumanEval", score: 89.1, maxScore: 100 },
      { name: "MATH", score: 78.5, maxScore: 100 },
      { name: "GSM8K", score: 96.2, maxScore: 100 },
    ],
  },
  {
    rank: 2,
    name: "GPT-4o",
    company: "OpenAI",
    status: "active" as const,
    score: 1398,
    tags: [{ type: "llm" as const }, { type: "multimodal" as const }, { type: "api" as const }],
    benchmarks: [
      { name: "MMLU", score: 91.8, maxScore: 100 },
      { name: "HumanEval", score: 87.2, maxScore: 100 },
      { name: "MATH", score: 76.4, maxScore: 100 },
      { name: "GSM8K", score: 95.1, maxScore: 100 },
    ],
  },
  {
    rank: 3,
    name: "Gemini 2.0 Ultra",
    company: "Google",
    status: "trending" as const,
    score: 1385,
    tags: [{ type: "llm" as const }, { type: "multimodal" as const }],
    benchmarks: [
      { name: "MMLU", score: 90.5, maxScore: 100 },
      { name: "HumanEval", score: 85.3, maxScore: 100 },
      { name: "MATH", score: 75.8, maxScore: 100 },
      { name: "GSM8K", score: 94.7, maxScore: 100 },
    ],
  },
  {
    rank: 4,
    name: "Claude 3.5 Sonnet",
    company: "Anthropic",
    status: "active" as const,
    score: 1352,
    tags: [{ type: "llm" as const }, { type: "api" as const }],
    benchmarks: [
      { name: "MMLU", score: 88.7, maxScore: 100 },
      { name: "HumanEval", score: 92.0, maxScore: 100 },
      { name: "MATH", score: 71.2, maxScore: 100 },
      { name: "GSM8K", score: 91.3, maxScore: 100 },
    ],
  },
  {
    rank: 5,
    name: "Llama 3.1 405B",
    company: "Meta",
    status: "active" as const,
    score: 1298,
    tags: [{ type: "llm" as const }],
    benchmarks: [
      { name: "MMLU", score: 85.2, maxScore: 100 },
      { name: "HumanEval", score: 81.4, maxScore: 100 },
      { name: "MATH", score: 68.9, maxScore: 100 },
      { name: "GSM8K", score: 89.5, maxScore: 100 },
    ],
  },
  {
    rank: 6,
    name: "Mistral Large 2",
    company: "Mistral AI",
    status: "new" as const,
    score: 1276,
    tags: [{ type: "llm" as const }, { type: "api" as const }],
    benchmarks: [
      { name: "MMLU", score: 84.1, maxScore: 100 },
      { name: "HumanEval", score: 79.8, maxScore: 100 },
      { name: "MATH", score: 65.3, maxScore: 100 },
      { name: "GSM8K", score: 87.2, maxScore: 100 },
    ],
  },
  {
    rank: 7,
    name: "DeepSeek V3",
    company: "DeepSeek",
    status: "trending" as const,
    score: 1254,
    tags: [{ type: "llm" as const }],
    benchmarks: [
      { name: "MMLU", score: 82.6, maxScore: 100 },
      { name: "HumanEval", score: 78.2, maxScore: 100 },
      { name: "MATH", score: 72.1, maxScore: 100 },
      { name: "GSM8K", score: 85.9, maxScore: 100 },
    ],
  },
  {
    rank: 8,
    name: "Grok-2",
    company: "xAI",
    status: "new" as const,
    score: 1231,
    tags: [{ type: "llm" as const }, { type: "web" as const }],
    benchmarks: [
      { name: "MMLU", score: 81.3, maxScore: 100 },
      { name: "HumanEval", score: 76.5, maxScore: 100 },
      { name: "MATH", score: 63.8, maxScore: 100 },
      { name: "GSM8K", score: 84.1, maxScore: 100 },
    ],
  },
  {
    rank: 9,
    name: "Qwen 2.5 72B",
    company: "Alibaba",
    status: "active" as const,
    score: 1198,
    tags: [{ type: "llm" as const }],
    benchmarks: [
      { name: "MMLU", score: 79.8, maxScore: 100 },
      { name: "HumanEval", score: 74.2, maxScore: 100 },
      { name: "MATH", score: 61.5, maxScore: 100 },
      { name: "GSM8K", score: 82.7, maxScore: 100 },
    ],
  },
  {
    rank: 10,
    name: "Gemini 1.5 Pro",
    company: "Google",
    status: "active" as const,
    score: 1175,
    tags: [{ type: "llm" as const }, { type: "multimodal" as const }, { type: "api" as const }],
    benchmarks: [
      { name: "MMLU", score: 78.4, maxScore: 100 },
      { name: "HumanEval", score: 72.8, maxScore: 100 },
      { name: "MATH", score: 58.9, maxScore: 100 },
      { name: "GSM8K", score: 80.3, maxScore: 100 },
    ],
  },
];

export default function ModelsPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-b from-white via-purple-300 to-indigo-400 bg-clip-text text-transparent mb-4">
          AI Model Rankings
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          Compare the top AI models across key benchmarks. Hover over cards to see detailed scores.
        </p>
      </div>

      {/* Model Cards */}
      <div className="space-y-6 max-w-5xl mx-auto px-4">
        {models.map((model) => (
          <ModelCard
            key={model.rank}
            rank={model.rank}
            name={model.name}
            company={model.company}
            status={model.status}
            score={model.score}
            tags={model.tags}
            benchmarks={model.benchmarks}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="text-center mt-12 text-text-muted text-sm">
        <p className="hidden md:block">Hover over a card to view benchmark details • Click to pin</p>
        <p className="md:hidden">Scroll to focus on a card and view benchmark details</p>
      </div>
    </div>
  );
}
