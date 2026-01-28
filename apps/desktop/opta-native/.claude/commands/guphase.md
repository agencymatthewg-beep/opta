# /guphase - Phase Summary Generator

Generate a comprehensive visual HTML summary of completed phases, current status, and upcoming work.

## Instructions

When this command is invoked:

1. Read the project's `.planning/STATE.md` and `.planning/ROADMAP.md` to understand current progress
2. Generate a rich HTML document using the /gu output style that includes:
   - **Completed Phase Summary**: What was implemented, key files created, features added
   - **Current Status**: Build status, any errors, integration state
   - **Upcoming Phases**: Next phases with priority levels
   - **Timeline**: Estimated completion dates based on phase complexity

3. The output should use the GenUI format with:
   - Glass morphism styling
   - Progress indicators
   - Expandable sections for each phase
   - Color-coded priority levels (Critical=red, High=orange, Medium=yellow, Low=green)

## Output Format

Generate HTML that opens in the browser with:
- Dark theme matching Opta's obsidian aesthetic
- Animated progress bars
- Collapsible phase details
- Status badges (Completed ✓, In Progress ⟳, Pending ○)

## Usage

```
/guphase
```

No arguments needed - automatically reads project state.
