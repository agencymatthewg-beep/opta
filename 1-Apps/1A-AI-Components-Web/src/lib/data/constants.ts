// AI Comp - Constants and Static Data

import type { BenchmarkMetadata, ModelType, Modality } from '@/lib/types';

/**
 * Supported AI companies
 */
export const COMPANIES = [
  'Anthropic',
  'OpenAI',
  'Google',
  'Meta',
  'Mistral AI',
  'DeepSeek',
  'Alibaba',
  'xAI',
  'Cohere',
  'AI21 Labs',
  '01.AI',
  'Zhipu AI',
] as const;

export type Company = (typeof COMPANIES)[number];

/**
 * Benchmark metadata with explanations
 */
export const BENCHMARK_METADATA: Record<string, BenchmarkMetadata> = {
  'MMLU': {
    id: 'mmlu',
    name: 'MMLU',
    fullName: 'Massive Multitask Language Understanding',
    description: 'Tests knowledge across 57 subjects from elementary to professional level',
    category: 'knowledge',
    weight: 0.15,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2009.03300',
  },
  'MMLU-Pro': {
    id: 'mmlu-pro',
    name: 'MMLU-Pro',
    fullName: 'MMLU Professional',
    description: 'Enhanced MMLU with harder questions and more answer choices',
    category: 'knowledge',
    weight: 0.18,
    maxScore: 100,
    sourceUrl: 'https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro',
  },
  'HumanEval': {
    id: 'humaneval',
    name: 'HumanEval',
    fullName: 'HumanEval Code Generation',
    description: 'Measures code generation ability with Python programming problems',
    category: 'coding',
    weight: 0.15,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2107.03374',
  },
  'GPQA': {
    id: 'gpqa',
    name: 'GPQA',
    fullName: 'Graduate-Level Google-Proof Q&A',
    description: 'PhD-level science questions that require deep reasoning',
    category: 'reasoning',
    weight: 0.12,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2311.12022',
  },
  'MATH': {
    id: 'math',
    name: 'MATH',
    fullName: 'Mathematics Problem Solving',
    description: 'Competition-level mathematics problems',
    category: 'math',
    weight: 0.12,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2103.03874',
  },
  'GSM8K': {
    id: 'gsm8k',
    name: 'GSM8K',
    fullName: 'Grade School Math 8K',
    description: 'Grade school math word problems requiring multi-step reasoning',
    category: 'math',
    weight: 0.10,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2110.14168',
  },
  'ARC-C': {
    id: 'arc-c',
    name: 'ARC-C',
    fullName: 'AI2 Reasoning Challenge (Challenge)',
    description: 'Science questions requiring commonsense reasoning',
    category: 'reasoning',
    weight: 0.08,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/1803.05457',
  },
  'IFEval': {
    id: 'ifeval',
    name: 'IFEval',
    fullName: 'Instruction Following Evaluation',
    description: 'Tests ability to follow complex, verifiable instructions',
    category: 'instruction',
    weight: 0.10,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2311.07911',
  },
  'BBH': {
    id: 'bbh',
    name: 'BBH',
    fullName: 'BIG-Bench Hard',
    description: 'Challenging subset of BIG-Bench tasks requiring multi-step reasoning',
    category: 'reasoning',
    weight: 0.10,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2210.09261',
  },
  'MuSR': {
    id: 'musr',
    name: 'MuSR',
    fullName: 'Multi-Step Soft Reasoning',
    description: 'Tests multi-step reasoning with uncertainty',
    category: 'reasoning',
    weight: 0.08,
    maxScore: 100,
    sourceUrl: 'https://arxiv.org/abs/2310.16049',
  },
};

/**
 * API endpoints for data sources
 */
export const API_ENDPOINTS = {
  huggingface: {
    leaderboard: 'https://huggingface.co/api/spaces/open-llm-leaderboard/open_llm_leaderboard',
    datasets: 'https://huggingface.co/api/datasets/open-llm-leaderboard/results',
    models: 'https://huggingface.co/api/models',
  },
  openrouter: {
    models: 'https://openrouter.ai/api/v1/models',
  },
  lmsys: {
    arena: 'https://chat.lmsys.org/leaderboard',
  },
  artificialAnalysis: {
    api: 'https://artificialanalysis.ai/api',
  },
} as const;

/**
 * Source display names and colors
 */
