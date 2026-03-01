---
status: archived
---

# Opta CLI V3 — Master Execution Plan

> **Date:** 2026-02-16
> **Status: SUPERSEDED** — All 4 features (sub-agents, hooks, LSP, background shell) implemented via individual plans. Verified 2026-02-27.
> **Goal:** Implement 4 major features simultaneously to close the Agent Depth gap

## Current State

- **Version:** 0.3.0-alpha.1
- **Tools:** 14 built-in
- **Tests:** 195 passing (25 files)
- **Source:** 33 files, ~13K LOC

## Features Being Implemented

| # | Feature | Plan File | Tasks | New Files | Modified Files | Est. LOC |
|---|---------|-----------|-------|-----------|---------------|----------|
| 1 | Sub-Agents | `v3-sub-agents.md` | 9 | 4 (src + tests) | 4 | ~520 |
| 2 | Background Shell | `v3-background-shell.md` | 6 | 2 (src + tests) | 4 | ~430 |
| 3 | Hook System | `v3-hooks.md` | 8 | 2 (src + tests) | 2 | ~220 |
| 4 | LSP Integration | `v3-lsp.md` | 7 | 7 (4 src + 3 tests) | 4 | ~840 |

**Total: 30 TDD tasks, 15 new files, ~2,010 new LOC**

## Parallel Execution Strategy

All 4 features touch different areas of the codebase with minimal overlap:

### Conflict Analysis

| File | Sub-Agents | Bg Shell | Hooks | LSP |
|------|-----------|----------|-------|-----|
| `src/core/tools.ts` | +2 tools | +4 tools | — | +6 tools |
| `src/core/config.ts` | +subAgent section | +background section | +hooks section | +lsp section |
| `src/core/agent.ts` | refactor for child | init/shutdown | +7 fire() calls | — |
| `src/mcp/registry.ts` | +filter set | +filter set | — | +route lsp_* |

**Mitigation:** Each agent adds to DIFFERENT sections of shared files. Tools.ts gets new schemas appended (not modifying existing). Config.ts gets new Zod sections (additive). Agent.ts is the only real conflict zone — sub-agents and hooks both modify the loop.

**Resolution:** Hooks agent should NOT modify agent.ts. Instead, it creates the HookManager and a wiring function. The sub-agents agent handles agent.ts refactoring. After both complete, a final integration pass wires hooks into the refactored agent loop.

## Execution Order Per Agent

### Agent A: Sub-Agents (9 tasks)
1. SubAgentBudget validation + defaults
2. SubAgent context + depth tracking
3. System prompt generation
4. Permission derivation for children
5. Core spawnSubAgent function
6. Tool executor for spawn_agent
7. delegate_task orchestrator
8. Agent loop refactoring (OWNS agent.ts changes)
9. Registry integration

### Agent B: Background Shell (6 tasks)
1. CircularBuffer (pure data structure)
2. ManagedProcess + ProcessManager core
3. Output retrieval + since-last-read cursor
4. Kill + cleanup + SIGTERM/SIGKILL
5. Tool executors (bg_start/status/output/kill)
6. Agent loop integration (init/shutdown only)

### Agent C: Hook System (8 tasks)
1. No-op HookManager path
2. Hook execution + env vars
3. Matcher patterns (tool name matching)
4. tool.pre cancellation (non-zero exit)
5. Timeout protection
6. Background hooks (fire-and-forget)
7. Config schema (Zod)
8. Wire into agent.ts (AFTER Agent A finishes agent.ts refactor)

### Agent D: LSP Integration (7 tasks)
1. Protocol helpers (URI conversion, position mapping)
2. LspClient core (JSON-RPC, stdio transport)
3. LspManager (server pool, language detection)
4. Tool executors in tools.ts
5. Registry integration
6. Document synchronization
7. File edit notification in agent loop

## Post-Execution Integration

After all 4 agents complete:
1. Run `npm test` to verify all tests pass
2. Run `npm run typecheck` to verify type safety
3. Resolve any merge conflicts in shared files
4. Wire hooks into refactored agent loop (Task C8)
5. Update tool count assertions in existing tests
6. Version bump to v0.4.0-alpha.1
7. Commit all changes

## Expected End State

| Metric | Before | After |
|--------|--------|-------|
| Built-in Tools | 14 | 26 (+12) |
| Test Files | 25 | ~35 (+10) |
| Tests | 195 | ~280+ |
| Source Files | 33 | ~42 (+9) |
| Agent Depth Score | 45 | 80 |
| Composite Score | 73 | 86 |
