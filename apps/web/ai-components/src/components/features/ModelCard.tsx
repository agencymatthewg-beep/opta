"use client";

import { useState, useRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "./CompanyLogo";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";
import { useCentralCard } from "@/lib/hooks/useCentralCard";

// Model type definitions
export type ModelType = "llm" | "web" | "cli" | "api" | "multimodal" | "embedding" | "image" | "audio" | "video";

export interface ModelTag {
  type: ModelType;
  parameters?: string;
}

export interface BenchmarkScore {
  name: string;
  score: number;
  maxScore?: number;
}

interface ModelCardProps {
  rank: number;
  name: string;
  company: string;
  update?: string;
  status?: "active" | "new" | "trending";
  score?: number;
  tags?: ModelTag[];
  benchmarks?: BenchmarkScore[];
  className?: string;
}

// Vibrant tag styles
const tagStyles: Record<ModelType, { bg: string; text: string; border: string; label: string }> = {
  llm: { bg: "bg-neon-orange/20", text: "text-neon-orange", border: "border-neon-orange/40", label: "LLM" },
  web: { bg: "bg-neon-green/20", text: "text-neon-green", border: "border-neon-green/40", label: "WEB" },
  cli: { bg: "bg-purple-glow/20", text: "text-purple-glow", border: "border-purple-glow/40", label: "CLI" },
  api: { bg: "bg-neon-cyan/20", text: "text-neon-cyan", border: "border-neon-cyan/40", label: "API" },
  multimodal: { bg: "bg-neon-amber/20", text: "text-neon-amber", border: "border-neon-amber/40", label: "MULTIMODAL" },
  embedding: { bg: "bg-white/10", text: "text-text-secondary", border: "border-white/20", label: "EMBEDDING" },
  image: { bg: "bg-neon-pink/20", text: "text-neon-pink", border: "border-neon-pink/40", label: "IMAGE" },
  audio: { bg: "bg-blue-400/20", text: "text-blue-400", border: "border-blue-400/40", label: "AUDIO" },
  video: { bg: "bg-red-400/20", text: "text-red-400", border: "border-red-400/40", label: "VIDEO" },
};

// Colorful benchmark progress bar colors
const benchmarkColors = [
  "from-neon-orange to-neon-amber",
  "from-neon-cyan to-blue-400",
  "from-purple-glow to-neon-pink",
  "from-neon-green to-emerald-400",
  "from-neon-pink to-neon-coral",
  "from-neon-amber to-yellow-400",
];

// Centered Diamond rank badge
function DiamondRank({ rank, isExpanded, size = "normal" }: { rank: number; isExpanded: boolean; size?: "normal" | "large" }) {
  const dimensions = size === "large" ? "w-16 h-16" : "w-12 h-12";
  const fontSize = size === "large" ? "text-xl" : "text-base";

  return (
    <motion.div
      animate={{
        boxShadow: isExpanded
          ? "0 0 30px rgba(251, 146, 60, 0.7), 0 0 60px rgba(251, 146, 60, 0.4)"
          : "0 0 15px rgba(251, 146, 60, 0.4), 0 0 30px rgba(251, 146, 60, 0.2)",
      }}
      className={cn("relative flex items-center justify-center", dimensions)}
    >
      <div className="absolute inset-0 rotate-45 border border-neon-orange/30 rounded-sm scale-125" />
      <div className="absolute inset-0 rotate-45 border-2 border-neon-orange bg-gradient-to-br from-neon-orange/30 to-neon-orange/10 rounded-sm" />
      <div className="absolute inset-1 rotate-45 border border-neon-orange/20 rounded-sm" />
      <span className={cn("relative z-10 font-bold text-white", fontSize)}>{rank}</span>
    </motion.div>
  );
}

// Benchmark item for internal grid - ONLY animates, static elements stay static
function BenchmarkItem({ benchmark, index }: { benchmark: BenchmarkScore; index: number }) {
  const percentage = benchmark.maxScore ? (benchmark.score / benchmark.maxScore) * 100 : benchmark.score;
  const colorIndex = index % benchmarkColors.length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-1"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-secondary">{benchmark.name}</span>
        <span className="text-xs font-mono text-white">
          {benchmark.score}
          {benchmark.maxScore && <span className="text-text-muted">/{benchmark.maxScore}</span>}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ delay: index * 0.04 + 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full bg-gradient-to-r ${benchmarkColors[colorIndex]} rounded-full`}
        />
      </div>
    </motion.div>
  );
}

export function ModelCard({
  rank,
  name,
  company,
  update,
  status = "active",
  score,
  tags = [],
  benchmarks = [],
  className,
}: ModelCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();

  const isCentral = useCentralCard(cardId, cardRef);
  const isExpanded = isMobile ? isCentral : (isHovered || isPinned);
  const showBenchmarks = isExpanded && benchmarks.length > 0;

  const statusColors = {
    active: "bg-neon-green/20 text-neon-green border-neon-green/40",
    new: "bg-purple-glow/20 text-purple-glow border-purple-glow/40",
    trending: "bg-neon-orange/20 text-neon-orange border-neon-orange/40",
  };

  // Split benchmarks for left/right columns
  const midpoint = Math.ceil(benchmarks.length / 2);
  const leftBenchmarks = benchmarks.slice(0, midpoint);
  const rightBenchmarks = benchmarks.slice(midpoint);

  const handleClick = () => {
    if (!isMobile && benchmarks.length > 0) {
      setIsPinned(!isPinned);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isMobile ? undefined : { scale: 1.01, transition: { duration: 0.2 } }}
      onHoverStart={isMobile ? undefined : () => setIsHovered(true)}
      onHoverEnd={isMobile ? undefined : () => setIsHovered(false)}
      onClick={handleClick}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative group w-full max-w-4xl mx-auto",
        !isMobile && benchmarks.length > 0 && "cursor-pointer",
        className
      )}
    >
      {/* Green glow border when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -inset-0.5 rounded-2xl border-2 border-neon-green/50 pointer-events-none"
            style={{ boxShadow: "0 0 25px rgba(74, 222, 128, 0.3), inset 0 0 25px rgba(74, 222, 128, 0.1)" }}
          />
        )}
      </AnimatePresence>

      {/* Background Purple Glow */}
      <div className={cn(
        "absolute -inset-1 rounded-2xl blur-xl transition duration-500",
        isExpanded
          ? "bg-gradient-to-r from-neon-green/20 via-purple-glow/30 to-neon-green/20 opacity-60"
          : "bg-gradient-to-r from-purple-deep/40 to-purple-glow/40 opacity-30 group-hover:opacity-50"
      )} />

      {/* Main Glass Container */}
      <motion.div
        layout
        className={cn(
          "relative backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden",
          isExpanded ? "glass-card-expanded" : "glass-card"
        )}
      >
        {/* Top light streak */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />

        {/* Card Content - STATIC elements always visible, only benchmarks animate */}
        <div className="px-4 md:px-6 py-5">
          {/* Desktop: 3-column grid layout */}
          {!isMobile ? (
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-center">
              {/* Left Benchmarks Column - Only visible when expanded */}
              <div className="space-y-3 flex flex-col justify-center min-h-[80px]">
                <AnimatePresence>
                  {showBenchmarks && leftBenchmarks.map((benchmark, index) => (
                    <BenchmarkItem key={benchmark.name} benchmark={benchmark} index={index} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Center Column: STATIC - Name + Diamond + Tags (always visible, no animation) */}
              <div className="flex flex-col items-center justify-center px-4 min-w-[200px]">
                {/* Model Name + Company - STATIC */}
                <div className="text-center mb-3">
                  <h3 className={cn(
                    "text-lg md:text-xl font-semibold transition-colors inline-flex items-center gap-2",
                    isExpanded ? "text-neon-coral" : "text-neon-pink"
                  )}>
                    <CompanyLogo company={company} size={24} />
                    {name}
                  </h3>
                  <p className="text-xs text-text-secondary">{company}</p>
                </div>

                {/* Centered Diamond - STATIC */}
                <div className="mb-3">
                  <DiamondRank rank={rank} isExpanded={isExpanded} size="large" />
                </div>

                {/* Tags - STATIC */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {tags.map((tag, index) => {
                    const style = tagStyles[tag.type];
                    return (
                      <span
                        key={index}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded-full border uppercase tracking-wider",
                          style.bg, style.text, style.border
                        )}
                      >
                        {style.label}{tag.parameters && <span className="ml-1 opacity-80">{tag.parameters}</span>}
                      </span>
                    );
                  })}
                </div>

                {/* Score + Status - STATIC */}
                <div className="flex items-center gap-2 mt-2">
                  {update && <span className="text-[10px] text-text-muted font-mono">{update}</span>}

                  {score !== undefined && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-glow/10 border border-purple-glow/30">
                      <span className="text-sm font-mono text-purple-glow">{score}</span>
                      <span className="text-[10px] text-text-muted">pts</span>
                    </div>
                  )}

                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded-full border uppercase tracking-wider",
                    statusColors[status]
                  )}>
                    {status}
                  </span>

                  {benchmarks.length > 0 && (
                    <motion.div
                      animate={{ rotate: isPinned ? 45 : 0 }}
                      className={cn(
                        "w-5 h-5 flex items-center justify-center rounded-full transition-colors",
                        isPinned ? "bg-neon-green/30 text-neon-green" : "bg-white/5 text-text-muted"
                      )}
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" />
                      </svg>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Right Benchmarks Column - Only visible when expanded */}
              <div className="space-y-3 flex flex-col justify-center min-h-[80px]">
                <AnimatePresence>
                  {showBenchmarks && rightBenchmarks.map((benchmark, index) => (
                    <BenchmarkItem key={benchmark.name} benchmark={benchmark} index={index + midpoint} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* Mobile: Vertical stack - STATIC header, animated benchmarks */
            <div className="space-y-4">
              {/* Header: STATIC - Name + Diamond + Tags (always visible, no animation) */}
              <div className="text-center">
                <h3 className={cn(
                  "text-lg font-semibold transition-colors inline-flex items-center gap-2 mb-2",
                  isExpanded ? "text-neon-coral" : "text-neon-pink"
                )}>
                  <CompanyLogo company={company} size={20} />
                  {name}
                  <span className="text-text-secondary text-sm font-normal">• {company}</span>
                </h3>

                <div className="flex justify-center mb-3">
                  <DiamondRank rank={rank} isExpanded={isExpanded} size="large" />
                </div>

                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {tags.map((tag, index) => {
                    const style = tagStyles[tag.type];
                    return (
                      <span
                        key={index}
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-medium rounded-full border uppercase tracking-wider",
                          style.bg, style.text, style.border
                        )}
                      >
                        {style.label}
                      </span>
                    );
                  })}
                  {score !== undefined && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-glow/10 border border-purple-glow/30">
                      <span className="text-sm font-mono text-purple-glow">{score}</span>
                      <span className="text-[10px] text-text-muted">pts</span>
                    </div>
                  )}
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-medium rounded-full border uppercase tracking-wider",
                    statusColors[status]
                  )}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Benchmarks Section - Only this part animates */}
              <AnimatePresence>
                {showBenchmarks && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="border-t border-purple-glow/20 pt-4 overflow-hidden"
                  >
                    <p className="text-[10px] font-mono text-purple-light uppercase tracking-wider mb-3 text-center">
                      Benchmark Scores
                    </p>
                    <div className="space-y-3">
                      {benchmarks.map((benchmark, index) => (
                        <BenchmarkItem key={benchmark.name} benchmark={benchmark} index={index} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-glow/50 to-transparent" />
      </motion.div>
    </motion.div>
  );
}
