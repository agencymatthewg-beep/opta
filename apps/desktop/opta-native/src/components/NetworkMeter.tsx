/**
 * NetworkMeter - The Data Packet Flow Visualization
 *
 * Network visualization featuring two-way data flow with particles
 * representing upload and download traffic. Packet size varies with
 * throughput and includes speed indicators.
 *
 * Phase 36-05: Telemetry Visualization Upgrade
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
// Note: useRef is used for particleIdRef to track particle IDs
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Wifi, WifiOff } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation';

// Particle configuration
const MAX_PARTICLES = 12;
const PARTICLE_BASE_SIZE = 4;
const PARTICLE_MAX_SIZE = 10;

interface Particle {
  id: number;
  direction: 'up' | 'down';
  x: number;
  size: number;
  speed: number;
  opacity: number;
}

interface NetworkMeterProps {
  /** Whether network connection is available */
  connected?: boolean;
  /** Download speed in Mbps */
  downloadMbps: number;
  /** Upload speed in Mbps */
  uploadMbps: number;
  /** Network interface name (optional) */
  interfaceName?: string;
}

/**
 * Packet Flow Network Meter
 * Features:
 * - Two-way data flow visualization
 * - Upload particles flow upward (orange)
 * - Download particles flow downward (blue)
 * - Packet size varies with throughput
 * - Speed indicator with Mbps display
 */
