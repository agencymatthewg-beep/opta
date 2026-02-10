/**
 * DragDropContext - dnd-kit context wrapper with Obsidian styling
 *
 * Provides drag-and-drop context using dnd-kit with:
 * - Pointer sensor (mouse/touch) with activation constraint
 * - Keyboard sensor for accessibility
 * - DragOverlay for floating preview during drag
 *
 * @see DESIGN_SYSTEM.md - Part 6: Animation Standards
 */

import { useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// Spring physics easing for drop animations
const springTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
  mass: 0.8,
};

export interface DragDropContextProps {
  children: ReactNode;
  onDragStart?: (event: DragStartEvent) => void;
  onDragOver?: (event: DragOverEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  /** Render function for drag overlay content */
  renderOverlay?: (activeId: string) => ReactNode;
}

/**
 * Screen reader announcements for drag actions
 */
const screenReaderAnnouncements = {
  onDragStart({ active }: DragStartEvent) {
    return `Picked up draggable item ${active.id}. Use arrow keys to move, Space to drop.`;
  },
  onDragOver({ active, over }: DragOverEvent) {
    if (over) {
      return `Draggable item ${active.id} is over droppable area ${over.id}.`;
    }
    return `Draggable item ${active.id} is no longer over a droppable area.`;
  },
  onDragEnd({ active, over }: DragEndEvent) {
    if (over) {
      return `Draggable item ${active.id} was dropped onto ${over.id}.`;
    }
    return `Draggable item ${active.id} was dropped. Drag cancelled.`;
  },
  onDragCancel({ active }: { active: { id: string | number } }) {
    return `Dragging was cancelled. Draggable item ${active.id} was returned.`;
  },
};

/**
 * DragDropContext - Provides drag-drop functionality with keyboard accessibility
 */
export function DragDropContext({
  children,
  onDragStart,
  onDragOver,
  onDragEnd,
  renderOverlay,
}: DragDropContextProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  // Configure sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require 8px movement to start drag - prevents accidental drags
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    onDragStart?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    onDragOver?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    onDragEnd?.(event);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{
        announcements: screenReaderAnnouncements,
        screenReaderInstructions: {
          draggable:
            'To pick up a draggable item, press Space or Enter. While dragging, use the arrow keys to move the item. Press Space again to drop the item in its new position, or press Escape to cancel.',
        },
      }}
    >
      {children}

      {/* Drag Overlay - Floating preview during drag */}
      <DragOverlay dropAnimation={{
        duration: 300,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <AnimatePresence>
          {activeId && renderOverlay ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1.02 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={springTransition}
              className={cn(
                'pointer-events-none',
                // Obsidian glass elevated appearance
                'bg-[#0a0514]/95 backdrop-blur-xl',
                'border border-primary/40',
                'rounded-lg',
                'shadow-[0_0_30px_-5px_rgba(168,85,247,0.4),inset_0_0_20px_rgba(168,85,247,0.1)]'
              )}
            >
              {renderOverlay(activeId)}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </DragOverlay>
    </DndContext>
  );
}

export default DragDropContext;