export const SOURCE_STYLES: Record<string, { label: string; abbrev: string; bg: string; text: string; border: string }> = {
  huggingface: {
    label: 'Hugging Face',
    abbrev: 'HF',
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
  },
  openrouter: {
    label: 'OpenRouter',
    abbrev: 'OR',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
  },
  lmsys: {
    label: 'LMSys Chatbot Arena',
    abbrev: 'LMS',
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/40',
  },
  artificial_analysis: {
    label: 'Artificial Analysis',
    abbrev: 'AA',
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/40',
  },
  manual: {
    label: 'Manual Entry',
    abbrev: 'M',
    bg: 'bg-zinc-500/20',
    text: 'text-zinc-400',
    border: 'border-zinc-500/40',
  },
};

/**
 * Model type display styles
 */
export const MODEL_TYPE_STYLES: Record<ModelType, { label: string; bg: string; text: string; border: string }> = {
  llm: { label: 'LLM', bg: 'bg-neon-orange/20', text: 'text-neon-orange', border: 'border-neon-orange/40' },
  multimodal: { label: 'Multimodal', bg: 'bg-neon-amber/20', text: 'text-neon-amber', border: 'border-neon-amber/40' },
  embedding: { label: 'Embedding', bg: 'bg-white/10', text: 'text-text-secondary', border: 'border-white/20' },
  image: { label: 'Image', bg: 'bg-neon-pink/20', text: 'text-neon-pink', border: 'border-neon-pink/40' },
  audio: { label: 'Audio', bg: 'bg-blue-400/20', text: 'text-blue-400', border: 'border-blue-400/40' },
  video: { label: 'Video', bg: 'bg-red-400/20', text: 'text-red-400', border: 'border-red-400/40' },
  code: { label: 'Code', bg: 'bg-neon-green/20', text: 'text-neon-green', border: 'border-neon-green/40' },
  api: { label: 'API', bg: 'bg-neon-cyan/20', text: 'text-neon-cyan', border: 'border-neon-cyan/40' },
  web: { label: 'Web', bg: 'bg-neon-green/20', text: 'text-neon-green', border: 'border-neon-green/40' },
  cli: { label: 'CLI', bg: 'bg-purple-glow/20', text: 'text-purple-glow', border: 'border-purple-glow/40' },
  'open-source': { label: 'Open Source', bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/40' },
  proprietary: { label: 'Proprietary', bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/40' },
};

/**
 * Modality display labels
 */
export const MODALITY_LABELS: Record<Modality, string> = {
  text: 'Text',
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  code: 'Code',
};

/**
 * Benchmark color gradients for progress bars
 */
export const BENCHMARK_COLORS = [
  'from-neon-orange to-neon-amber',
  'from-neon-cyan to-blue-400',
  'from-purple-glow to-neon-pink',
  'from-neon-green to-emerald-400',
  'from-neon-pink to-neon-coral',
  'from-neon-amber to-yellow-400',
] as const;

/**
 * Status display styles
 */
export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-neon-green/20 text-neon-green border-neon-green/40',
  new: 'bg-purple-glow/20 text-purple-glow border-purple-glow/40',
  trending: 'bg-neon-orange/20 text-neon-orange border-neon-orange/40',
  deprecated: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/40',
  beta: 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40',
};

/**
 * Time formatting helpers
 */
export function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

/**
 * Format price for display
 */
export function formatPrice(pricePerMillion: number): string {
  if (pricePerMillion === 0) return 'Free';
  if (pricePerMillion < 0.01) return '<$0.01';
  if (pricePerMillion < 1) return `$${pricePerMillion.toFixed(2)}`;
  return `$${pricePerMillion.toFixed(2)}`;
}

/**
 * Format context length for display
 */
export function formatContextLength(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
}

/**
 * Normalize model name for matching across sources
 */
export function normalizeModelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/^(anthropic|openai|google|meta|mistral|deepseek|alibaba|xai|cohere)/, '');
}

/**
 * Calculate composite score from benchmarks
 */
export function calculateCompositeScore(benchmarks: { name: string; score: number }[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const benchmark of benchmarks) {
    const meta = BENCHMARK_METADATA[benchmark.name];
    if (meta) {
      weightedSum += benchmark.score * meta.weight;
      totalWeight += meta.weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 20); // Scale to ~2000 point system
}
