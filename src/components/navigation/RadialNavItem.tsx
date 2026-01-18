import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRadialNav } from '@/contexts/RadialNavContext';
import { smoothOut } from '@/lib/animations';

/**
 * RadialNavItem - Individual navigation item in the radial menu
 *
 * Positioned absolutely using transform, emerges from center with ignition animation.
 * Features semantic color glow on hover and energy indicator when active.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

interface RadialNavItemProps {
  item: {
    id: string;
    label: string;
    icon: LucideIcon;
  };
  position: { x: number; y: number; angle: number };
  isActive: boolean;
  isHovered: boolean;
  onHover: (itemId: string | null) => void;
  onClick: () => void;
  index: number;
}

/**
 * Animation variants for radial nav items
 * Items emerge from center with ignition effect
 */
const itemVariants = {
  hidden: {
    x: 0,
    y: 0,
    scale: 0,
    opacity: 0,
    filter: 'brightness(0) blur(10px)',
  },
  visible: (custom: { x: number; y: number; index: number }) => ({
    x: custom.x,
    y: custom.y,
    scale: 1,
    opacity: 1,
    filter: 'brightness(1) blur(0px)',
    transition: {
      delay: custom.index * 0.05,
      duration: 0.6,
      ease: smoothOut,
    },
  }),
};

export function RadialNavItem({
  item,
  position,
  isActive,
  isHovered,
  onHover,
  onClick,
  index,
}: RadialNavItemProps) {
  const { getSemanticColor } = useRadialNav();
  const Icon = item.icon;

  // Get semantic color for this item
  const semanticColor = getSemanticColor(item.id);
  const glowColor = semanticColor?.glow || 'rgba(168, 85, 247, 0.5)';
  const textColor = semanticColor?.color || 'hsl(var(--primary))';

  return (
    <motion.button
      className={cn(
        'absolute flex flex-col items-center gap-2',
        'p-4 rounded-2xl',
        // Obsidian glass base
        'glass',
        'border border-white/[0.05]',
        'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
        // Transition for non-animated properties
        'transition-colors duration-300',
        // Active state
        isActive && 'border-primary/40'
      )}
      style={{
        // Position will be animated by Framer Motion via custom prop
        transformOrigin: 'center center',
      }}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      custom={{ x: position.x, y: position.y, index }}
      whileHover={{
        scale: 1.08,
        borderColor: isActive
          ? 'rgba(168, 85, 247, 0.5)'
          : 'rgba(255, 255, 255, 0.1)',
        boxShadow: isHovered
          ? `inset 0 0 20px ${glowColor.replace('0.5', '0.15')}, 0 0 25px ${glowColor}`
          : undefined,
        transition: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.95 }}
      onHoverStart={() => onHover(item.id)}
      onHoverEnd={() => onHover(null)}
      onClick={onClick}
      aria-label={`Navigate to ${item.label}`}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Active Energy Indicator */}
      {isActive && (
        <motion.div
          layoutId="radialActiveIndicator"
          className={cn(
            'absolute -bottom-1 left-1/2 -translate-x-1/2',
            'w-8 h-1 rounded-full',
            'bg-primary',
            'shadow-[0_0_12px_2px_rgba(168,85,247,0.6)]'
          )}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* Icon with semantic color glow */}
      <motion.span
        className="relative"
        animate={{
          filter: isHovered || isActive
            ? `drop-shadow(0 0 12px ${glowColor})`
            : 'none',
        }}
        transition={{ duration: 0.3 }}
      >
        <Icon
          className={cn(
            'w-6 h-6 transition-colors duration-300',
            isActive && 'text-primary',
            isHovered && !isActive && 'text-foreground'
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
          'text-xs font-medium transition-colors duration-300',
          isActive ? 'text-primary' : 'text-muted-foreground',
          isHovered && !isActive && 'text-foreground'
        )}
        style={{
          color: isHovered ? textColor : undefined,
        }}
      >
        {item.label}
      </span>

      {/* Hover glow background */}
      {isHovered && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: `radial-gradient(circle at center, ${glowColor.replace('0.5', '0.1')} 0%, transparent 70%)`,
          }}
        />
      )}
    </motion.button>
  );
}

export default RadialNavItem;
