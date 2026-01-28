# /iOS - Opta iOS Project Context

Load Opta iOS (SwiftUI) plans and context with next and last steps.

## Instructions

1. **Read Project Files**
   - Read `Opta iOS/.planning/ROADMAP.md` for full roadmap
   - Read `Opta iOS/.planning/STATE.md` for current state
   - Read `Opta iOS/.planning/PROJECT.md` for project overview
   - Check `Opta iOS/CLAUDE.md` for iOS-specific instructions

2. **Gather Context**
   - Current phase number and name
   - Plans completed vs remaining
   - Last completed work
   - Next steps to execute
   - Any blockers or build issues

3. **Report to User**

   Include sections:
   - **Milestone Status**: Current milestone progress
   - **Current Phase**: Active phase details
   - **Last Steps Completed**: Recent phase/plan summaries
   - **Next Steps**: Immediate actions with plan references
   - **Build Status**: Last build result if known
   - **Key Files**: Files being modified

## Output Sections

### Milestone Progress
```
Current Milestone: [milestone name]
Phase Progress: X of Y phases complete
```

### Phase Table
| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| ... | ... | ... | ... |

### Current Work Card
From STATE.md - what's actively being worked on

### Last Completed Card
- Recent phase summaries
- Recent commits

### Next Actions Card
Numbered list from STATE.md or next incomplete phase

## Tech Stack Reference

- **Framework**: SwiftUI, iOS 16+
- **Core**: Rust (via UniFFI)
- **ML**: CoreML
- **Build**: Xcode

## Related Commands

- `/MacOS` - Opta MacOS project context
