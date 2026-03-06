# Opta Settings Layered Navigation

This document defines the in-place, depth-based Settings Studio interaction model used by Opta Code.

## Layer Model

Opta settings are rendered as a 4-layer navigation stack, not modal popups.

1. `L1` Chat Environment
2. `L2` Settings Areas Menu (card grid)
3. `L3` Settings Area Configuration (selected settings tab)
4. `L4` Deep Configuration (focused configuration view for the selected tab)

The model keeps spatial continuity with progressive depth transitions instead of context-breaking overlays.

## Transition Semantics

- `Ctrl+S` from `L1` enters `L2`.
- Selecting a settings area from `L2` transitions to `L3`.
- Deepening from `L3` transitions to `L4`.
- Moving upward returns one layer at a time (`L4 -> L3 -> L2 -> L1`).

Animation design:

- Deeper transitions (`+1` layer) use forward motion (subtle scale-in and perspective shift).
- Shallower transitions (`-1` layer) use reverse motion (scale-out and reverse perspective shift).
- Chat stays in place as the front layer reference and is blurred/scaled when deeper layers are active.

## Keyboard Navigation Contract

Global layer controls:

- `Ctrl+S`: Toggle between chat and settings navigation (`L1 <-> L2`).
- `Esc`: Move up one layer.
- `W` / `ArrowUp`: Move up one layer.
- `S` / `ArrowDown`: Move down one layer.

In-layer selection controls:

- `A` / `ArrowLeft`: Previous settings area.
- `D` / `ArrowRight`: Next settings area.
- `Enter` / `Space`: Activate current selection (move deeper).

Input safety:

- Layer-navigation shortcuts are ignored while typing in `input`, `textarea`, or `select` controls.

## Implementation Notes

- Shared tab metadata lives in `src/components/settingsStudioConfig.ts`.
- `SettingsView` is the canonical `L2` renderer.
- `SettingsModal` now supports embedded rendering for `L3` and `L4`.
- `App.tsx` owns the layer state machine and transition direction.

This architecture is designed to support future deeper levels without reworking UI primitives.
