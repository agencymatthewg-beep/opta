/**
 * DragDrop Components - Barrel exports
 *
 * Provides accessible drag-and-drop functionality for the ProcessList.
 * Uses dnd-kit for keyboard accessibility and spring physics animations.
 *
 * @example
 * ```tsx
 * import {
 *   DragDropContext,
 *   DraggableProcess,
 *   DroppableZone,
 *   DragInstructions
 * } from '@/components/DragDrop';
 *
 * function ProcessList() {
 *   return (
 *     <DragDropContext onDragEnd={handleDragEnd}>
 *       <DragInstructions />
 *       {processes.map(p => (
 *         <DraggableProcess key={p.pid} id={String(p.pid)}>
 *           <ProcessRow process={p} />
 *         </DraggableProcess>
 *       ))}
 *       <DroppableZone id="quarantine" label="Drop to terminate" variant="destructive" />
 *     </DragDropContext>
 *   );
 * }
 * ```
 */

export { DragDropContext, type DragDropContextProps } from './DragDropContext';
export {
  DraggableProcess,
  DragInstructions,
  type DraggableProcessProps,
} from './DraggableProcess';
export {
  DroppableZone,
  type DroppableZoneProps,
  type DroppableVariant,
} from './DroppableZone';
