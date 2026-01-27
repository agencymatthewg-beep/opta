"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export const Atmosphere = () => {
    const [mounted, setMounted] = useState(false);

    // Mouse position state
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring animation for parallax
    const springConfig = { damping: 50, stiffness: 400 };
    const smoothX = useSpring(mouseX, springConfig);
    const smoothY = useSpring(mouseY, springConfig);

    // Parallax transform - moves opposite to mouse
    const x1 = useTransform(smoothX, [0, 1], [50, -50]);
    const y1 = useTransform(smoothY, [0, 1], [50, -50]);

    const x2 = useTransform(smoothX, [0, 1], [-30, 30]);
    const y2 = useTransform(smoothY, [0, 1], [-30, 30]);

    useEffect(() => {
        setMounted(true);

        const handleMouseMove = (e: MouseEvent) => {
            // Normalize mouse position 0 to 1
            mouseX.set(e.clientX / window.innerWidth);
            mouseY.set(e.clientY / window.innerHeight);
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [mouseX, mouseY]);

    if (!mounted) return null;

    return (
        <div className="atmosphere fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Noise Grain Overlay */}
            <div className="absolute inset-0 z-10 opacity-[0.03] pointer-events-none mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* Deep Space Gradient Background */}
            <div className="absolute inset-0 bg-void" />

            {/* Parallax Fog Layer 1 (Primary) */}
            <motion.div
                className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] opacity-40 bg-primary/20"
                style={{ x: x1, y: y1 }}
            />

            {/* Parallax Fog Layer 2 (Secondary) */}
            <motion.div
                className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[140px] opacity-30 bg-neon-blue/10"
                style={{ x: x2, y: y2 }}
            />

            {/* Floating Particles (Stardust) */}
            <motion.div
                className="absolute inset-[-50%] w-[200%] h-[200%] opacity-20"
                style={{
                    x: x1, y: y1,
                    backgroundImage: 'radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 40px 70px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 50px 160px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 80px 120px, #ffffff, rgba(0,0,0,0))',
                    backgroundSize: '200px 200px'
                }}
            />

            {/* Ambient Pulsing Glow (Center) */}
            <motion.div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] rounded-full blur-[150px] opacity-10 bg-primary-glow"
                animate={{
                    opacity: [0.05, 0.1, 0.05],
                    scale: [1, 1.1, 1]
                }}
                transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
        </div>
    );
};
