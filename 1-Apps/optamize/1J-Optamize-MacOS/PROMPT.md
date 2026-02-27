# Opta Development Loop

## Project Context

Opta is a system optimization application built with:
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Tauri v2 (Rust)
- **System Integration**: Python MCP Server

## Instructions

Work through the tasks in `.agent/scratchpad.md` following the current hat's instructions.

### Backpressure Commands

**For Rust (Tauri backend):**
```bash
cd src-tauri && cargo check && cargo test && cargo clippy -- -D warnings
```

**For TypeScript (Frontend):**
```bash
npm run build && npm run lint
```

### Key Files

- **Design System**: `/DESIGN_SYSTEM.md` - All UI must comply
- **Project Status**: `.planning/STATE.md`
- **Roadmap**: `.planning/ROADMAP.md`

## Completion

When all tasks are complete and verified, output:
```
LOOP_COMPLETE
```
