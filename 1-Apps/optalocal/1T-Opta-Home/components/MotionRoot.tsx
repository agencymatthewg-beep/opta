"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

interface MotionRootProps {
  children: ReactNode;
}

export function MotionRoot({ children }: MotionRootProps) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
