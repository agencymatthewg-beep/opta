"use client";

import { motion, HTMLMotionProps } from "framer-motion";

interface GlassPanelProps extends HTMLMotionProps<"div"> {
  heavy?: boolean;
  glow?: boolean;
}

export function GlassPanel({ heavy, glow, className = "", children, ...props }: GlassPanelProps) {
  return (
    <motion.div
      className={`${heavy ? "glass-heavy" : "glass"} ${glow ? "glow-primary" : ""} rounded-2xl ${className}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
