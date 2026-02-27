# Opta Aesthetic Preferences (Validated 2026-01-17)

## Core Direction
**"Neon Luminal Glassmorphism"** - futuristic, liquid, premium but not gaudy.
**Status**: User validated as "perfect direction"

## Animation Preferences
- **Physics-based springs** - bouncy, organic feel (confirmed)
- **Micro-interaction scale**: 0.95 (noticeable, satisfying clicks)
- All animations via Framer Motion (never CSS transitions)

## Glassmorphism
- **Blur depth**: Medium (8-12px blur) - premium without overwhelming
- **4-layer system**: Backdrop, blur, noise overlay, specular highlight

## Neon/Glow Usage - LIBERAL APPROACH
More than just active states:
1. **Interactive Hints** - Subtle glow on hoverable buttons and cards
2. **Status Indicators** - Colored glow for success/warning/danger states
3. **NOT on section dividers** - See below

## Critical: Open, Floating Atmosphere
User emphasizes:
- Elements should appear **floating** when appropriate
- **Reduce lines and dividers** between sections
- The UI should feel like **one packaged, optimized app experience**
- **Circular and dynamic** UI, menu, and Opta Text
- Avoid hard divisions that take away from the **immersive, atmospheric feel**

## Implementation Notes
- Remove `<hr>` and border dividers where possible
- Use spacing and glass depth to create separation instead
- Let cards float with shadow rather than bordered containers
- Consider subtle gradients to imply boundaries without hard lines

## Design System Alignment
These preferences supersede/refine the DESIGN_SYSTEM.md guidance:
- Neon usage is MORE liberal than "active states only"
- Emphasis on floating, atmospheric feel over structured sections
