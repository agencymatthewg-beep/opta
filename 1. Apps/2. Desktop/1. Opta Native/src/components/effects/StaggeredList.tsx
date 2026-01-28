/**
 * StaggeredList - Animated list component with cascading entry
 *
 * Renders a list of items with staggered animation on entry.
 * Items cascade in with a configurable delay between each.
 *
 * Per Gemini research:
 * - "Staggered Entry: Items cascade in with 10-20ms delay"
 * - "Creates premium feel and visual hierarchy"
 *
 * @example
 * ```tsx
 * <StaggeredList
 *   items={users}
 *   renderItem={(user) => <UserCard user={user} />}
 *   keyExtractor={(user) => user.id}
 *   stagger="fast"
 * />
 * ```
 *
 * @see DESIGN_SYSTEM.md - Animation Standards
 */

import { useMemo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  createContainerVariants,
  createItemVariants,
  reducedMotionItemVariants,
  type StaggerPreset,
} from '@/lib/animation/stagger';
import { type SpringPreset } from '@/lib/animation/springs';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface StaggeredListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Extract unique key from item */
  keyExtractor: (item: T) => string;
  /** Stagger timing preset */
  stagger?: StaggerPreset;
  /** Animation variant style */
  variant?: 'standard' | 'fade' | 'slide' | 'pop' | 'ignition';
  /** Spring preset for item animations */
  spring?: SpringPreset;
  /** Additional CSS classes for container */
  className?: string;
  /** Additional CSS classes for each item wrapper */
  itemClassName?: string;
  /** Whether to use layout animations for reordering */
  layoutAnimation?: boolean;
  /** Container element type */
  as?: 'ul' | 'ol' | 'div';
  /** Item wrapper element type */
  itemAs?: 'li' | 'div';
  /** Callback when all items have animated in */
  onAnimationComplete?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StaggeredList<T>({
  items,
  renderItem,
  keyExtractor,
  stagger = 'normal',
  variant = 'standard',
  spring = 'smooth',
  className,
  itemClassName,
  layoutAnimation = false,
  as: _Container = 'div',
  itemAs: _ItemWrapper = 'div',
  onAnimationComplete,
}: StaggeredListProps<T>) {
  const prefersReducedMotion = useReducedMotion();

  // Get appropriate variants based on motion preference
  const containerVariants = useMemo(
    () => createContainerVariants(prefersReducedMotion ? 'instant' : stagger),
    [prefersReducedMotion, stagger]
  );

  const itemVariants = useMemo(
    () =>
      prefersReducedMotion
        ? reducedMotionItemVariants
        : createItemVariants(spring, variant),
    [prefersReducedMotion, spring, variant]
  );

  // Wrap with LayoutGroup if layout animation is enabled
  const content = (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onAnimationComplete={(definition) => {
        if (definition === 'visible' && onAnimationComplete) {
          onAnimationComplete();
        }
      }}
    >
      <AnimatePresence mode="popLayout">
        {items.map((item, index) => (
          <motion.div
            key={keyExtractor(item)}
            variants={itemVariants}
            className={itemClassName}
            layout={layoutAnimation}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );

  return layoutAnimation ? <LayoutGroup>{content}</LayoutGroup> : content;
}

// =============================================================================
// SPECIALIZED VARIANTS
// =============================================================================

/**
 * StaggeredGrid - Grid variant with staggered animation
 *
 * @example
 * ```tsx
 * <StaggeredGrid
 *   items={cards}
 *   columns={3}
 *   renderItem={(card) => <Card {...card} />}
 *   keyExtractor={(card) => card.id}
 * />
 * ```
 */
export interface StaggeredGridProps<T> extends Omit<StaggeredListProps<T>, 'className'> {
  /** Number of columns */
  columns?: 2 | 3 | 4 | 5 | 6;
  /** Gap between items (Tailwind spacing) */
  gap?: 2 | 3 | 4 | 5 | 6 | 8;
  /** Additional CSS classes */
  className?: string;
}

export function StaggeredGrid<T>({
  columns = 3,
  gap = 4,
  className,
  ...props
}: StaggeredGridProps<T>) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[columns];

  const gridGap = {
    2: 'gap-2',
    3: 'gap-3',
    4: 'gap-4',
    5: 'gap-5',
    6: 'gap-6',
    8: 'gap-8',
  }[gap];

  return (
    <StaggeredList
      {...props}
      className={cn('grid', gridCols, gridGap, className)}
      variant="pop" // Pop variant works well for grids
    />
  );
}

// =============================================================================
// STAGGERED CHILDREN WRAPPER
// =============================================================================

/**
 * StaggeredChildren - Simple wrapper for staggering direct children
 *
 * Use this when you don't have an array but want to stagger
 * multiple child elements.
 *
 * @example
 * ```tsx
 * <StaggeredChildren stagger="fast">
 *   <Card />
 *   <Card />
 *   <Card />
 * </StaggeredChildren>
 * ```
 */
export interface StaggeredChildrenProps {
  children: React.ReactNode;
  stagger?: StaggerPreset;
  variant?: 'standard' | 'fade' | 'slide' | 'pop' | 'ignition';
  className?: string;
}

export function StaggeredChildren({
  children,
  stagger = 'normal',
  variant = 'standard',
  className,
}: StaggeredChildrenProps) {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => createContainerVariants(prefersReducedMotion ? 'instant' : stagger),
    [prefersReducedMotion, stagger]
  );

  const childVariants = useMemo(
    () =>
      prefersReducedMotion
        ? reducedMotionItemVariants
        : createItemVariants('smooth', variant),
    [prefersReducedMotion, variant]
  );

  // Convert children to array and wrap each
  const childArray = Array.isArray(children) ? children : [children];

  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {childArray.map((child, index) => (
        <motion.div key={index} variants={childVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export default StaggeredList;