const NetworkMeter = memo(function NetworkMeter({
  connected = true,
  downloadMbps,
  uploadMbps,
  interfaceName,
}: NetworkMeterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const particleIdRef = useRef(0);

  // Colors for upload and download
  const colors = useMemo(
    () => ({
      upload: {
        primary: '#F97316', // Orange
        glow: 'rgba(249, 115, 22, 0.5)',
        particle: 'rgba(249, 115, 22, 0.8)',
      },
      download: {
        primary: '#3B82F6', // Blue
        glow: 'rgba(59, 130, 246, 0.5)',
        particle: 'rgba(59, 130, 246, 0.8)',
      },
    }),
    []
  );

  // Format speed for display
  const formatSpeed = useCallback((mbps: number): string => {
    if (mbps >= 1000) {
      return `${(mbps / 1000).toFixed(1)} Gbps`;
    }
    if (mbps >= 100) {
      return `${mbps.toFixed(0)} Mbps`;
    }
    if (mbps >= 1) {
      return `${mbps.toFixed(1)} Mbps`;
    }
    return `${(mbps * 1000).toFixed(0)} Kbps`;
  }, []);

  // Calculate particle spawn rate based on throughput
  const getSpawnRate = useCallback((mbps: number): number => {
    if (mbps <= 0) return 0;
    if (mbps < 1) return 500; // Slow: spawn every 500ms
    if (mbps < 10) return 300;
    if (mbps < 100) return 150;
    return 80; // Fast: spawn every 80ms
  }, []);

  // Calculate particle size based on throughput
  const getParticleSize = useCallback((mbps: number): number => {
    const normalized = Math.min(mbps / 100, 1); // Normalize to 0-1 (100 Mbps = max)
    return PARTICLE_BASE_SIZE + normalized * (PARTICLE_MAX_SIZE - PARTICLE_BASE_SIZE);
  }, []);

  // Spawn particles based on network activity
  useEffect(() => {
    if (prefersReducedMotion || !connected) {
      setParticles([]);
      return;
    }

    const spawnParticle = (direction: 'up' | 'down', mbps: number) => {
      if (mbps <= 0) return;
      if (particles.filter((p) => p.direction === direction).length >= MAX_PARTICLES / 2) return;

      const newParticle: Particle = {
        id: particleIdRef.current++,
        direction,
        x: 20 + Math.random() * 60, // Random horizontal position (20-80%)
        size: getParticleSize(mbps),
        speed: 1 + Math.random() * 0.5, // Speed variation
        opacity: 0.6 + Math.random() * 0.4,
      };

      setParticles((prev) => [...prev.slice(-MAX_PARTICLES + 1), newParticle]);
    };

    // Spawn intervals for upload and download
    const uploadInterval = getSpawnRate(uploadMbps);
    const downloadInterval = getSpawnRate(downloadMbps);

    let uploadTimer: ReturnType<typeof setInterval> | null = null;
    let downloadTimer: ReturnType<typeof setInterval> | null = null;

    if (uploadMbps > 0 && uploadInterval > 0) {
      uploadTimer = setInterval(() => spawnParticle('up', uploadMbps), uploadInterval);
    }

    if (downloadMbps > 0 && downloadInterval > 0) {
      downloadTimer = setInterval(() => spawnParticle('down', downloadMbps), downloadInterval);
    }

    return () => {
      if (uploadTimer) clearInterval(uploadTimer);
      if (downloadTimer) clearInterval(downloadTimer);
    };
  }, [uploadMbps, downloadMbps, prefersReducedMotion, connected, getSpawnRate, getParticleSize, particles]);

  // Cleanup old particles
  useEffect(() => {
    const cleanup = setInterval(() => {
      setParticles((prev) => prev.slice(-MAX_PARTICLES));
    }, 2000);

    return () => clearInterval(cleanup);
  }, []);

  // Total throughput for activity indicator
  const totalThroughput = downloadMbps + uploadMbps;
  const isActive = totalThroughput > 0.1;

  // Disconnected state
  if (!connected) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-3 py-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : springs.smooth}
        role="status"
        aria-label="Network disconnected"
      >
        <div
          className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center',
            'glass-subtle',
            'border-2 border-dashed border-white/[0.08]'
          )}
        >
          <WifiOff className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <span className="text-xs text-muted-foreground/60">No network connection</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="flex flex-col gap-4 w-full"
      role="region"
      aria-label={`Network: Download ${formatSpeed(downloadMbps)}, Upload ${formatSpeed(uploadMbps)}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.smooth}
    >
      {/* Header with network icon */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1, ...springs.gentle }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className={cn(
              'p-1.5 rounded-lg',
              'bg-primary/10',
              isActive && 'bg-primary/20'
            )}
            animate={
              isActive && !prefersReducedMotion
                ? { scale: [1, 1.05, 1] }
                : { scale: 1 }
            }
            transition={
              isActive && !prefersReducedMotion
                ? { duration: 1.5, repeat: Infinity }
                : { duration: 0 }
            }
          >
            <Wifi
              className={cn(
                'w-4 h-4 text-primary',
                isActive && 'drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]'
              )}
              strokeWidth={1.75}
            />
          </motion.div>
          <span className="text-sm font-medium text-foreground/80">Network</span>
        </div>
        {interfaceName && (
          <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
            {interfaceName}
          </span>
        )}
      </motion.div>

      {/* Packet Flow Visualization */}
      <div
        className={cn(
          'relative h-32 w-full rounded-xl overflow-hidden',
          'glass-subtle',
          'border border-white/[0.06]'
        )}
      >
        {/* Central divider line */}
        <div className="absolute inset-y-4 left-1/2 w-px bg-white/[0.06]" />

        {/* Flow channel backgrounds */}
        <div className="absolute inset-0 flex">
          {/* Upload channel (left) */}
          <div
            className="w-1/2 h-full"
            style={{
              background: `linear-gradient(180deg, ${colors.upload.glow}20 0%, transparent 100%)`,
            }}
          />
          {/* Download channel (right) */}
          <div
            className="w-1/2 h-full"
            style={{
              background: `linear-gradient(0deg, ${colors.download.glow}20 0%, transparent 100%)`,
            }}
          />
        </div>

        {/* Flow direction indicators */}
        <div className="absolute inset-x-0 top-2 flex justify-around pointer-events-none">
          <motion.div
            animate={
              uploadMbps > 0 && !prefersReducedMotion
                ? { y: [-2, 2, -2], opacity: [0.5, 1, 0.5] }
                : { y: 0, opacity: 0.3 }
            }
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ArrowUp className="w-4 h-4" style={{ color: colors.upload.primary }} strokeWidth={2} />
          </motion.div>
          <motion.div
            animate={
              downloadMbps > 0 && !prefersReducedMotion
                ? { y: [2, -2, 2], opacity: [0.5, 1, 0.5] }
                : { y: 0, opacity: 0.3 }
            }
            transition={{ duration: 1, repeat: Infinity }}
          >
            <ArrowDown className="w-4 h-4" style={{ color: colors.download.primary }} strokeWidth={2} />
          </motion.div>
        </div>

        {/* Particles */}
        <AnimatePresence mode="popLayout">
          {particles.map((particle) => {
            const isUpload = particle.direction === 'up';
            const startY = isUpload ? 100 : 0;
            const endY = isUpload ? -20 : 120;
            const particleColor = isUpload ? colors.upload : colors.download;

            return (
              <motion.div
                key={particle.id}
                className="absolute rounded-full"
                style={{
                  left: `${(particle.x / 100) * 50 + (isUpload ? 0 : 50)}%`,
                  width: particle.size,
                  height: particle.size,
                  background: `radial-gradient(circle at 30% 30%, white 0%, ${particleColor.particle} 100%)`,
                  boxShadow: `0 0 ${particle.size}px ${particleColor.glow}`,
                }}
                initial={{ top: `${startY}%`, opacity: 0, scale: 0.5 }}
                animate={{
                  top: `${endY}%`,
                  opacity: [0, particle.opacity, particle.opacity, 0],
                  scale: [0.5, 1, 1, 0.5],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 2 / particle.speed,
                  ease: 'linear',
                }}
              />
            );
          })}
        </AnimatePresence>

        {/* Speed labels */}
        <div className="absolute inset-x-0 bottom-2 flex justify-around pointer-events-none">
          <span
            className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full backdrop-blur-sm"
            style={{
              color: colors.upload.primary,
              backgroundColor: `${colors.upload.primary}15`,
            }}
          >
            {formatSpeed(uploadMbps)}
          </span>
          <span
            className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full backdrop-blur-sm"
            style={{
              color: colors.download.primary,
              backgroundColor: `${colors.download.primary}15`,
            }}
          >
            {formatSpeed(downloadMbps)}
          </span>
        </div>

        {/* Glass reflection */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%)',
          }}
        />
      </div>

      {/* Stats row */}
      <motion.div
        className="flex items-center justify-between text-xs"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3, ...springs.gentle }}
      >
        {/* Upload stat */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: colors.upload.primary,
              boxShadow: uploadMbps > 0 ? `0 0 6px ${colors.upload.glow}` : 'none',
            }}
          />
          <ArrowUp className="w-3 h-3" style={{ color: colors.upload.primary }} strokeWidth={2} />
          <span className="text-muted-foreground/70">
            <span className="font-medium text-foreground/80">{formatSpeed(uploadMbps)}</span>
          </span>
        </div>

        {/* Download stat */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: colors.download.primary,
              boxShadow: downloadMbps > 0 ? `0 0 6px ${colors.download.glow}` : 'none',
            }}
          />
          <ArrowDown className="w-3 h-3" style={{ color: colors.download.primary }} strokeWidth={2} />
          <span className="text-muted-foreground/70">
            <span className="font-medium text-foreground/80">{formatSpeed(downloadMbps)}</span>
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
});

export default NetworkMeter;
