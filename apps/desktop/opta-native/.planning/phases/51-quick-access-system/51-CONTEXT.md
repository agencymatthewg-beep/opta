# Phase 51: Quick Access System - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<vision>
## How This Should Work

Chess should be always accessible without being intrusive. A glanceable widget lives somewhere on screen — showing whether it's your turn, if there's a daily puzzle waiting, your current streak — giving you the pull to come back without demanding attention.

The widget fits seamlessly into Opta's glass aesthetic. It's draggable so users can position it wherever feels right for their workflow. When tapped, it expands in place by default (smooth animation), but users can configure it to open as a modal overlay instead if they prefer focused chess time.

Beyond the widget, a dedicated keyboard shortcut provides instant access — no hunting, just press and you're in.

**Critical insight:** Everywhere chess appears — widget, overlay, full page — has the same three-tab navigation:
1. **Play** — Game against AI (Stockfish/Opta clone)
2. **Puzzles** — Tactical training
3. **Tutor** — Interactive learning with Opta

This consistency means you can switch modes from anywhere without navigating back to a "chess home."

</vision>

<essential>
## What Must Be Nailed

- **Glanceable status at a glance** — Your move indicator, puzzle status, streak count all visible without opening chess
- **Matches Opta aesthetic** — Glass panel, subtle glow, feels native to the app
- **Draggable positioning** — User controls where the widget lives
- **Consistent three-mode navigation** — Play/Puzzles/Tutor tabs available everywhere chess appears
- **Keyboard shortcut** — Instant toggle without finding the widget

</essential>

<specifics>
## Specific Ideas

**Widget behavior:**
- Shows multiple status indicators together (not just one thing)
- Expands in place by default, configurable to modal overlay
- Position persists across sessions

**Three-mode architecture:**
- **Play tab** — vs AI chess board
- **Puzzles tab** — Puzzle interface
- **Tutor tab** — Uses Opta O to help optimize moves (explains when there was a better move), uses Atpo to find mistakes and blunders and explain why they're problematic

**Keyboard shortcut:**
- Dedicated hotkey (Cmd+Shift+C suggested) for instant toggle
- Not command palette — direct shortcut

</specifics>

<notes>
## Additional Context

This phase establishes the access pattern that carries through v7.0. The three-tab architecture (Play/Puzzles/Tutor) should be designed knowing that:
- Phase 52 builds out the Puzzles tab
- Phase 55 builds out the Tutor tab with Opta Ring integration
- Phase 56 redesigns the board UI used across all three

The "Tutor" concept ties into Opta's personality — Opta O for optimization suggestions, Atpo for mistake analysis. This positions chess learning as part of Opta's broader "help you get better" mission.

</notes>

---

*Phase: 51-quick-access-system*
*Context gathered: 2026-01-18*
