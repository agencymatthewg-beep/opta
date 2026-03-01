"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const lines = [
  "opta start",
  "> Loading Kimi K2.5 3bit (836.9 GB)...",
  "> Memory: 412.6 GB / 512 GB",
  "> Server ready → http://localhost:1234",
  "> 22.2 tok/s | 180ms TTFT",
  "✓ Inference engine online",
];

export function CliPreview() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState("");
  const [lineIndex, setLineIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (!isInView || lineIndex >= lines.length) return;

    const currentFullLine = lines[lineIndex];
    if (charIndex < currentFullLine.length) {
      const timer = setTimeout(() => {
        setCurrentLine(prev => prev + currentFullLine[charIndex]);
        setCharIndex(charIndex + 1);
      }, 30);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setVisibleLines(prev => [...prev, currentLine]);
        setCurrentLine("");
        setCharIndex(0);
        setLineIndex(lineIndex + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isInView, lineIndex, charIndex, currentLine]);

  useEffect(() => {
    const cursorInterval = setInterval(() => setShowCursor(v => !v), 530);
    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-moonlight">
            Terminal-first. Always.
          </h2>
        </motion.div>

        <motion.div
          className="obsidian rounded-2xl p-8 font-mono text-sm md:text-base"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="space-y-2">
            {visibleLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith(">")
                    ? "text-neon-cyan"
                    : line.startsWith("✓")
                    ? "text-neon-green"
                    : "text-neon-blue"
                }
              >
                {line}
              </div>
            ))}
            {lineIndex < lines.length && (
              <div
                className={
                  currentLine.startsWith(">")
                    ? "text-neon-cyan"
                    : currentLine.startsWith("✓")
                    ? "text-neon-green"
                    : "text-neon-blue"
                }
              >
                {currentLine}
                {showCursor && <span className="ml-1 bg-primary w-2 h-4 inline-block animate-terminal-blink" />}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
