"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { OptaRing } from "./OptaRing";

export function CinematicIntro({ children }: { children: React.ReactNode }) {
    const [showIntro, setShowIntro] = useState(true);

    useEffect(() => {
        // Simulate initial system boot/check
        const timer = setTimeout(() => {
            setShowIntro(false);
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence mode="wait">
            {showIntro ? (
                <motion.div
                    key="intro-overlay"
                    className="fixed inset-0 z-[100] grid place-items-center bg-transparent pointer-events-none"
                    exit={{ transition: { duration: 1.5 } }} // Keep alive for shutters
                >
                    {/* Top Shutter */}
                    <motion.div
                        className="fixed top-0 left-0 w-full h-[50vh] bg-void z-20"
                        initial={{ y: 0 }}
                        exit={{ y: "-100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.2 } }}
                    />

                    {/* Bottom Shutter */}
                    <motion.div
                        className="fixed bottom-0 left-0 w-full h-[50vh] bg-void z-20"
                        initial={{ y: 0 }}
                        exit={{ y: "100%", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.2 } }}
                    />

                    {/* Content Container - Fades out before shutters open */}
                    <motion.div
                        className="relative z-30 flex flex-col items-center gap-8"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.5 } }}
                    >
                        {/* Background Grid (Tech Vibe) */}
                        <div className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none z-0"
                            style={{
                                backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                                backgroundSize: '40px 40px',
                                maskImage: 'radial-gradient(circle at center, black 40%, transparent 80%)'
                            }}
                        />

                        <div className="w-24 h-24 relative z-10">
                            <OptaRing />
                        </div>

                        <div className="flex flex-col items-center gap-2 z-10">
                            <motion.h1
                                className="text-2xl font-bold tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple"
                                initial={{ clipPath: "polygon(0 0, 0 100%, 0 100%, 0 0)" }}
                                animate={{ clipPath: "polygon(0 0, 0 100%, 100% 100%, 100% 0)" }}
                                transition={{ delay: 0.5, duration: 0.8, ease: "circOut" }}
                            >
                                Opta System
                            </motion.h1>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
                                className="h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent"
                            />
                            <motion.p
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.5 }}
                                className="text-[10px] text-text-muted tracking-widest uppercase"
                            >
                                Initializing Core Modules...
                            </motion.p>
                        </div>
                    </motion.div>
                </motion.div>
            ) : (
                <motion.div
                    key="content"
                    className="w-full h-full"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
