# Plan 20-04: Drag & Drop Process Management - Summary

**Phase:** 20 - Rich Interactions
**Feature:** Accessible Drag-Drop for ProcessList
**Status:** Complete
**Date:** 2026-01-17

---

## Implementation Summary

Successfully implemented accessible drag-and-drop functionality for the ProcessList component using dnd-kit. Users can now drag processes to a quarantine zone to trigger termination, with full keyboard accessibility and haptic feedback.

---

## Files Created

| File | Purpose |
|------|---------|
| `src/components/DragDrop/DragDropContext.tsx` | Context wrapper with sensors, collision detection, and DragOverlay |
| `src/components/DragDrop/DraggableProcess.tsx` | Draggable wrapper with grip handle and keyboard support |
| `src/components/DragDrop/DroppableZone.tsx` | Drop target with destructive variant for quarantine |
| `src/components/DragDrop/index.ts` | Barrel exports for clean imports |
| `src/hooks/useHapticFeedback.ts` | Web Vibration API hook with predefined patterns |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ProcessList.tsx` | Integrated DragDropContext, wrapped rows with DraggableProcess, added quarantine zone |
| `package.json` | Added @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |

---

## Key Features Implemented

### 1. Drag & Drop Infrastructure

- **DragDropContext**: Wraps the ProcessList with dnd-kit's DndContext
  - PointerSensor with 8px activation constraint (prevents accidental drags)
  - KeyboardSensor with sortable coordinates for arrow key navigation
  - closestCenter collision detection algorithm
  - DragOverlay for floating preview during drag

### 2. Draggable Process Rows

- **DraggableProcess**: Wraps each process row
  - Grip handle appears on hover (GripVertical icon from Lucide)
  - System processes are disabled (cannot be dragged)
  - Visual feedback during drag (opacity, scale, glow)
  - Framer Motion spring physics for animations

### 3. Quarantine Drop Zone

- **DroppableZone**: Destructive variant drop target
  - Appears only during active drag
  - Red glow and scale animation when process hovers
  - Dynamic label shows process name being dropped
  - ARIA attributes for screen readers (`aria-dropeffect="execute"`)

### 4. Haptic Feedback

- **useHapticFeedback**: Web Vibration API integration
  - Predefined patterns: pickup, drop, success, error, destructive
  - Respects `prefers-reduced-motion` user preference
  - Graceful fallback on unsupported devices (desktop browsers)

### 5. Accessibility

- Full keyboard support via dnd-kit's KeyboardSensor
- Screen reader announcements for drag state changes
- Hidden instructions element (`#dnd-instructions`)
- Focus rings on drag handles
- ARIA labels describing drag actions

---

## Design System Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Animations** | Framer Motion for all transitions (spring physics) |
| **Icons** | Lucide React (GripVertical, Trash2, Ban, XCircle) |
| **Glass Effects** | Obsidian glass on drag overlay and drop zone |
| **Colors** | CSS variables only (--primary, --danger, --muted-foreground) |
| **Typography** | Sora font (inherited) |

---

## Technical Notes

### Spring Physics Configuration

```tsx
// DragDropContext overlay animation
const springTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
  mass: 0.8,
};

// DraggableProcess feedback animation
const springTransition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};
```

### Sensor Configuration

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }, // Prevents accidental drags
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);
```

### Process Termination Integration

The termination logic is stubbed with a TODO comment:
```tsx
// TODO: Integrate with actual process termination via Tauri
// await invoke('kill_process', { pid: process.pid });
```

This requires the Tauri backend command to be implemented (tracked separately).

---

## Verification Results

- [x] dnd-kit packages installed successfully
- [x] Process rows show drag handle on hover
- [x] Pointer drag works (mouse/touch)
- [x] Keyboard drag works (Space to pick up, arrows to move)
- [x] System processes cannot be dragged (disabled state)
- [x] User/safe-to-kill processes can be dragged
- [x] Quarantine zone appears during drag
- [x] Quarantine zone highlights red when process hovers
- [x] Drag overlay shows floating preview with glass effect
- [x] Screen reader receives announcements
- [x] Haptic patterns defined and triggered
- [x] `vite build` passes successfully

---

## Known Issues / Future Work

1. **Process termination**: Actual `kill_process` Tauri command integration pending
2. **Confirmation modal**: System process termination warning needs modal UI
3. **Multi-select drag**: Future enhancement for bulk termination
4. **Undo functionality**: Consider toast with undo for accidental terminations

---

## Dependencies Added

```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

---

*Plan completed: 2026-01-17*
*Implementation time: ~1 hour*
