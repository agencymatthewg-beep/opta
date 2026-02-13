import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Gamepad2,
  Crown,
  Zap,
  Target,
  Award,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRadialNav } from '@/contexts/RadialNavContext';
import { RadialNavItem } from './RadialNavItem';
import { RadialNavCenter } from './RadialNavCenter';
import { RadialHalo } from './RadialHalo';
import { RadialNavMobile } from './RadialNavMobile';
import { smoothOut } from '@/lib/animations';

/**
 * RadialNav - Center-focused radial navigation menu
 *
 * Positions nav items in a 360-degree circle around the center.
 * Integrates with RadialNavContext for state management.
 * Renders RadialNavMobile on mobile devices (placeholder for now).
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

interface RadialNavProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

// Navigation items (same as Sidebar for consistency)
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'chess', label: 'Chess', icon: Crown },
  { id: 'optimize', label: 'Optimize', icon: Zap },
  { id: 'pinpoint', label: 'Pinpoint', icon: Target },
  { id: 'score', label: 'Score', icon: Award },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Configuration
const RADIAL_CONFIG = {
  radius: 160, // Distance from center to items
  startAngle: -90, // Start from top (12 o'clock position)
  spread: 360, // Full circle
};

/**
 * Calculate radial position for an item
 *
 * @param index - Index of the item in the list
 * @param totalItems - Total number of items
 * @param radius - Distance from center
 * @param startAngle - Starting angle in degrees (-90 = top)
 * @param spread - Total arc spread in degrees (360 = full circle)
 * @returns Position object with x, y coordinates and rotation angle
 */
function calculateRadialPosition(
  index: number,
  totalItems: number,
  radius: number,
  startAngle: number = -90,
  spread: number = 360
): { x: number; y: number; angle: number } {
  const arcPerItem = spread / totalItems;
  const angle = startAngle + index * arcPerItem + arcPerItem / 2;
  const angleRad = (angle * Math.PI) / 180;

  return {
    x: Math.cos(angleRad) * radius,
    y: Math.sin(angleRad) * radius,
    angle: angle + 90, // Rotation angle for label orientation
  };
}

/**
 * Container animation variants
 */
const containerVariants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: smoothOut,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.3,
      ease: smoothOut,
    },
  },
};

/**
 * HaloCenter - Compact center element for the halo state
 *
 * Shows a minimized "O" with breathing animation, styled to match
 * the obsidian glass aesthetic.
 */
function HaloCenter() {
  return (
    <motion.div
      className={cn(
        'w-20 h-20 rounded-full',
        'glass-strong',
        'border border-white/[0.08]',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
        'flex flex-col items-center justify-center'
      )}
      // Subtle breathing animation
      animate={{
        filter: [
          'brightness(1) drop-shadow(0 0 15px rgba(255,255,255,0.08))',
          'brightness(1.1) drop-shadow(0 0 25px rgba(255,255,255,0.15))',
          'brightness(1) drop-shadow(0 0 15px rgba(255,255,255,0.08))',
        ],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <span className="text-2xl font-bold bg-gradient-to-br from-white via-white/95 to-white/70 bg-clip-text text-transparent">
        O
      </span>
      <span className="text-[8px] text-muted-foreground/50 uppercase tracking-[0.2em] mt-0.5">
        pta
      </span>
    </motion.div>
  );
}

export function RadialNav({ activePage, onNavigate }: RadialNavProps) {
  const {
    mode,
    isMobile,
    isHomeView,
    hoveredItemId,
    setHoveredItem,
    navigateTo,
    expand,
  } = useRadialNav();

  // Local hover state for immediate feedback
  const [localHoveredId, setLocalHoveredId] = useState<string | null>(null);

  // Calculate positions for all items
  const itemPositions = useMemo(() => {
    return navItems.map((_, index) =>
      calculateRadialPosition(
        index,
        navItems.length,
        RADIAL_CONFIG.radius,
        RADIAL_CONFIG.startAngle,
        RADIAL_CONFIG.spread
      )
    );
  }, []);

  // Handle hover state updates
  const handleHover = useCallback(
    (itemId: string | null) => {
      setLocalHoveredId(itemId);
      setHoveredItem(itemId);
    },
    [setHoveredItem]
  );

  // Handle navigation
  const handleNavigate = useCallback(
    (pageId: string) => {
      onNavigate(pageId);
      navigateTo(pageId);
    },
    [onNavigate, navigateTo]
  );

  // Handle container hover to expand from halo
  const handleContainerHover = useCallback(() => {
    if (mode === 'halo') {
      expand();
    }
  }, [mode, expand]);

  // Render mobile version with bottom arc layout
  if (isMobile) {
    return <RadialNavMobile activePage={activePage} onNavigate={onNavigate} />;
  }

  // Don't render expanded items in halo mode
  const showItems = mode === 'expanded';

  // Scale factor for home view (fullscreen dial)
  const homeScale = isHomeView ? 1.4 : 1;

  return (
    <motion.div
      className="relative flex items-center justify-center"
      onMouseEnter={handleContainerHover}
      animate={{ scale: homeScale }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <AnimatePresence mode="wait">
        {showItems && (
          <motion.div
            className="relative"
            style={{
              width: RADIAL_CONFIG.radius * 2 + 120, // Account for item size
              height: RADIAL_CONFIG.radius * 2 + 120,
            }}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Center Opta text with semantic color morphing */}
            <RadialNavCenter />

            {/* Navigation Items */}
            {navItems.map((item, index) => (
              <div
                key={item.id}
                className="absolute left-1/2 top-1/2"
                style={{
                  // Items are positioned relative to center via transform in RadialNavItem
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <RadialNavItem
                  item={item}
                  position={itemPositions[index]}
                  isActive={activePage === item.id}
                  isHovered={
                    localHoveredId === item.id || hoveredItemId === item.id
                  }
                  onHover={handleHover}
                  onClick={() => handleNavigate(item.id)}
                  index={index}
                />
              </div>
            ))}
          </motion.div>
        )}

        {/* Halo state - minimized ring with center */}
        {mode === 'halo' && (
          <RadialHalo onExpand={expand}>
            <HaloCenter />
          </RadialHalo>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default RadialNav;
