# /MacOS - Opta MacOS Project Context

Load Opta MacOS (Tauri + React) plans and context with next and last steps.

## Instructions

1. **Read Project Files**
   - Read `Opta MacOS/.planning/ROADMAP.md` for full roadmap
   - Read `Opta MacOS/.planning/STATE.md` for current state
   - Read `Opta MacOS/.planning/PROJECT.md` for project overview
   - Check `Opta MacOS/CLAUDE.md` for MacOS-specific instructions
   - Check `Opta MacOS/DESIGN_SYSTEM.md` for UI/UX guidelines

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

- **Framework**: Tauri v2
- **Frontend**: React 19, TypeScript
- **Backend**: Rust
- **Server**: Python MCP Server
- **Build**: Cargo + npm

## Related Commands

- `/iOS` - Opta iOS project context
