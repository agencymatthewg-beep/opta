"use client";

import { useState, useRef, useId, useCallback } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform, useAnimation } from "framer-motion";
import { ChevronDown, Info, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyLogo } from "./CompanyLogo";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";
import { InlineSourceBadge, SourceBadgeGroup } from "./SourceBadge";
import type { DataSource } from "@/lib/types";

// Model type definitions
export type ModelType = "llm" | "web" | "cli" | "api" | "multimodal" | "embedding" | "image" | "audio" | "video" | "open-source" | "proprietary" | "code";

export interface ModelTag {
  type: ModelType;
  parameters?: string;
}

export interface BenchmarkScore {
  name: string;
  score: number;
  maxScore?: number;
  source?: DataSource;
}

interface ModelCardProps {
  rank: number;
  previousRank?: number;
  name: string;
  company: string;
  update?: string;
  status?: "active" | "new" | "trending" | "deprecated" | "beta";
  score?: number;
  tags?: ModelTag[];
  benchmarks?: BenchmarkScore[];
  sources?: DataSource[];
  className?: string;
  onOpenDetails?: () => void;
}

// Vibrant tag styles - using Opta design tokens only
const tagStyles: Record<ModelType, { bg: string; text: string; border: string; label: string }> = {
  llm: { bg: "bg-neon-orange/20", text: "text-neon-orange", border: "border-neon-orange/40", label: "LLM" },
  web: { bg: "bg-neon-green/20", text: "text-neon-green", border: "border-neon-green/40", label: "WEB" },
  cli: { bg: "bg-purple-glow/20", text: "text-purple-glow", border: "border-purple-glow/40", label: "CLI" },
  api: { bg: "bg-neon-cyan/20", text: "text-neon-cyan", border: "border-neon-cyan/40", label: "API" },
  multimodal: { bg: "bg-neon-amber/20", text: "text-neon-amber", border: "border-neon-amber/40", label: "MULTIMODAL" },
  embedding: { bg: "bg-white/10", text: "text-text-secondary", border: "border-white/20", label: "EMBEDDING" },
  image: { bg: "bg-neon-pink/20", text: "text-neon-pink", border: "border-neon-pink/40", label: "IMAGE" },
  audio: { bg: "bg-neon-cyan/20", text: "text-neon-cyan", border: "border-neon-cyan/40", label: "AUDIO" },
  video: { bg: "bg-neon-coral/20", text: "text-neon-coral", border: "border-neon-coral/40", label: "VIDEO" },
  code: { bg: "bg-neon-green/20", text: "text-neon-green", border: "border-neon-green/40", label: "CODE" },
  "open-source": { bg: "bg-neon-green/20", text: "text-neon-green", border: "border-neon-green/40", label: "OPEN" },
  proprietary: { bg: "bg-white/10", text: "text-text-muted", border: "border-glass-border", label: "PROP" },
};

// Colorful benchmark progress bar colors - using design tokens only
const benchmarkColors = [
  "from-neon-orange to-neon-amber",
  "from-neon-cyan to-purple-glow",
  "from-purple-glow to-neon-pink",
  "from-neon-green to-neon-cyan",
  "from-neon-pink to-neon-coral",
  "from-neon-amber to-neon-orange",
];

