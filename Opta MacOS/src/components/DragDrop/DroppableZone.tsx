/**
 * DroppableZone - Drop target for process termination
 *
 * Creates a "quarantine zone" where dropping a process triggers termination.
 * Features:
 * - Visual feedback when dragging over (destructive glow)
 * - Spring physics for scale animation
 * - Full ARIA support for screen readers
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Ban, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Spring physics for drop zone animation
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 25,
  mass: 0.8,
};

export type DroppableVariant = 'default' | 'destructive';

export interface DroppableZoneProps {
  /** Unique identifier for the drop zone */
  id: string;
  /** Label text to display in the zone */
  label: string;
  /** Optional custom icon */
  icon?: ReactNode;
  /** Visual variant - default or destructive (red) */
  variant?: DroppableVariant;
  /** Whether the zone is disabled */
  disabled?: boolean;
}

/**
 * Variant styles for different zone types
 */
const variantStyles: Record<
  DroppableVariant,
  { base: string; active: string; icon: string; text: string }
> = {
  default: {
    base: 'border-border/30 hover:border-primary/50',
    active: 'border-primary bg-primary/10 shadow-[0_0_25px_-5px_rgba(168,85,247,0.4)]',
    icon: 'text-muted-foreground',
    text: 'text-muted-foreground',
  },
  destructive: {
    base: 'border-danger/20 hover:border-danger/40',
    active: 'border-danger bg-danger/10 shadow-[0_0_30px_-5px_rgba(239,68,68,0.5)]',
    icon: 'text-danger',
    text: 'text-danger',
  },
};

/**
 * DroppableZone - Drop target with visual feedback
 */
export function DroppableZone({
  id,
  label,
  icon,
  variant = 'default',
  disabled = false,
}: DroppableZoneProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id,
    disabled,
  });

  const styles = variantStyles[variant];
  const showActive = isOver && active;

  // Default icons based on variant
  const defaultIcon =
    variant === 'destructive' ? (
      <Trash2 className="w-5 h-5" strokeWidth={1.75} />
    ) : (
      <Ban className="w-5 h-5" strokeWidth={1.75} />
    );

  const displayIcon = icon || defaultIcon;

  return (
    <motion.div
      ref={setNodeRef}
      className={cn(
        // Base obsidian glass styling
        'glass-subtle rounded-xl',
        'border-2 border-dashed',
        'p-4 min-h-[80px]',
        'flex items-center justify-center gap-3',
        // Transitions
        'transition-colors duration-200',
        // Variant base styles
        styles.base,
        // Active state when dragging over
        showActive && styles.active,
        // Disabled state
        disabled && 'opacity-40 pointer-events-none'
      )}
      animate={{
        scale: showActive ? 1.02 : 1,
        y: showActive ? -2 : 0,
      }}
      transition={springTransition}
      role="region"
      aria-label={label}
      aria-dropeffect={variant === 'destructive' ? 'execute' : 'move'}
      aria-disabled={disabled}
    >
      {/* Icon with glow effect when active */}
      <motion.div
        className={cn(
          'transition-colors duration-200',
          showActive ? styles.icon : 'text-muted-foreground/60'
        )}
        animate={{
          scale: showActive ? 1.15 : 1,
        }}
        transition={springTransition}
        style={
          showActive && variant === 'destructive'
            ? { filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' }
            : showActive
              ? { filter: 'drop-shadow(0 0 8px rgba(168, 85, 247, 0.6))' }
              : undefined
        }
      >
        {displayIcon}
      </motion.div>

      {/* Label text */}
      <span
        className={cn(
          'text-sm font-medium transition-colors duration-200',
          showActive ? styles.text : 'text-muted-foreground/60'
        )}
      >
        {label}
      </span>

      {/* Pulsing indicator when active */}
      {showActive && (
        <motion.div
          className={cn(
            'absolute inset-0 rounded-xl pointer-events-none',
            variant === 'destructive'
              ? 'bg-danger/5'
              : 'bg-primary/5'
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </motion.div>
  );
}

export default DroppableZone;
