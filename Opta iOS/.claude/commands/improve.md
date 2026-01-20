# /improve - Iterative Improvement

Launch iterative-improver agent to polish recent changes through systematic micro-refinements.

## Instructions

1. Launch iterative-improver agent
2. Agent analyzes recent changes (git diff or conversation context)
3. Applies 20-50+ small improvements across categories:
   - Naming, comments, formatting
   - Error handling, type safety
   - Performance, readability
   - For docs: clarity, structure, completeness

## Output Format

GenUI HTML report saved to `/tmp/` with:
- Summary dashboard (total improvements, by category)
- Improvement cards (before/after with rationale)
- Files index and statistics

## When to Use

- After completing a feature or phase
- Before committing substantial changes
- After drafting planning documents
- To polish code quality without behavioral changes

## Opta-Specific Notes

- Follows DESIGN_SYSTEM.md for UI code
- Checks Framer Motion usage (not CSS transitions)
- Verifies Lucide React icons (not inline SVGs)
- Ensures glass effects and CSS variables

## Related Commands

- `/build` - Verify changes compile
- `/commit` - After improvements are complete

## Notes

- Non-breaking: no logic or functionality changes
- Follows project conventions from CLAUDE.md
- All improvements are atomic and reversible