// Centered Diamond rank badge - uses glow tokens from globals.css
function DiamondRank({ rank, isExpanded, size = "normal" }: { rank: number; isExpanded: boolean; size?: "normal" | "large" }) {
  const dimensions = size === "large" ? "w-16 h-16" : "w-12 h-12";
  const fontSize = size === "large" ? "text-xl" : "text-base";

  return (
    <motion.div
      animate={{
        boxShadow: isExpanded
          ? "var(--glow-orange-lg), 0 0 60px rgba(251, 146, 60, 0.4)"
          : "var(--glow-orange-md)",
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

// Trend indicator showing rank movement
function TrendIndicator({ currentRank, previousRank }: { currentRank: number; previousRank?: number }) {
  if (previousRank === undefined || previousRank === currentRank) return null;

  const change = previousRank - currentRank;
  const isUp = change > 0;
  const absChange = Math.abs(change);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
        isUp
          ? "bg-neon-green/20 text-neon-green"
          : "bg-neon-coral/20 text-neon-coral"
      )}
      title={isUp ? `Up ${absChange} from #${previousRank}` : `Down ${absChange} from #${previousRank}`}
    >
      <svg
        className={cn("w-2.5 h-2.5", !isUp && "rotate-180")}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
          clipRule="evenodd"
        />
      </svg>
      <span>{absChange}</span>
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
        <span className="text-xs text-text-secondary">{benchmark.name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono text-white">
            {benchmark.score}
            {benchmark.maxScore && <span className="text-text-muted">/{benchmark.maxScore}</span>}
          </span>
          {benchmark.source && (
            <InlineSourceBadge source={benchmark.source} />
          )}
        </div>
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
  previousRank,
  name,
  company,
  update,
  status = "active",
  score,
  tags = [],
  benchmarks = [],
  sources = [],
  className,
  onOpenDetails,
}: ModelCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);
  const cardId = useId();

  // Swipe gesture controls
  const swipeX = useMotionValue(0);
  const swipeControls = useAnimation();
  const swipeOpacity = useTransform(swipeX, [0, 80], [0, 1]);
  const swipeScale = useTransform(swipeX, [0, 80], [0.8, 1]);

  // Handle swipe gestures on mobile
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 80 && onOpenDetails) {
      // Swipe right threshold reached - open details
      onOpenDetails();
    }
    // Reset swipe position
    swipeControls.start({ x: 0 });
  }, [onOpenDetails, swipeControls]);

  // Desktop: hover/pin to expand | Mobile: manual button press only
  const isExpanded = isMobile ? mobileExpanded : (isHovered || isPinned);
  const showBenchmarks = isExpanded && benchmarks.length > 0;

  const statusColors = {
    active: "bg-neon-green/20 text-neon-green border-neon-green/40",
    new: "bg-purple-glow/20 text-purple-glow border-purple-glow/40",
    trending: "bg-neon-orange/20 text-neon-orange border-neon-orange/40",
    deprecated: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
    beta: "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40",
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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      role={benchmarks.length > 0 ? "button" : undefined}
      tabIndex={benchmarks.length > 0 ? 0 : undefined}
      aria-expanded={benchmarks.length > 0 ? isExpanded : undefined}
      aria-label={`${name} by ${company}, ranked #${rank}${isExpanded ? ", expanded to show benchmarks" : ""}`}
      className={cn(
        "relative group w-full max-w-4xl mx-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-opta-bg rounded-2xl",
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

                {/* Centered Diamond with Trend - STATIC */}
                <div className="mb-3 flex flex-col items-center gap-1">
                  <DiamondRank rank={rank} isExpanded={isExpanded} size="large" />
                  <TrendIndicator currentRank={rank} previousRank={previousRank} />
                </div>

                {/* Tags - STATIC */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {tags.map((tag, index) => {
                    const style = tagStyles[tag.type];
                    return (
                      <span
                        key={index}
                        className={cn(
                          "px-2 py-0.5 text-[11px] font-medium rounded-full border uppercase tracking-wider",
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
                  {update && <span className="text-[11px] text-text-muted font-mono">{update}</span>}

                  {score !== undefined && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-glow/10 border border-purple-glow/30">
                      <span className="text-sm font-mono text-purple-glow">{score}</span>
                      <span className="text-[11px] text-text-muted">pts</span>
                    </div>
                  )}

                  <span className={cn(
                    "px-2 py-0.5 text-[11px] font-medium rounded-full border uppercase tracking-wider",
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

                {/* Data Sources Attribution */}
                {sources.length > 0 && (
                  <div className="mt-2">
                    <SourceBadgeGroup sources={sources} size="xs" maxVisible={3} />
                  </div>
                )}

                {/* Details Button - Desktop */}
                {onOpenDetails && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isExpanded ? 1 : 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails();
                    }}
                    className="mt-3 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan text-xs font-medium uppercase tracking-wider transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    View Details
                  </motion.button>
                )}
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
            /* Mobile: Compact layout with inline scores, expand button for graphs */
            <div className="relative">
              {/* Swipe Indicator Background - Visible when swiping */}
              {onOpenDetails && (
                <motion.div
                  className="absolute inset-y-0 left-0 flex items-center justify-center w-20 -ml-4 rounded-l-xl bg-neon-cyan/20"
                  style={{ opacity: swipeOpacity }}
                >
                  <motion.div
                    className="flex flex-col items-center text-neon-cyan"
                    style={{ scale: swipeScale }}
                  >
                    <ChevronRight className="w-6 h-6" />
                    <span className="text-[10px] font-medium uppercase">Details</span>
                  </motion.div>
                </motion.div>
              )}

              {/* Main Mobile Content - Draggable */}
              <motion.div
                className={cn(
                  "space-y-3 touch-pan-y",
                  isTouching && "bg-white/[0.02]",
                  onOpenDetails && "cursor-grab active:cursor-grabbing"
                )}
                drag={onOpenDetails ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0, right: 0.2 }}
                style={{ x: swipeX }}
                animate={swipeControls}
                onDragEnd={handleDragEnd}
                onTouchStart={() => setIsTouching(true)}
                onTouchEnd={() => setIsTouching(false)}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
              >
              {/* Top Row: Name + Diamond + Status */}
              <div className="flex items-center gap-3">
                {/* Diamond Rank with Trend - Left side */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <DiamondRank rank={rank} isExpanded={isExpanded} size="normal" />
                  <TrendIndicator currentRank={rank} previousRank={previousRank} />
                </div>

                {/* Model Info - Center */}
                <div className="flex-1 min-w-0">
                  <h3 className={cn(
                    "text-base font-semibold transition-colors flex items-center gap-1.5 truncate",
                    isExpanded ? "text-neon-coral" : "text-neon-pink"
                  )}>
                    <CompanyLogo company={company} size={18} />
                    <span className="truncate">{name}</span>
                  </h3>
                  <p className="text-xs text-text-secondary truncate">{company}</p>
                </div>

                {/* Score + Status - Right side */}
                <div className="flex-shrink-0 flex items-center gap-1.5">
                  {score !== undefined && (
                    <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-purple-glow/10 border border-purple-glow/30">
                      <span className="text-sm font-mono text-purple-glow">{score}</span>
                    </div>
                  )}
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] font-medium rounded-full border uppercase",
                    statusColors[status]
                  )}>
                    {status}
                  </span>
                </div>
              </div>

              {/* Tags Row */}
              <div className="flex items-center gap-1.5 flex-wrap">
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
              </div>

              {/* Inline Benchmark Scores - Always visible, compact grid */}
              {benchmarks.length > 0 && (
                <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 pt-2 border-t border-purple-glow/10">
                  {benchmarks.map((benchmark) => (
                    <div key={benchmark.name} className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-text-muted truncate">{benchmark.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-white">{benchmark.score}</span>
                        {benchmark.source && <InlineSourceBadge source={benchmark.source} />}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Data Sources Attribution - Mobile */}
              {sources.length > 0 && (
                <div className="flex items-center justify-end pt-1">
                  <SourceBadgeGroup sources={sources} size="xs" maxVisible={2} />
                </div>
              )}

              {/* Action Buttons Row - Mobile */}
              <div className="flex gap-2">
                {/* Details Button - Mobile */}
                {onOpenDetails && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetails();
                    }}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg min-h-[44px] bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/30 text-neon-cyan transition-all relative overflow-hidden"
                  >
                    <Info className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Details</span>
                    {/* Subtle pulse highlight */}
                    <motion.div
                      className="absolute inset-0 bg-neon-cyan/10 rounded-lg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.3, 0] }}
                      transition={{ duration: 2, repeat: 2, delay: 1 }}
                    />
                  </motion.button>
                )}

                {/* Expand Button - Show Graph */}
                {benchmarks.length > 0 && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMobileExpanded(!mobileExpanded);
                    }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all",
                      "min-h-[44px]",
                      mobileExpanded
                        ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                        : "bg-purple-glow/10 text-purple-light border border-purple-glow/20 hover:bg-purple-glow/20"
                    )}
                  >
                    <span className="text-xs font-medium uppercase tracking-wider">
                      {mobileExpanded ? "Hide Graph" : "Show Graph"}
                    </span>
                    <motion.div
                      animate={{ rotate: mobileExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </motion.button>
                )}
              </div>

              {/* Expanded Benchmarks with Progress Bars - Only on button press */}
              <AnimatePresence>
                {showBenchmarks && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="border-t border-purple-glow/20 pt-4 overflow-hidden"
                  >
                    <p className="text-xs font-mono text-purple-light uppercase tracking-wider mb-3 text-center">
                      Benchmark Breakdown
                    </p>
                    <div className="space-y-3">
                      {benchmarks.map((benchmark, index) => (
                        <BenchmarkItem key={benchmark.name} benchmark={benchmark} index={index} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </motion.div>
            </div>
          )}
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-glow/50 to-transparent" />
      </motion.div>
    </motion.div>
  );
}
