import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Gamepad2,
  Crown,
  Zap,
  Target,
  Award,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRadialNav, SEMANTIC_COLORS, SemanticColorKey } from '@/contexts/RadialNavContext';
import { smoothOut } from '@/lib/animations';

/**
 * RadialNavMobile - Mobile bottom arc navigation
 *
 * iOS dock-style navigation with items arranged in a 180-degree arc
 * at the bottom of the screen. Includes safe area padding for notched devices.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

interface RadialNavMobileProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

// Navigation items (same as RadialNav for consistency)
interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dash', icon: LayoutDashboard },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'chess', label: 'Chess', icon: Crown },
  { id: 'optimize', label: 'Opt', icon: Zap },
  { id: 'pinpoint', label: 'Pin', icon: Target },
  { id: 'score', label: 'Score', icon: Award },
  { id: 'settings', label: 'Set', icon: Settings },
];

// Mobile arc configuration
const MOBILE_CONFIG = {
  radius: 90, // Distance from arc center to items
  startAngle: 180, // Start from left (9 o'clock)
  spread: 180, // Half circle (bottom arc)
  verticalOffset: 10, // Push items up slightly
};

/**
 * Calculate position for a mobile arc item
 *
 * @param index - Index of the item
 * @param totalItems - Total number of items
 * @param radius - Distance from center
 * @param startAngle - Starting angle in degrees
 * @param spread - Total arc spread in degrees
 * @returns Position object with x, y coordinates
 */
function calculateMobileArcPosition(
  index: number,
  totalItems: number,
  radius: number,
  startAngle: number,
  spread: number
): { x: number; y: number } {
  // Distribute items evenly across the arc
  const arcPerItem = spread / (totalItems - 1);
  const angle = startAngle + index * arcPerItem;
  const angleRad = (angle * Math.PI) / 180;

  return {
    x: Math.cos(angleRad) * radius,
    y: Math.sin(angleRad) * radius - MOBILE_CONFIG.verticalOffset,
  };
}

/**
 * Container animation variants for mobile nav
 */
const containerVariants = {
  hidden: {
    y: 100,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: smoothOut,
      staggerChildren: 0.04,
    },
  },
};

/**
 * Item animation variants
 * Note: Parent container handles stagger timing via staggerChildren,
 * so no delay needed here to avoid double-stagger stuttering
 */
const itemVariants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: smoothOut,
    },
  },
};

export function RadialNavMobile({ activePage, onNavigate }: RadialNavMobileProps) {
  const {
    hoveredItemId,
    setHoveredItem,
    navigateTo,
    getSemanticColor,
  } = useRadialNav();

  // Calculate positions for all items
  const itemPositions = useMemo(() => {
    return navItems.map((_, index) =>
      calculateMobileArcPosition(
        index,
        navItems.length,
        MOBILE_CONFIG.radius,
        MOBILE_CONFIG.startAngle,
        MOBILE_CONFIG.spread
      )
    );
  }, []);

  // Handle navigation
  const handleNavigate = useCallback(
    (pageId: string) => {
      onNavigate(pageId);
      navigateTo(pageId);
    },
    [onNavigate, navigateTo]
  );

  // Get the label to display in center
  const centerLabel = useMemo(() => {
    if (hoveredItemId) {
      const hoveredItem = navItems.find(item => item.id === hoveredItemId);
      return hoveredItem?.label || 'Opta';
    }
    return 'Opta';
  }, [hoveredItemId]);

  // Get the semantic color for center text
  const centerColor = useMemo(() => {
    if (hoveredItemId && hoveredItemId in SEMANTIC_COLORS) {
      return SEMANTIC_COLORS[hoveredItemId as SemanticColorKey];
    }
    return null;
  }, [hoveredItemId]);

  return (
    <motion.nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'pb-safe', // Safe area padding for notched devices
      )}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Obsidian backdrop gradient */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 h-36',
          'bg-gradient-to-t from-[#05030a] via-[#05030a]/95 to-transparent',
          'backdrop-blur-xl'
        )}
        style={{
          WebkitBackdropFilter: 'blur(20px)',
        }}
      />

      {/* Center text - shows hovered item label or "Opta" */}
      <div className="relative flex justify-center mb-3 pt-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={centerLabel}
            className={cn(
              'text-lg font-bold radial-center-text',
              'bg-gradient-to-br from-white via-white/95 to-white/70 bg-clip-text text-transparent'
            )}
            style={{
              color: centerColor ? centerColor.color : undefined,
              textShadow: centerColor
                ? `0 0 30px ${centerColor.glow}`
                : '0 0 40px rgba(255, 255, 255, 0.1), 0 0 80px rgba(168, 85, 247, 0.15)',
            }}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
          >
            {centerLabel}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Arc items container */}
      <div className="relative flex justify-center items-end h-24 pb-2">
        {/* Arc background hint */}
        <div
          className={cn(
            'absolute bottom-0 left-1/2 -translate-x-1/2',
            'w-[200px] h-[100px]',
            'border-t border-l border-r border-white/[0.03]',
            'rounded-t-full',
            'pointer-events-none'
          )}
        />

        {/* Navigation items */}
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          const isHovered = hoveredItemId === item.id;
          const pos = itemPositions[index];
          const semanticColor = getSemanticColor(item.id);
          const glowColor = semanticColor?.glow || 'rgba(168, 85, 247, 0.5)';
          const textColor = semanticColor?.color || 'hsl(var(--primary))';

          return (
            <motion.button
              key={item.id}
              className={cn(
                'absolute flex flex-col items-center gap-0.5',
                'p-2.5 rounded-xl',
                'glass-subtle',
                'border border-white/[0.05]',
                'transition-colors duration-300',
                isActive && 'border-primary/40 bg-[#0a0514]/80'
              )}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
              }}
              variants={itemVariants}
              onClick={() => handleNavigate(item.id)}
              onTouchStart={() => setHoveredItem(item.id)}
              onTouchEnd={() => setHoveredItem(null)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              whileTap={{ scale: 0.92 }}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="mobileActiveIndicator"
                  className={cn(
                    'absolute -top-1 left-1/2 -translate-x-1/2',
                    'w-6 h-0.5 rounded-full',
                    'bg-primary',
                    'shadow-[0_0_8px_1px_rgba(168,85,247,0.6)]'
                  )}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Icon */}
              <motion.span
                animate={{
                  filter: isHovered || isActive
                    ? `drop-shadow(0 0 8px ${glowColor})`
                    : 'none',
                }}
                transition={{ duration: 0.2 }}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors duration-200',
                    isActive && 'text-primary'
                  )}
                  style={{
                    color: isHovered ? textColor : undefined,
                  }}
                  strokeWidth={1.75}
                />
              </motion.span>

              {/* Label */}
              <span
                className={cn(
                  'text-[9px] font-medium transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground/70'
                )}
                style={{
                  color: isHovered ? textColor : undefined,
                }}
              >
                {item.label}
              </span>

              {/* Hover glow */}
              {isHovered && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none radial-item-glow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    '--radial-glow-color': glowColor,
                    background: `radial-gradient(circle at center, ${glowColor.replace('0.5', '0.08')} 0%, transparent 70%)`,
                  } as React.CSSProperties}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}

export default RadialNavMobile;
