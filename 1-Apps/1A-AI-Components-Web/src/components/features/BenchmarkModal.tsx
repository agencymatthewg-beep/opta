"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { createPortal } from "react-dom";
import { CompanyLogo } from "./CompanyLogo";
import type { BenchmarkScore } from "./ModelCard";

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  modelName: string;
  company: string;
  rank: number;
  benchmarks: BenchmarkScore[];
}

export function BenchmarkModal({
  isOpen,
  onClose,
  modelName,
  company,
  rank,
  benchmarks,
}: BenchmarkModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.body.classList.add("modal-open");
    } else {
      document.body.style.overflow = "";
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("modal-open");
    };
  }, [isOpen]);

  // Handle drag end for swipe-to-close
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  // Only render on client side (portal requirement)
  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl"
          >
            {/* Glass Container */}
            <div className="bg-black/80 backdrop-blur-xl border-t border-x border-white/10 rounded-t-3xl">
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-4 px-6 pb-4 border-b border-white/5">
                {/* Logo with Rank */}
                <div className="relative flex-shrink-0">
                  <CompanyLogo company={company} size={48} />
                  <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-purple-deep to-purple-glow border border-white/20 shadow-lg">
                    <span className="text-[10px] font-bold text-white">{rank}</span>
                  </div>
                </div>

                {/* Model Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-white truncate">
                    {modelName}
                  </h3>
                  <p className="text-sm text-text-secondary">{company}</p>
                </div>
              </div>

              {/* Benchmark List */}
              <div className="px-6 py-4 overflow-y-auto modal-scroll max-h-[60vh]">
                <p className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-4">
                  Benchmark Scores
                </p>

                <div className="space-y-4">
                  {benchmarks.map((benchmark, index) => {
                    const percentage = benchmark.maxScore
                      ? (benchmark.score / benchmark.maxScore) * 100
                      : benchmark.score;

                    return (
                      <motion.div
                        key={benchmark.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.3 }}
                        className="flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-text-secondary">
                            {benchmark.name}
                          </span>
                          <span className="text-base font-mono text-white">
                            {benchmark.score}
                            {benchmark.maxScore && (
                              <span className="text-text-muted">/{benchmark.maxScore}</span>
                            )}
                          </span>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(percentage, 100)}%` }}
                            transition={{ delay: index * 0.05 + 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full bg-gradient-to-r from-purple-deep to-purple-glow rounded-full"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Safe area padding for iOS */}
              <div className="h-6 bg-transparent" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
