# /decisions - Decision Lookup

List and search architectural decisions from STATE.md.

## Process

### 1. Read Decisions

Read `.planning/STATE.md` and extract the "Accumulated Context > Decisions" table.

### 2. Display Recent Decisions

Show the last 10-15 decisions by default:

```
RECENT DECISIONS
═══════════════════════════════════════════════════════════════
Phase   Decision                              Rationale
───────────────────────────────────────────────────────────────
05-03   Context-aware chat with telemetry     Include system state in prompts
05-03   System prompt with optimization       GPU, games, processes focus
05-02   Non-streaming with typing indicator   Keeps MVP simple
05-02   localStorage for chat state           Maintains UX across sessions
05-01   Ollama over llama.cpp                 Simpler setup, good SDK
05-01   Default model llama3:8b               Balance of quality and speed
04-02   Per-session dismissible banner        Non-intrusive conflict warnings
04-01   10-second polling for conflicts       Competitors don't change often
───────────────────────────────────────────────────────────────

Showing 8 of 62 decisions. Use /decisions --all for full list.
```

## Options

### Filter by Phase
```
/decisions --phase 05
```
Shows only decisions from Phase 5.

### Filter by Category
```
/decisions --category architecture
```
Categories: architecture, performance, safety, design, ux

### Search
```
/decisions --search "polling"
```
Finds decisions containing "polling".

### Show All
```
/decisions --all
```
Shows all 62+ decisions (paginated).

## Categories

Decisions are auto-categorized based on keywords:

| Category | Keywords |
|----------|----------|
| Architecture | MCP, Tauri, Hybrid, API, integration |
| Performance | polling, interval, cache, limit, timeout |
| Safety | human-in-the-loop, rollback, confirm, validate |
| Design | glass, animation, Framer, Lucide, color |
| UX | modal, drawer, button, indicator, feedback |

## Export

```
/decisions --export
```
Creates `.planning/DECISIONS_INDEX.md` with categorized decisions for easy reference.
