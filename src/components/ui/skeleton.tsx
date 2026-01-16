/**
 * Skeleton - The Obsidian Loading Placeholder
 *
 * Shimmer loading states with obsidian glass styling.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Skeleton loading component with shimmer animation.
 * Uses Framer Motion for smooth opacity pulsing.
 */
export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "rounded-md",
        // Obsidian shimmer
        "bg-white/[0.04]",
        className
      )}
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

/**
 * Skeleton for a telemetry card (CPU, Memory, GPU, Disk).
 */
export function TelemetryCardSkeleton({
  delay = 0,
  className,
}: {
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "relative rounded-xl overflow-hidden",
        // Obsidian glass material
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]",
        className
      )}
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ delay, ease: smoothOut }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-7 h-7 rounded-lg" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      {/* Content */}
      <div className="p-5 flex flex-col items-center">
        <Skeleton className="w-32 h-32 rounded-full mb-3" />
        <Skeleton className="h-3 w-24" />
      </div>
    </motion.div>
  );
}

/**
 * Skeleton for a process list item.
 */
export function ProcessItemSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="flex items-center justify-between py-3 px-4 border-b border-white/[0.05]"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: smoothOut }}
    >
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </motion.div>
  );
}

/**
 * Skeleton for the full process list.
 */
export function ProcessListSkeleton() {
  return (
    <div className={cn(
      "relative rounded-xl overflow-hidden",
      "bg-[#05030a]/80 backdrop-blur-xl",
      "border border-white/[0.06]"
    )}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>
      {/* Process items */}
      <div>
        {[0, 1, 2, 3, 4].map((i) => (
          <ProcessItemSkeleton key={i} delay={i * 0.05} />
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for a game card.
 */
export function GameCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, y: 0, filter: 'brightness(1)' }}
      transition={{ delay, ease: smoothOut }}
      className={cn(
        "relative rounded-xl overflow-hidden",
        "bg-[#05030a]/80 backdrop-blur-xl",
        "border border-white/[0.06]"
      )}
    >
      <Skeleton className="h-1.5 rounded-t-xl" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    </motion.div>
  );
}

/**
 * Skeleton for the score card.
 */
export function ScoreCardSkeleton() {
  return (
    <motion.div
      className={cn(
        "relative rounded-2xl p-8 overflow-hidden",
        "bg-[#05030a]/90 backdrop-blur-2xl",
        "border border-white/[0.08]"
      )}
      initial={{ opacity: 0, scale: 0.98, filter: 'brightness(0.5)' }}
      animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
      transition={{ ease: smoothOut }}
    >
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>
      <div className="flex items-center justify-center mb-6">
        <Skeleton className="w-48 h-48 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Full page skeleton for initial app load.
 */
export function PageSkeleton() {
  return (
    <div className="page max-w-6xl">
      {/* Header */}
      <Skeleton className="h-8 w-48 mb-6" />
      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TelemetryCardSkeleton delay={0.05} />
        <TelemetryCardSkeleton delay={0.1} />
        <TelemetryCardSkeleton delay={0.15} />
        <TelemetryCardSkeleton delay={0.2} />
      </div>
    </div>
  );
}

export default Skeleton;
