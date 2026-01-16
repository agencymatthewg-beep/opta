import { useCallback } from 'react';
import { motion, Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useRadialNav, type SemanticColorKey } from '@/contexts/RadialNavContext';
import { smoothOut } from '@/lib/animations';

/**
 * RadialHalo - The minimized ring state of the radial navigation
 *
 * Appears after a navigation selection, showing a compact ring around the center
 * with indicator dots for each nav item. Users can hover/click to expand back
 * to the full radial menu.
 *
 * Features:
 * - Compact ring (~60px radius) around center content
 * - 6 indicator dots showing nav items (active item highlighted)
 * - Subtle rotating stroke animation
 * - Glows on hover
 * - Keyboard accessible (Enter/Space to expand)
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

interface RadialHaloProps {
  /** Called when user wants to expand back to full radial */
  onExpand: () => void;
  /** The center content (typically RadialNavCenter) */
  children?: React.ReactNode;
}

// Configuration
const HALO_CONFIG = {
  size: 160, // SVG viewBox size
  radius: 60, // Ring radius around center
  dotRadius: 3, // Size of indicator dots
  strokeWidth: 2, // Ring stroke width
};

// Nav items for dot indicators (matches RadialNav)
const NAV_ITEMS: { id: SemanticColorKey }[] = [
  { id: 'dashboard' },
  { id: 'games' },
  { id: 'optimize' },
  { id: 'pinpoint' },
  { id: 'score' },
  { id: 'settings' },
];

/**
 * Calculate radial position for a dot
 */
function calculateDotPosition(
  index: number,
  totalItems: number,
  radius: number,
  startAngle: number = -90
): { x: number; y: number } {
  const arcPerItem = 360 / totalItems;
  const angle = startAngle + index * arcPerItem + arcPerItem / 2;
  const angleRad = (angle * Math.PI) / 180;

  return {
    x: Math.cos(angleRad) * radius,
    y: Math.sin(angleRad) * radius,
  };
}

/**
 * Animation variants for the halo container
 */
const haloVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: smoothOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 1.2,
    transition: {
      duration: 0.3,
      ease: smoothOut,
    },
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.2,
      ease: smoothOut,
    },
  },
};

/**
 * Animation for the rotating glow stroke
 * Circumference = 2 * PI * radius = 2 * PI * 60 ≈ 377
 */
const CIRCUMFERENCE = 2 * Math.PI * HALO_CONFIG.radius;

export function RadialHalo({ onExpand, children }: RadialHaloProps) {
  const { activePageId, getSemanticColor } = useRadialNav();

  const { size, radius, dotRadius, strokeWidth } = HALO_CONFIG;
  const center = size / 2;

  // Handle keyboard activation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onExpand();
      }
    },
    [onExpand]
  );

  return (
    <motion.div
      className={cn(
        'relative flex items-center justify-center',
        'cursor-pointer select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:rounded-full'
      )}
      style={{
        width: size,
        height: size,
      }}
      variants={haloVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      onClick={onExpand}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Expand navigation menu"
    >
      {/* SVG Ring Layer */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute top-0 left-0 pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          {/* Gradient for the animated glow stroke */}
          <linearGradient
            id="haloGradient"
            gradientUnits="userSpaceOnUse"
            x1={center}
            y1={center - radius}
            x2={center}
            y2={center + radius}
          >
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>

          {/* Glow filter for active dots */}
          <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background ring - subtle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />

        {/* Secondary subtle ring for depth */}
        <circle
          cx={center}
          cy={center}
          r={radius - 4}
          fill="none"
          stroke="rgba(255, 255, 255, 0.02)"
          strokeWidth={1}
        />

        {/* Animated glow ring - rotating dash */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="url(#haloGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={`40, ${CIRCUMFERENCE - 40}`}
          strokeLinecap="round"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -CIRCUMFERENCE }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'linear',
          }}
        />

        {/* Nav item indicator dots */}
        {NAV_ITEMS.map((item, i) => {
          const pos = calculateDotPosition(i, NAV_ITEMS.length, radius - 10);
          const isActive = activePageId === item.id;
          const semanticColor = getSemanticColor(item.id);

          return (
            <motion.circle
              key={item.id}
              cx={center + pos.x}
              cy={center + pos.y}
              r={isActive ? dotRadius + 1 : dotRadius}
              fill={isActive ? (semanticColor?.color ?? 'hsl(var(--primary))') : 'rgba(255, 255, 255, 0.2)'}
              filter={isActive ? 'url(#dotGlow)' : undefined}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                delay: 0.1 + i * 0.05,
                duration: 0.3,
                ease: smoothOut,
              }}
            />
          );
        })}
      </svg>

      {/* Center Content (children passed in - typically RadialNavCenter) */}
      {children && (
        <div className="relative z-10 flex items-center justify-center">
          {children}
        </div>
      )}

      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 rounded-full pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{
          opacity: 1,
          boxShadow: '0 0 30px rgba(168, 85, 247, 0.25), inset 0 0 20px rgba(168, 85, 247, 0.1)',
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}

export default RadialHalo;
