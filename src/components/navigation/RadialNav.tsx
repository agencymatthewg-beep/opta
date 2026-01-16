import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Gamepad2,
  Zap,
  Target,
  Award,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRadialNav } from '@/contexts/RadialNavContext';
import { RadialNavItem } from './RadialNavItem';
import { RadialNavCenter } from './RadialNavCenter';
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

export function RadialNav({ activePage, onNavigate }: RadialNavProps) {
  const {
    mode,
    isMobile,
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

  // Render mobile version (placeholder for now)
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-20 glass-strong border-t border-border/30 flex items-center justify-center">
        <span className="text-muted-foreground text-sm">
          RadialNavMobile (Coming Soon)
        </span>
      </div>
    );
  }

  // Don't render expanded items in halo mode
  const showItems = mode === 'expanded';

  return (
    <div
      className="relative flex items-center justify-center"
      onMouseEnter={handleContainerHover}
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

        {/* Halo state placeholder (Phase 3) */}
        {mode === 'halo' && (
          <motion.div
            className={cn(
              'w-16 h-16 rounded-full',
              'bg-[#05030a]/90 backdrop-blur-2xl',
              'border border-white/[0.08]',
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
              'flex items-center justify-center',
              'cursor-pointer'
            )}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ duration: 0.4, ease: smoothOut }}
            whileHover={{
              scale: 1.05,
              borderColor: 'rgba(168, 85, 247, 0.3)',
              boxShadow:
                'inset 0 0 15px rgba(168, 85, 247, 0.1), 0 0 20px rgba(168, 85, 247, 0.25)',
            }}
            onClick={expand}
          >
            <span className="text-sm font-bold bg-gradient-to-br from-white via-white/95 to-white/70 bg-clip-text text-transparent">
              O
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default RadialNav;
