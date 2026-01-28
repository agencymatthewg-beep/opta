"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";

interface LoadingSequenceProps {
  onComplete?: () => void;
}

export function LoadingSequence({ onComplete }: LoadingSequenceProps) {
  const [phase, setPhase] = useState<"ring" | "bloom" | "reveal" | "complete">("ring");
  const ringRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeline = gsap.timeline({
      defaults: { ease: "power4.out" },
    });

    // Phase 1: Ring emerges (0-1.5s)
    timeline.to({}, { duration: 1.5, onComplete: () => setPhase("bloom") });

    // Phase 2: Data bloom (1.5-2.5s)
    timeline.to({}, { duration: 1, onComplete: () => setPhase("reveal") });

    // Phase 3: Reveal (2.5-3.5s)
    timeline.to({}, {
      duration: 1,
      onComplete: () => {
        setPhase("complete");
        onComplete?.();
      },
    });

    return () => {
      timeline.kill();
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "complete" && (
        <motion.div
          ref={containerRef}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-void"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Atmospheric background gradient */}
          <div className="absolute inset-0 bg-gradient-radial from-purple-deep/10 via-transparent to-transparent opacity-50" />

          {/* Glass Torus Ring */}
          <motion.div
            ref={ringRef}
            className="relative"
            initial={{ scale: 0, rotateX: 90 }}
            animate={{
              scale: phase === "ring" ? [0, 1.2, 1] : phase === "bloom" ? 1.1 : 1.5,
              rotateX: phase === "ring" ? [90, 0] : 0,
              opacity: phase === "reveal" ? 0 : 1,
            }}
            transition={{
              duration: phase === "ring" ? 1.5 : 1,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {/* Outer ring glow */}
            <div className="absolute -inset-8 rounded-full bg-purple-deep/20 blur-3xl" />

            {/* Glass torus ring - CSS 3D */}
            <div
              className="relative w-48 h-48 rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(138, 43, 226, 0.3), rgba(191, 64, 191, 0.1))",
                boxShadow: `
                  inset 0 0 60px rgba(138, 43, 226, 0.3),
                  0 0 80px rgba(138, 43, 226, 0.4),
                  0 0 120px rgba(191, 64, 191, 0.2)
                `,
                border: "1px solid rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Inner void */}
              <div
                className="absolute inset-8 rounded-full bg-void"
                style={{
                  boxShadow: "inset 0 0 40px rgba(138, 43, 226, 0.2)",
                }}
              />

              {/* Refractive highlight */}
              <div
                className="absolute top-4 left-1/4 right-1/4 h-px"
                style={{
                  background: "linear-gradient(to right, transparent, rgba(255, 255, 255, 0.4), transparent)",
                }}
              />

              {/* Rotating particles */}
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-purple-glow"
                    style={{
                      top: "50%",
                      left: "50%",
                      transform: `rotate(${i * 45}deg) translateX(80px) translateY(-50%)`,
                      boxShadow: "0 0 10px rgba(191, 64, 191, 0.8)",
                    }}
                    animate={{
                      opacity: phase === "bloom" ? [0.3, 1, 0.3] : 0.5,
                      scale: phase === "bloom" ? [1, 1.5, 1] : 1,
                    }}
                    transition={{
                      duration: 1,
                      repeat: phase === "bloom" ? Infinity : 0,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>

          {/* Data bloom particles */}
          <AnimatePresence>
            {phase === "bloom" && (
              <>
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-purple-glow"
                    initial={{
                      x: 0,
                      y: 0,
                      opacity: 0,
                      scale: 0,
                    }}
                    animate={{
                      x: (Math.random() - 0.5) * 400,
                      y: (Math.random() - 0.5) * 400,
                      opacity: [0, 1, 0],
                      scale: [0, 1.5, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{
                      boxShadow: "0 0 8px rgba(191, 64, 191, 0.8)",
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Brand text reveal */}
          <motion.div
            className="absolute bottom-1/3 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0, y: 20 }}
            animate={{
              opacity: phase === "bloom" || phase === "reveal" ? 1 : 0,
              y: phase === "bloom" || phase === "reveal" ? 0 : 20,
            }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-sm font-mono text-text-muted tracking-widest uppercase">
              AI Intelligence Hub
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
