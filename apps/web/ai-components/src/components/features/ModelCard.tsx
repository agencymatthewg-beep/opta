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

// Vibrant tag styles matching reference image
const tagStyles: Record<ModelType, { bg: string; text: string; border: string; label: string }> = {
  llm: {
    bg: "bg-neon-orange/20",
    text: "text-neon-orange",
    border: "border-neon-orange/40",
    label: "LLM",
  },
  web: {
    bg: "bg-neon-green/20",
    text: "text-neon-green",
    border: "border-neon-green/40",
    label: "WEB",
  },
  cli: {
    bg: "bg-purple-glow/20",
    text: "text-purple-glow",
    border: "border-purple-glow/40",
    label: "CLI",
  },
  api: {
    bg: "bg-neon-cyan/20",
    text: "text-neon-cyan",
    border: "border-neon-cyan/40",
    label: "API",
  },
  multimodal: {
    bg: "bg-neon-amber/20",
    text: "text-neon-amber",
    border: "border-neon-amber/40",
    label: "MULTIMODAL",
  },
  embedding: {
    bg: "bg-white/10",
    text: "text-text-secondary",
    border: "border-white/20",
    label: "EMBEDDING",
  },
  image: {
    bg: "bg-neon-pink/20",
    text: "text-neon-pink",
    border: "border-neon-pink/40",
    label: "IMAGE",
  },
  audio: {
    bg: "bg-blue-400/20",
    text: "text-blue-400",
    border: "border-blue-400/40",
    label: "AUDIO",
  },
  video: {
    bg: "bg-red-400/20",
    text: "text-red-400",
    border: "border-red-400/40",
    label: "VIDEO",
  },
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

// Diamond rank badge component
function DiamondRank({ rank, isExpanded }: { rank: number; isExpanded: boolean }) {
  return (
    <motion.div
      animate={{
        boxShadow: isExpanded
          ? "0 0 20px rgba(251, 146, 60, 0.6), 0 0 40px rgba(251, 146, 60, 0.3)"
          : "0 0 10px rgba(251, 146, 60, 0.3)",
      }}
      className="relative w-10 h-10 flex items-center justify-center"
    >
      <div className="absolute inset-0 rotate-45 border-2 border-neon-orange bg-neon-orange/20 rounded-sm" />
      <span className="relative z-10 text-sm font-bold text-white">{rank}</span>
    </motion.div>
  );
}

// Desktop benchmark item for horizontal wings
function BenchmarkItem({ benchmark, index, side }: { benchmark: BenchmarkScore; index: number; side: "left" | "right" }) {
  const percentage = benchmark.maxScore
    ? (benchmark.score / benchmark.maxScore) * 100
    : benchmark.score;

  const colorIndex = index % benchmarkColors.length;

  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: side === "left" ? -20 : 20 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-1 min-w-[100px]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-secondary truncate">{benchmark.name}</span>
        <span className="text-xs font-mono text-white">
          {benchmark.score}
          {benchmark.maxScore && <span className="text-text-muted">/{benchmark.maxScore}</span>}
        </span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ delay: index * 0.05 + 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full bg-gradient-to-r ${benchmarkColors[colorIndex]} rounded-full`}
        />
      </div>
    </motion.div>
  );
}

// Mobile benchmark item for vertical expansion
function MobileBenchmarkItem({ benchmark, index }: { benchmark: BenchmarkScore; index: number }) {
  const percentage = benchmark.maxScore
    ? (benchmark.score / benchmark.maxScore) * 100
    : benchmark.score;

  const colorIndex = index % benchmarkColors.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-1.5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-secondary">{benchmark.name}</span>
        <span className="text-sm font-mono text-white">
          {benchmark.score}
          {benchmark.maxScore && <span className="text-text-muted text-xs">/{benchmark.maxScore}</span>}
        </span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          transition={{ delay: index * 0.03 + 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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

  // On mobile, detect if this card is most central on screen
  const isCentral = useCentralCard(cardId, cardRef);

  const isExpanded = isMobile ? isCentral : (isHovered || isPinned);

  const statusColors = {
    active: "bg-neon-green/20 text-neon-green border-neon-green/40",
    new: "bg-purple-glow/20 text-purple-glow border-purple-glow/40",
    trending: "bg-neon-orange/20 text-neon-orange border-neon-orange/40",
  };

  // Desktop: show wings on hover or when pinned
  const showDesktopBenchmarks = !isMobile && (isHovered || isPinned) && benchmarks.length > 0;

  // Mobile: show vertical benchmarks when card is central
  const showMobileBenchmarks = isMobile && isCentral && benchmarks.length > 0;

  // Split benchmarks into left and right wings (desktop only)
  const midpoint = Math.ceil(benchmarks.length / 2);
  const leftBenchmarks = benchmarks.slice(0, midpoint);
  const rightBenchmarks = benchmarks.slice(midpoint);

  const handleClick = () => {
    if (!isMobile && benchmarks.length > 0) {
      // Desktop: toggle pin state
      setIsPinned(!isPinned);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: isMobile && isCentral ? 1.02 : 1,
      }}
      whileHover={isMobile ? undefined : { scale: 1.01, transition: { duration: 0.2 } }}
      onHoverStart={isMobile ? undefined : () => setIsHovered(true)}
      onHoverEnd={isMobile ? undefined : () => setIsHovered(false)}
      onClick={handleClick}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative group w-full max-w-4xl mx-auto mb-4",
        !isMobile && "cursor-pointer",
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
            className="absolute -inset-0.5 rounded-3xl border-2 border-neon-green/50 pointer-events-none"
            style={{
              boxShadow: "0 0 20px rgba(74, 222, 128, 0.3), inset 0 0 20px rgba(74, 222, 128, 0.1)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Background Purple Glow Effect */}
      <div className={cn(
        "absolute -inset-0.5 bg-gradient-to-r from-purple-deep to-purple-glow rounded-3xl blur transition duration-500",
        isExpanded ? "opacity-0" : "opacity-20 group-hover:opacity-30"
      )} />

      {/* Main Glass Container */}
      <div className={cn(
        "relative flex flex-col bg-purple-deep/10 backdrop-blur-xl border border-purple-glow/20 rounded-3xl shadow-2xl transition-all duration-300",
        isMobile ? "overflow-hidden" : "overflow-visible",
      )}>
        {/* Refractive Light Streak */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />

        {/* Left Wing - Benchmarks (desktop only) */}
        <AnimatePresence>
          {showDesktopBenchmarks && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 0 }}
              animate={{ width: "auto", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-full top-0 bottom-0 flex items-center bg-purple-deep/20 backdrop-blur-xl border border-purple-glow/20 border-r-0 rounded-l-3xl overflow-hidden"
              style={{ marginRight: -1 }}
            >
              <div className="flex flex-col gap-2 px-5">
                {leftBenchmarks.map((benchmark, index) => (
                  <BenchmarkItem key={benchmark.name} benchmark={benchmark} index={index} side="left" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Content - Model Info */}
        <div className={cn(
          "flex flex-col items-center justify-center px-4 md:px-8 py-4",
          !isMobile && "h-[120px]"
        )}>
          {/* Top Row: Diamond Rank + Logo + Name + Company */}
          <div className="flex items-center gap-3 md:gap-4 mb-2">
            {/* Diamond Rank Badge */}
            <DiamondRank rank={rank} isExpanded={isExpanded} />

            {/* Company Logo */}
            <div className="flex-shrink-0">
              <CompanyLogo company={company} size={isMobile ? 32 : 40} />
            </div>

            {/* Model Name - Pink/Coral */}
            <h3 className={cn(
              "text-base md:text-lg font-semibold transition-colors duration-300",
              isExpanded ? "text-neon-coral" : "text-neon-pink"
            )}>
              {name}
            </h3>

            {/* Company (hidden on very small screens) */}
            <span className="text-xs md:text-sm text-text-secondary hidden sm:inline">•</span>
            <span className="text-xs md:text-sm text-text-secondary hidden sm:inline">{company}</span>
          </div>

          {/* Bottom Row: Tags + Status + Score */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
            {/* Model Type Tags - Colorful */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1.5">
                {tags.map((tag, index) => {
                  const style = tagStyles[tag.type];
                  return (
                    <span
                      key={index}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium rounded-full border uppercase tracking-wider",
                        style.bg,
                        style.text,
                        style.border
                      )}
                    >
                      {style.label}
                      {tag.parameters && (
                        <span className="ml-1 opacity-80">{tag.parameters}</span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Divider */}
            {(tags.length > 0 && (score !== undefined || status)) && (
              <span className="text-text-muted/30 hidden sm:inline">|</span>
            )}

            {/* Update timestamp */}
            {update && (
              <span className="text-[10px] text-text-muted font-mono hidden md:inline">
                {update}
              </span>
            )}

            {/* Score display */}
            {score !== undefined && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-glow/10 border border-purple-glow/30">
                <span className="text-xs md:text-sm font-mono text-purple-glow">{score}</span>
                <span className="text-[10px] text-text-muted">pts</span>
              </div>
            )}

            {/* Status badge */}
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] font-medium rounded-full border uppercase tracking-wider",
                statusColors[status]
              )}
            >
              {status}
            </span>

            {/* Desktop pin indicator */}
            {!isMobile && benchmarks.length > 0 && (
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

        {/* Mobile Benchmarks - Vertical Expansion */}
        <AnimatePresence>
          {showMobileBenchmarks && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 border-t border-purple-glow/10">
                <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-3">
                  Benchmark Scores
                </p>
                <div className="space-y-3">
                  {benchmarks.map((benchmark, index) => (
                    <MobileBenchmarkItem key={benchmark.name} benchmark={benchmark} index={index} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Wing - Benchmarks (desktop only) */}
        <AnimatePresence>
          {showDesktopBenchmarks && (
            <motion.div
              initial={{ width: 0, opacity: 0, x: 0 }}
              animate={{ width: "auto", opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-full top-0 bottom-0 flex items-center bg-purple-deep/20 backdrop-blur-xl border border-purple-glow/20 border-l-0 rounded-r-3xl overflow-hidden"
              style={{ marginLeft: -1 }}
            >
              <div className="flex flex-col gap-2 px-5">
                {rightBenchmarks.map((benchmark, index) => (
                  <BenchmarkItem key={benchmark.name} benchmark={benchmark} index={index} side="right" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-glow/30 to-transparent" />
      </div>
    </motion.div>
  );
}
