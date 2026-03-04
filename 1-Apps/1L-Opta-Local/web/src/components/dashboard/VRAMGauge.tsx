'use client';

/**
 * VRAMGauge — Circular SVG gauge showing VRAM usage.
 *
 * Void Engine design — ghost-trailing neon ring with hard threshold
 * color transitions: Violet (0-70%), Amber (70-85%), Red (85-100%).
 *
 * - Triple-layer ring: main stroke + two ghost trails that lag behind
 * - Status label and center text both inherit the threshold color
 * - Header glowline transitions color on state change
 * - Framer Motion spring drives the fill animation
 * - shake animation triggers only in the Critical (red) zone
 */

import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@opta/ui';
import { Cpu } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VRAMGaugeProps {
    /** VRAM currently in use (GB) */
    usedGB: number;
    /** Total available VRAM (GB) */
    totalGB: number;
    /** SVG viewport size in pixels (default 200) */
    size?: number;
}

// ---------------------------------------------------------------------------
// Threshold helpers
// ---------------------------------------------------------------------------

type ThresholdState = 'stable' | 'warning' | 'critical';

interface ThresholdColors {
    stroke: string;
    glow: string;
    glowAlpha: string;
    ghost1: string;
    ghost2: string;
    statusLabel: string;
    statusText: string;
}

function getThresholdState(percentage: number): ThresholdState {
    if (percentage >= 0.85) return 'critical';
    if (percentage >= 0.70) return 'warning';
    return 'stable';
}

