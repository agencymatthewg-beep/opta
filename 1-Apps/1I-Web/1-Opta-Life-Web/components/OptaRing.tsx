"use client";

import { motion } from "framer-motion";

export function OptaRing() {
    return (
        <div className="relative w-72 h-72 flex items-center justify-center" style={{ perspective: "1000px" }}>

            {/* BACKGROUND ILLUMINATION (Seamless Glow) */}
            <motion.div
                className="absolute inset-[-40%] rounded-full opacity-50 mix-blend-screen"
                style={{
                    background: "radial-gradient(circle at center, rgba(168,85,247,0.3) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)",
                    filter: "blur(60px)",
                    transform: "translateZ(-100px)",
                }}
                animate={{ opacity: [0.4, 0.6, 0.4], scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* 3D Floating Container */}
            <motion.div
                className="relative w-full h-full"
                style={{ transformStyle: "preserve-3d" }}
                animate={{
                    rotateX: [20, 25, 20],
                    rotateY: [-10, -5, -10],
                    y: [-10, 0, -10] // Floating bobbing motion
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            >

                {/* 1. Base Obsidian Body (The Dark Backing) */}
                <div
                    className="absolute inset-0 rounded-full border-[52px] border-[#030304]"
                    style={{
                        transform: "translateZ(-2px)",
                        boxShadow: `
              0 30px 60px -10px rgba(0,0,0,0.95),      
              inset 0 10px 20px rgba(0,0,0,1)
            `
                    }}
                />

                {/* 2. THE EQUATOR GLOW (Centered Filament) */}
                {/* Softened and made more continuous/liquid */}
                <motion.div
                    className="absolute inset-[26px] rounded-full border-[6px] border-transparent"
                    style={{
                        background: `
                    conic-gradient(
                        from 0deg, 
                        transparent 0deg, 
                        rgba(139,92,246,0) 60deg,
                        rgba(168,85,247,0.6) 120deg, 
                        rgba(192,132,252,0.8) 150deg, 
                        rgba(168,85,247,0.6) 180deg, 
                        transparent 240deg
                    ) border-box
                `,
                        mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                        maskComposite: "exclude",
                        WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "destination-out",
                        filter: "blur(5px)",
                        opacity: 0.8,
                        mixBlendMode: "screen"
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                {/* Secondary Subtler Plasma Flow */}
                <motion.div
                    className="absolute inset-[26px] rounded-full border-[6px] border-transparent opacity-40 mix-blend-overlay"
                    style={{
                        background: "conic-gradient(from 180deg, transparent, #a855f7, transparent) border-box",
                        mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                        maskComposite: "exclude",
                        WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "destination-out",
                        filter: "blur(8px)"
                    }}
                    animate={{ rotate: -360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                />

                {/* 3. The Glass Shell (Outer Reflection) */}
                <div
                    className="absolute inset-0 rounded-full border-[52px] border-transparent"
                    style={{
                        background: "linear-gradient(145deg, rgba(255,255,255,0.03) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.01) 100%) border-box",
                        mask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                        maskComposite: "exclude",
                        WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "destination-out",
                        // Subtler, more glossy internal reflection
                        boxShadow: "inset 0 0 20px rgba(255,255,255,0.02), inset 0 0 10px rgba(0,0,0,0.8)"
                    }}
                />

                {/* 4. PREMIUM SPECULAR HIGHLIGHTS (Softened) */}
                {/* Removed the sharp white line. Used gradient opacity for a "liquid light" look */}

                {/* Top-Left Gloss (Liquid Glass) */}
                <div
                    className="absolute top-[15px] left-[35px] w-28 h-[8px] rounded-full blur-[2px]"
                    style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
                        transform: "rotate(-35deg)",
                        opacity: 0.7
                    }}
                />

                {/* Bottom-Right Ambience (Purple subsurface) */}
                <div
                    className="absolute bottom-[25px] right-[40px] w-32 h-[10px] rounded-full blur-[10px]"
                    style={{
                        background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.6), transparent)",
                        transform: "rotate(-35deg)",
                        opacity: 0.5
                    }}
                />

                {/* 5. Rim Definition (Subtle Edge Catch) */}
                <div className="absolute inset-[51px] rounded-full border border-white/5 opacity-20 mix-blend-overlay" />
                <div className="absolute inset-0 rounded-full border border-white/5 opacity-10 mix-blend-overlay" />

            </motion.div>
        </div>
    );
}
