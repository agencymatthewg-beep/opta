"use client";

import { ModelCard } from "@/components/features/ModelCard";
import { motion } from "framer-motion";
import { BarChart3, DollarSign, Newspaper, Trophy, ChevronDown } from "lucide-react";

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
      <div className={`w-full h-full rotate-45 border-2 ${colorClasses[color]}`} />
    </motion.div>
  );
}

// Section header component
function SectionHeader({
  id,
  icon: Icon,
  title,
  subtitle,
  iconColor = "text-neon-cyan"
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  iconColor?: string;
}) {
  return (
    <motion.div
      id={id}
      className="text-center mb-10 pt-20 -mt-20"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-glass-bg border border-glass-border mb-4 ${iconColor}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-text-secondary max-w-xl mx-auto">{subtitle}</p>
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

// Benchmark comparison data
const benchmarkData = [
  { name: "MMLU", description: "Massive Multitask Language Understanding", top: "Claude 3.5 Opus", topScore: 92.3 },
  { name: "HumanEval", description: "Code Generation Benchmark", top: "Claude 3.5 Sonnet", topScore: 92.0 },
  { name: "GPQA", description: "Graduate-Level Science QA", top: "Claude 3.5 Opus", topScore: 65.2 },
  { name: "MATH", description: "Mathematical Problem Solving", top: "Claude 3.5 Opus", topScore: 78.4 },
  { name: "GSM8K", description: "Grade School Math", top: "Claude 3.5 Opus", topScore: 96.1 },
  { name: "ARC-C", description: "AI2 Reasoning Challenge", top: "Claude 3.5 Opus", topScore: 97.2 },
];

// Pricing data
const pricingData = [
  { model: "Claude 3.5 Opus", provider: "Anthropic", input: "$15.00", output: "$75.00", context: "200K" },
  { model: "GPT-4 Turbo", provider: "OpenAI", input: "$10.00", output: "$30.00", context: "128K" },
  { model: "Gemini 2.0 Ultra", provider: "Google", input: "$7.00", output: "$21.00", context: "1M" },
  { model: "Claude 3.5 Sonnet", provider: "Anthropic", input: "$3.00", output: "$15.00", context: "200K" },
  { model: "Llama 3.1 405B", provider: "Meta (via API)", input: "$2.50", output: "$10.00", context: "128K" },
  { model: "Mistral Large 2", provider: "Mistral AI", input: "$2.00", output: "$6.00", context: "128K" },
];

// News data
const newsData = [
  {
    date: "Jan 28, 2025",
    title: "Claude 3.5 Opus Takes #1 Spot",
    summary: "Anthropic's latest model surpasses GPT-4 Turbo in comprehensive benchmark testing.",
    tag: "Rankings"
  },
  {
    date: "Jan 26, 2025",
    title: "DeepSeek V3 Debuts in Top 10",
    summary: "Chinese AI lab DeepSeek releases competitive new model with strong math capabilities.",
    tag: "New Model"
  },
  {
    date: "Jan 24, 2025",
    title: "Google Announces Gemini 2.0 Ultra",
    summary: "Next-generation multimodal model with 1M context window enters beta testing.",
    tag: "Announcement"
  },
  {
    date: "Jan 22, 2025",
    title: "OpenAI Reduces GPT-4 Turbo Pricing",
    summary: "API prices drop 20% as competition heats up in the LLM market.",
    tag: "Pricing"
  },
];

// Sticky navigation component
function StickyNav() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-opta-bg/80 backdrop-blur-xl border-b border-glass-border"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-white">AI Comp</span>
        <div className="hidden md:flex items-center gap-6">
          <a href="#models" className="text-sm text-text-secondary hover:text-white transition-colors">Models</a>
          <a href="#benchmarks" className="text-sm text-text-secondary hover:text-white transition-colors">Benchmarks</a>
          <a href="#pricing" className="text-sm text-text-secondary hover:text-white transition-colors">Pricing</a>
          <a href="#news" className="text-sm text-text-secondary hover:text-white transition-colors">News</a>
        </div>
      </div>
    </motion.nav>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen relative">
      {/* Sticky Navigation */}
      <StickyNav />

      {/* Background decorative diamonds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <FloatingDiamond className="absolute top-20 left-[10%]" delay={0} size={16} color="neon-orange" />
        <FloatingDiamond className="absolute top-40 right-[15%]" delay={0.5} size={12} color="neon-cyan" />
        <FloatingDiamond className="absolute top-[30%] left-[5%]" delay={1} size={10} color="neon-purple" />
        <FloatingDiamond className="absolute top-[45%] right-[8%]" delay={1.5} size={14} color="neon-pink" />
        <FloatingDiamond className="absolute top-[60%] left-[12%]" delay={2} size={8} color="neon-orange" />
        <FloatingDiamond className="absolute top-[75%] right-[20%]" delay={2.5} size={16} color="neon-cyan" />
      </div>

      {/* ============================================ */}
      {/* SECTION 1: HERO / LEADERBOARD (Models) */}
      {/* ============================================ */}
      <section id="models" className="pt-24 pb-16 px-4">
        {/* Hero Header */}
        <motion.div
          className="text-center mb-12 relative z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.p
            className="text-sm md:text-base font-semibold tracking-[0.3em] uppercase mb-4 gradient-text-pink"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Leaderboard
          </motion.p>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Top 10 AI Models
          </h1>
          <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto mb-8">
            Compare the top AI models across key benchmarks. Hover over cards to see detailed scores.
          </p>

          {/* Scroll indicator */}
          <motion.div
            className="flex flex-col items-center gap-2 text-text-muted"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-xs">Scroll to explore</span>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.div>

        {/* Model Cards */}
        <div className="space-y-6 max-w-5xl mx-auto relative z-10">
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

        {/* Card interaction hint */}
        <motion.div
          className="text-center mt-8 text-text-muted text-sm relative z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <p className="hidden md:block">Hover over a card to view benchmark details - Click to pin</p>
          <p className="md:hidden">Scroll to focus on a card and view benchmark details</p>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2: BENCHMARKS */}
      {/* ============================================ */}
      <section id="benchmarks" className="py-16 px-4 bg-gradient-to-b from-transparent via-purple-deep/5 to-transparent">
        <SectionHeader
          id="benchmarks-header"
          icon={BarChart3}
          title="Benchmarks"
          subtitle="Understanding the metrics that matter for AI model evaluation"
          iconColor="text-neon-green"
        />

        <div className="max-w-4xl mx-auto">
          {/* Benchmark cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {benchmarkData.map((benchmark, index) => (
              <motion.div
                key={benchmark.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-5 rounded-xl"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{benchmark.name}</h3>
                    <p className="text-xs text-text-muted">{benchmark.description}</p>
                  </div>
                  <span className="text-2xl font-bold text-neon-green">{benchmark.topScore}%</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="w-4 h-4 text-neon-orange" />
                  <span className="text-text-secondary">Leader:</span>
                  <span className="text-neon-pink font-medium">{benchmark.top}</span>
                </div>
                {/* Progress bar showing top score */}
                <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${benchmark.topScore}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 + 0.3, duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-neon-green to-neon-cyan rounded-full"
                  />
                </div>
              </motion.div>
            ))}
          </div>

          {/* Methodology note */}
          <motion.p
            className="text-center text-xs text-text-muted mt-8"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Benchmarks sourced from official papers, Hugging Face Open LLM Leaderboard, and provider documentation.
          </motion.p>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 3: PRICING */}
      {/* ============================================ */}
      <section id="pricing" className="py-16 px-4">
        <SectionHeader
          id="pricing-header"
          icon={DollarSign}
          title="Pricing"
          subtitle="Compare API pricing across top AI model providers (per 1M tokens)"
          iconColor="text-neon-amber"
        />

        <div className="max-w-4xl mx-auto overflow-x-auto">
          <motion.table
            className="w-full"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <thead>
              <tr className="border-b border-glass-border">
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Model</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Provider</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Input</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Output</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-text-muted uppercase tracking-wider">Context</th>
              </tr>
            </thead>
            <tbody>
              {pricingData.map((item, index) => (
                <motion.tr
                  key={item.model}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-glass-border/50 hover:bg-glass-hover transition-colors"
                >
                  <td className="py-4 px-4">
                    <span className="font-medium text-white">{item.model}</span>
                  </td>
                  <td className="py-4 px-4 text-text-secondary text-sm">{item.provider}</td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-neon-green">{item.input}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-mono text-neon-orange">{item.output}</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-text-secondary">{item.context}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </motion.table>
        </div>

        <motion.p
          className="text-center text-xs text-text-muted mt-6 max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          Prices shown are per 1 million tokens. Actual costs may vary based on usage tier, region, and special agreements.
        </motion.p>
      </section>

      {/* ============================================ */}
      {/* SECTION 4: NEWS */}
      {/* ============================================ */}
      <section id="news" className="py-16 px-4 bg-gradient-to-b from-transparent via-purple-deep/5 to-transparent">
        <SectionHeader
          id="news-header"
          icon={Newspaper}
          title="Latest News"
          subtitle="Stay updated with the latest developments in AI models and benchmarks"
          iconColor="text-neon-coral"
        />

        <div className="max-w-3xl mx-auto space-y-4">
          {newsData.map((item, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-5 rounded-xl hover:border-purple-glow/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-text-muted">{item.date}</span>
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-glow/20 text-purple-glow border border-purple-glow/30">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-neon-pink transition-colors mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-text-secondary">{item.summary}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <footer className="py-12 px-4 border-t border-glass-border">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-2xl font-bold text-white mb-2">AI Comp</p>
          <p className="text-text-muted text-sm mb-6">
            Comparing AI models so you don&apos;t have to.
          </p>

          {/* Quick links */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <a href="#models" className="text-sm text-text-secondary hover:text-neon-cyan transition-colors">Models</a>
            <a href="#benchmarks" className="text-sm text-text-secondary hover:text-neon-cyan transition-colors">Benchmarks</a>
            <a href="#pricing" className="text-sm text-text-secondary hover:text-neon-cyan transition-colors">Pricing</a>
            <a href="#news" className="text-sm text-text-secondary hover:text-neon-cyan transition-colors">News</a>
          </div>

          <p className="text-xs text-text-muted">
            Data sourced from official benchmarks and provider APIs. Updated daily.
          </p>
          <p className="text-xs text-text-muted mt-2">
            &copy; 2025 aicomp.optamize.biz
          </p>
        </div>
      </footer>
    </div>
  );
}