function getThresholdColors(state: ThresholdState): ThresholdColors {
    switch (state) {
        case 'critical':
            return {
                stroke: '#ef4444',
                glow: 'drop-shadow(0 0 8px #ef4444)',
                glowAlpha: 'rgba(239,68,68,0.5)',
                ghost1: 'rgba(239,68,68,0.3)',
                ghost2: 'rgba(239,68,68,0.6)',
                statusLabel: '#ef4444',
                statusText: 'CRITICAL',
            };
        case 'warning':
            return {
                stroke: '#f59e0b',
                glow: 'drop-shadow(0 0 8px #f59e0b)',
                glowAlpha: 'rgba(245,158,11,0.5)',
                ghost1: 'rgba(245,158,11,0.25)',
                ghost2: 'rgba(245,158,11,0.5)',
                statusLabel: '#f59e0b',
                statusText: 'WARN',
            };
        default:
            return {
                stroke: '#a855f7',
                glow: 'drop-shadow(0 0 8px #a855f7)',
                glowAlpha: 'rgba(168,85,247,0.5)',
                ghost1: 'rgba(168,85,247,0.2)',
                ghost2: 'rgba(168,85,247,0.4)',
                statusLabel: '#a855f7',
                statusText: 'STABLE',
            };
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VRAMGauge({ usedGB, totalGB, size = 200 }: VRAMGaugeProps) {
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const cx = size / 2;
    const cy = size / 2;

    // Idle state — no model loaded
    if (totalGB === 0) {
        return (
            <Card variant="glass">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base font-mono">
                        <span className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-neon-cyan" />
                            VRAM Usage
                        </span>
                        <span className="text-[11px] text-text-muted tracking-widest">IDLE</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center pb-6">
                    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
                        <motion.svg
                            width={size}
                            height={size}
                            className="-rotate-90"
                            style={{ overflow: 'visible' }}
                        >
                            {/* Track */}
                            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1a1a24" strokeWidth={2} />
                            {/* Idle breathing ring */}
                            <motion.circle
                                cx={cx} cy={cy} r={radius}
                                fill="none"
                                stroke="#a855f7"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeOpacity={0.3}
                                strokeDasharray={circumference}
                                strokeDashoffset={0}
                                animate={{ opacity: [0.2, 0.5, 0.2] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        </motion.svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                            <span className="text-xl font-bold text-text-secondary font-mono">Ready</span>
                            <span className="text-sm text-text-muted font-mono">512 GB</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const percentage = totalGB > 0 ? Math.min(usedGB / totalGB, 1) : 0;
    const offset = circumference * (1 - percentage);
    const state = getThresholdState(percentage);
    const colors = getThresholdColors(state);
    const isCritical = state === 'critical';

    // Ghost offsets — lag slightly behind the main arc
    const ghost2Offset = Math.min(offset + 12, circumference);
    const ghost1Offset = Math.min(offset + 28, circumference);

    const springTransition = { type: 'spring' as const, stiffness: 60, damping: 15 };
    const strokeTransition = { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] };

    return (
        <motion.div
            animate={isCritical ? { x: [-1, 2, -4, 4, -4, 2, -1, 0] } : { x: 0 }}
            transition={isCritical
                ? { duration: 0.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2 }
                : { duration: 0.3 }}
        >
            <Card variant="glass" className="relative overflow-hidden">
                {/* Animated top glowline */}
                <motion.div
                    className="absolute top-0 left-0 right-0 h-[1px]"
                    animate={{ background: `linear-gradient(90deg, transparent, ${colors.glowAlpha}, transparent)` }}
                    transition={strokeTransition}
                />

                <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base font-mono">
                        <span className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-neon-cyan" />
                            VRAM Usage
                        </span>
                        <motion.span
                            className="text-[11px] font-bold tracking-widest"
                            animate={{ color: colors.statusLabel }}
                            transition={strokeTransition}
                        >
                            {colors.statusText}
                        </motion.span>
                    </CardTitle>
                </CardHeader>

                <CardContent className="flex items-center justify-center pb-6">
                    <div
                        className="relative flex items-center justify-center"
                        style={{ width: size, height: size }}
                    >
                        <motion.svg
                            width={size}
                            height={size}
                            className="-rotate-90"
                            style={{ overflow: 'visible' }}
                            aria-label={`VRAM usage: ${usedGB.toFixed(1)} of ${totalGB.toFixed(0)} GB`}
                        >
                            {/* Track */}
                            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#1a1a24" strokeWidth={2} />

                            {/* Ghost trail 1 — outermost, most transparent */}
                            <motion.circle
                                cx={cx} cy={cy} r={radius}
                                fill="none"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{
                                    strokeDashoffset: ghost1Offset,
                                    stroke: colors.ghost1,
                                    opacity: percentage >= 0.70 ? 0.5 : 0.4,
                                }}
                                transition={{ ...springTransition, ...strokeTransition }}
                            />

                            {/* Ghost trail 2 — middle */}
                            <motion.circle
                                cx={cx} cy={cy} r={radius}
                                fill="none"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{
                                    strokeDashoffset: ghost2Offset,
                                    stroke: colors.ghost2,
                                    opacity: percentage >= 0.70 ? 0.7 : 0.5,
                                }}
                                transition={{ ...springTransition, ...strokeTransition }}
                            />

                            {/* Main stroke */}
                            <motion.circle
                                cx={cx} cy={cy} r={radius}
                                fill="none"
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{
                                    strokeDashoffset: offset,
                                    stroke: colors.stroke,
                                    filter: colors.glow,
                                }}
                                transition={{ ...springTransition, ...strokeTransition }}
                            />
                        </motion.svg>

                        {/* Center overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                            {/* Pulse dot */}
                            <motion.div
                                className="absolute rounded-full"
                                style={{ width: 6, height: 6, top: '18%' }}
                                animate={{
                                    backgroundColor: colors.stroke,
                                    boxShadow: `0 0 10px ${colors.stroke}`,
                                    scale: [0.8, 1.2, 0.8],
                                    opacity: [0.3, 1, 0.3],
                                }}
                                transition={{
                                    backgroundColor: strokeTransition,
                                    boxShadow: strokeTransition,
                                    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                                    opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                                }}
                            />

                            {/* Value */}
                            <motion.div
                                className="flex items-baseline font-mono font-bold"
                                style={{ fontSize: size * 0.22 }}
                                animate={{ color: isCritical ? colors.stroke : '#fafafa' }}
                                transition={strokeTransition}
                            >
                                <span>{Math.floor(usedGB)}</span>
                                <span style={{ fontSize: size * 0.12, color: 'rgba(255,255,255,0.5)' }}>
                                    .{(usedGB % 1).toFixed(1).slice(2)}
                                </span>
                            </motion.div>

                            {/* Sub label */}
                            <span
                                className="font-mono text-text-muted"
                                style={{ fontSize: size * 0.058 }}
                            >
                                / {totalGB.toFixed(0)} GB TOT
                            </span>

                            {/* Percentage badge */}
                            <motion.span
                                className="font-mono font-bold uppercase tracking-widest mt-1.5"
                                style={{ fontSize: size * 0.05 }}
                                animate={{ color: colors.stroke }}
                                transition={strokeTransition}
                            >
                                {(percentage * 100).toFixed(0)}%
                            </motion.span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
