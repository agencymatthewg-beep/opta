"use client";

import { useState, useCallback } from "react";
import { ModelCard } from "@/components/features/ModelCard";
import { SearchBar } from "@/components/features/SearchBar";
import { FilterPanel, FilterPills } from "@/components/features/FilterPanel";
import { ComparePanel } from "@/components/features/ComparePanel";
import { CompareView } from "@/components/features/CompareView";
import { SourceBadgeGroup } from "@/components/features/SourceBadge";
import { useModels, useFilterOptions } from "@/lib/hooks/useModels";
import { motion } from "framer-motion";
import { BarChart3, DollarSign, Newspaper, Trophy, ChevronDown, RefreshCw, AlertCircle } from "lucide-react";
import type { LeaderboardFilters, AIModel } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

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

// Helper to format time ago for API data
function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

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

// Sticky navigation component (desktop only - mobile uses bottom nav)
function StickyNav() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-opta-bg/80 backdrop-blur-xl border-b border-glass-border sticky-header"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold text-white">AI Comp</span>
        {/* Desktop navigation - hidden on mobile */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#models" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm text-text-secondary hover:text-white transition-colors">Models</a>
          <a href="#benchmarks" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm text-text-secondary hover:text-white transition-colors">Benchmarks</a>
          <a href="#pricing" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm text-text-secondary hover:text-white transition-colors">Pricing</a>
          <a href="#news" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm text-text-secondary hover:text-white transition-colors">News</a>
        </div>
      </div>
    </motion.nav>
  );
}

// Mobile bottom navigation (visible on mobile only)
function MobileBottomNav() {
  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-opta-bg/95 backdrop-blur-xl border-t border-glass-border md:hidden mobile-nav"
    >
      <div className="flex items-stretch justify-around">
        <a
          href="#models"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-text-secondary hover:text-neon-cyan active:text-neon-cyan transition-colors"
        >
          <Trophy className="w-5 h-5" />
          <span className="text-xs">Models</span>
        </a>
        <a
          href="#benchmarks"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-text-secondary hover:text-neon-green active:text-neon-green transition-colors"
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-xs">Benchmarks</span>
        </a>
        <a
          href="#pricing"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-text-secondary hover:text-neon-amber active:text-neon-amber transition-colors"
        >
          <DollarSign className="w-5 h-5" />
          <span className="text-xs">Pricing</span>
        </a>
        <a
          href="#news"
          className="flex-1 flex flex-col items-center justify-center gap-1 py-3 min-h-[56px] text-text-secondary hover:text-neon-coral active:text-neon-coral transition-colors"
        >
          <Newspaper className="w-5 h-5" />
          <span className="text-xs">News</span>
        </a>
      </div>
    </motion.nav>
  );
}

