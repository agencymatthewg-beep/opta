# OptaMenuBar Resources

## Quick Context
- Opta application source code and documentation
- Contains: iOS, macOS, web, CLI implementations
- Use for: building and extending Opta products


This directory contains resources for the Opta Menu Bar Swift plugin.

## Required Files

### opta-logo.riv
The animated Opta logo for the menu bar icon. This file should be created in the Rive editor (https://rive.app) and exported as a .riv file.

**State Machine Requirements:**
- Name: "State Machine 1"
- Inputs:
  - `speed` (Number): Controls rotation speed (0.5 = idle, 1.5 = active, 3.0 = critical)
  - `glowState` (Number): Controls glow color (0 = idle/purple, 1 = active/cyan, 2 = critical/red)

**Animation Guidelines:**
- Size: 22x22 points for menu bar
- Colors should match Opta brand:
  - Primary/Idle: #8B5CF6 (Electric Violet)
  - Active: #06B6D4 (Cyan)
  - Critical: #EF4444 (Red)
- Animation should be smooth at 60fps
- Keep file size small (<100KB) for fast loading

## Creating the Rive Animation

1. Open Rive Editor at https://rive.app
2. Create a new file with artboard size 22x22
3. Design the Opta logo (bolt or orbital design)
4. Add a rotation animation
5. Add glow/color states
6. Create state machine with inputs
7. Export as .riv format
8. Place in this directory as `opta-logo.riv`

## Fallback

If the Rive file is not present, the app will use an SF Symbol fallback (bolt.fill) with CSS-animated glow effects.
