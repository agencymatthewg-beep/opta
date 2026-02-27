/**
 * DraggableProcess - Draggable wrapper for process rows
 *
 * Provides drag functionality using dnd-kit with:
 * - Drag handle (grip icon) that triggers drag
 * - Visual feedback during drag state
 * - Keyboard accessibility via aria attributes
 *
 * @see DESIGN_SYSTEM.md - Part 6: Animation Standards
 */

import { type ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Spring physics for drag feedback
const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

export interface DraggableProcessProps {
  /** Unique identifier for the draggable item */
  id: string;
  /** Content to render inside the draggable wrapper */
  children: ReactNode;
  /** Whether dragging is disabled (e.g., for system processes) */
  disabled?: boolean;
  /** Additional data to pass with the draggable */
  data?: Record<string, unknown>;
}

/**
 * DraggableProcess - Makes process rows draggable with keyboard support
 */
export function DraggableProcess({
  id,
  children,
  disabled = false,
  data,
}: DraggableProcessProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
    data,
  });

  // Transform style for dragging
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'z-50',
        disabled && 'opacity-60'
      )}
      animate={{
        opacity: isDragging ? 0.5 : 1,
        scale: isDragging ? 0.98 : 1,
      }}
      transition={springTransition}
    >
      {/* Drag Handle - Only visible on hover, accessible via keyboard */}
      {!disabled && (
        <motion.button
          {...attributes}
          {...listeners}
          type="button"
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-20',
            'px-1.5 py-2 -ml-7',
            'rounded-md',
            // Visibility
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
            // Styling
            'text-muted-foreground hover:text-primary focus:text-primary',
            'hover:bg-primary/10 focus:bg-primary/10',
            // Transitions
            'transition-all duration-200',
            // Cursor
            'cursor-grab active:cursor-grabbing',
            // Focus ring for accessibility
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background'
          )}
          aria-label={`Drag to reorder or terminate process ${id}`}
          aria-describedby="dnd-instructions"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <GripVertical className="w-4 h-4" strokeWidth={1.75} />
        </motion.button>
      )}

      {/* Process Row Content */}
      <div
        className={cn(
          isDragging && [
            'bg-primary/5 rounded-lg',
            'shadow-[0_0_20px_-5px_rgba(168,85,247,0.3)]',
            'border border-primary/20',
          ]
        )}
      >
        {children}
      </div>
    </motion.div>
  );
}

/**
 * Screen reader instructions component - render once per drag context
 */
export function DragInstructions() {
  return (
    <div id="dnd-instructions" className="sr-only">
      Press Space or Enter to start dragging. Use arrow keys to move. Press
      Space to drop on a target, or Escape to cancel.
    </div>
  );
}

export default DraggableProcess;