export default function HomePage() {
  // Filters state
  const [filters, setFilters] = useState<LeaderboardFilters>(DEFAULT_FILTERS);

  // Fetch models using SWR
  const { models, allModels, isLoading, isError, error, refresh, source, lastUpdated, isFallback } = useModels({
    filters,
    enabled: true,
  });

  // Get filter options from all models
  const filterOptions = useFilterOptions(allModels);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<LeaderboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Handle model selection from search
  const handleModelSelect = useCallback((model: AIModel) => {
    // Scroll to the models section
    document.getElementById("models")?.scrollIntoView({ behavior: "smooth" });
    // Could also highlight the model or open its details
  }, []);

  return (
    <div className="min-h-screen relative pb-20 md:pb-0">
      {/* Sticky Navigation (desktop) */}
      <StickyNav />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Compare Panel - Sticky bottom bar */}
      <ComparePanel />

      {/* Compare View - Full screen modal */}
      <CompareView />

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
          className="text-center mb-8 relative z-10"
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
            AI Model Comparison
          </h1>
          <p className="text-text-secondary text-base md:text-lg max-w-2xl mx-auto mb-4">
            Compare the top AI models across key benchmarks. Hover over cards to see detailed scores.
          </p>

          {/* Data Source Attribution */}
          {source && source.length > 0 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="text-xs text-text-muted">Data from:</span>
              <SourceBadgeGroup sources={source} size="sm" maxVisible={3} />
              {isFallback && (
                <span className="text-xs text-neon-amber">(cached)</span>
              )}
            </div>
          )}

          {/* Last updated + Refresh */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {lastUpdated && (
              <span className="text-xs text-text-muted">
                Updated: {formatTimeAgo(lastUpdated)}
              </span>
            )}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="flex items-center gap-1 text-xs text-neon-cyan hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Search Bar */}
        <div className="max-w-5xl mx-auto mb-6 relative z-20">
          <SearchBar
            allModels={allModels}
            onSelect={handleModelSelect}
            onSearchChange={(search) => handleFilterChange({ search })}
            placeholder="Search models by name, company, or capability..."
            className="mx-auto"
          />
        </div>

        {/* Filter Panel */}
        <div className="max-w-5xl mx-auto mb-6 relative z-10">
          <FilterPanel
            filters={filters}
            onChange={handleFilterChange}
            options={{
              companies: filterOptions.companies,
              modelTypes: filterOptions.modelTypes,
              modalities: filterOptions.modalities,
              maxContext: filterOptions.maxContext,
              maxPrice: filterOptions.maxPrice,
            }}
          />

          {/* Active Filter Pills */}
          <FilterPills
            filters={filters}
            onChange={handleFilterChange}
            className="mt-3"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-sm">Loading models...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col items-center justify-center py-16 gap-4 glass-card rounded-xl p-8">
              <AlertCircle className="w-12 h-12 text-neon-coral" />
              <p className="text-white font-medium">Failed to load models</p>
              <p className="text-text-muted text-sm text-center max-w-md">
                {error?.message || "An error occurred while fetching the data."}
              </p>
              <button
                onClick={refresh}
                className="px-4 py-2 bg-neon-cyan/20 hover:bg-neon-cyan/30 border border-neon-cyan/30 rounded-lg text-neon-cyan transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && models.length === 0 && (
          <div className="max-w-5xl mx-auto relative z-10">
            <div className="flex flex-col items-center justify-center py-16 gap-4 glass-card rounded-xl p-8">
              <Trophy className="w-12 h-12 text-text-muted" />
              <p className="text-white font-medium">No models found</p>
              <p className="text-text-muted text-sm text-center max-w-md">
                Try adjusting your search or filters to find what you&apos;re looking for.
              </p>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="px-4 py-2 bg-purple-glow/20 hover:bg-purple-glow/30 border border-purple-glow/30 rounded-lg text-purple-glow transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Model Cards */}
        {!isLoading && !isError && models.length > 0 && (
          <>
            {/* Results count */}
            <div className="max-w-5xl mx-auto mb-4 relative z-10">
              <p className="text-xs text-text-muted">
                Showing {models.length} of {allModels.length} models
              </p>
            </div>

            <div className="space-y-6 max-w-5xl mx-auto relative z-10">
              {models.map((model, index) => (
                <motion.div
                  key={model.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                >
                  <ModelCard
                    rank={model.rank}
                    name={model.name}
                    company={model.company}
                    update={formatTimeAgo(model.lastUpdated)}
                    status={model.status as "active" | "new" | "trending" | "deprecated" | "beta"}
                    score={model.compositeScore}
                    tags={model.tags as { type: "llm" | "web" | "cli" | "api" | "multimodal" | "embedding" | "image" | "audio" | "video" | "code" | "open-source" | "proprietary"; parameters?: string }[]}
                    benchmarks={model.benchmarks}
                    sources={model.sources}
                  />
                </motion.div>
              ))}
            </div>
          </>
        )}

        {/* Card interaction hint */}
        {!isLoading && !isError && models.length > 0 && (
          <motion.div
            className="text-center mt-8 text-text-muted text-sm relative z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <p className="hidden md:block">Hover over a card to view benchmark details - Click to pin</p>
            <p className="md:hidden">Tap &quot;Show Graph&quot; to expand benchmark details</p>
          </motion.div>
        )}
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

        <div className="max-w-4xl mx-auto overflow-x-auto relative scroll-hint-x md:scroll-hint-x-none">
          {/* Mobile scroll hint */}
          <p className="text-xs text-text-muted mb-2 md:hidden text-center">← Scroll horizontally to see all columns →</p>
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
