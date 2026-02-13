"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import gsap from "gsap";

export function AtmosphericCursor() {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Smooth spring physics for cursor movement
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);

      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Detect hoverable elements for magnetic effect
    const handleElementHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === "BUTTON" ||
        target.tagName === "A" ||
        target.closest("button") ||
        target.closest("a") ||
        target.classList.contains("cursor-magnetic");

      setIsHovering(!!isInteractive);

      // Magnetic attraction to interactive elements
      if (isInteractive) {
        const rect = (target.closest("button") || target.closest("a") || target).getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        gsap.to(cursorRef.current, {
          x: centerX - 12,
          y: centerY - 12,
          duration: 0.3,
          ease: "power2.out",
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("mouseenter", handleMouseEnter);
    document.addEventListener("mouseover", handleElementHover);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("mouseenter", handleMouseEnter);
      document.removeEventListener("mouseover", handleElementHover);
    };
  }, [cursorX, cursorY, isVisible]);

  // Hide on touch devices
  if (typeof window !== "undefined" && "ontouchstart" in window) {
    return null;
  }

  return (
    <>
      {/* Main cursor dot */}
      <motion.div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[10001] mix-blend-difference"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
        }}
        animate={{
          opacity: isVisible ? 1 : 0,
          scale: isHovering ? 2 : 1,
        }}
        transition={{ duration: 0.15 }}
      >
        <div
          className="w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(138, 43, 226, 0.8), rgba(191, 64, 191, 0.4))",
            boxShadow: "0 0 20px rgba(138, 43, 226, 0.6), 0 0 40px rgba(191, 64, 191, 0.3)",
          }}
        />
      </motion.div>

      {/* Trailing glow */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[10000]"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
        }}
        animate={{
          opacity: isVisible ? 0.5 : 0,
          scale: isHovering ? 3 : 1.5,
        }}
        transition={{ duration: 0.3 }}
      >
        <div
          className="w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl"
          style={{
            background: "radial-gradient(circle, rgba(138, 43, 226, 0.4), transparent)",
          }}
        />
      </motion.div>
    </>
  );
}
