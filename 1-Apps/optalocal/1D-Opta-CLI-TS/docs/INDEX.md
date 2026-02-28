---
title: Documentation Index
purpose: Read order for AI agents
updated: 2026-02-28
version: 0.5.0-alpha.1
---

# Opta CLI — Documentation Read Order

**This document tells AI agents what to read, and in what order.**

When you (Claude Code, a bot, or a human developer) start working on Opta CLI, follow this read order. Each file builds on the previous.

---

## Level 1: Understand the Vision (10 min)

Start here. These files explain **why** this project exists and **what** it does.

1. **`APP.md`** (this repo root)
   - What problem does Opta CLI solve?
   - Who is the audience? (Matthew + AI agents)
   - What's the relationship to Opta-LMX, OptaPlus, OpenClaw?
   - V1 scope vs V2+ roadmap

2. **`README.md`** (this repo root)
   - Quick-start usage
   - File structure overview
   - Feature list

**Time:** ~10 minutes | **Why:** Can't code a feature without understanding the problem.

---

## Level 2: Understand the Design (20 min)

Now read the specification and settled decisions.

3. **`docs/plans/archive/2026-02-12-opta-cli-v1-design.md`**
   - Full technical specification (10,000 words)
   - Agent loop pseudocode
   - Command structure
   - Tool system (8 tools, permission model)
   - Config schema
   - UI/UX layout
   - Session storage
   - Competitive research summary

4. **`docs/DECISIONS.md`**
   - Why daemon-first Level 3 architecture?
   - Why HTTP + WS + SSE fallback?
   - Why Fastify?
   - Why strict command compatibility?
   - Why adaptive token batching?

5. **`docs/plans/archive/2026-02-20-level3-daemon-program-plan.md`**
   - Level 3 daemon architecture (HTTP + WS + SSE fallback)
   - Multi-writer session semantics
   - Adaptive token batching strategy targeting 60 FPS
   - P0 markdown renderer reliability fix
   - Effort estimates + dependency graph

6. **`docs/GUARDRAILS.md`**
   - Non-negotiable safety rules
   - Tool permission defaults
   - ESM-only module format
   - Never expose gateway tokens in logs

**Time:** ~20 minutes | **Why:** Design decisions affect every line of code you write.

---

## Level 3: Understand the Code (35 min)

Now understand the actual implementation.

7. **`CLAUDE.md`** (this repo root) — REPLACED with OPIS-quality version
   - File structure (32 TypeScript files mapped)
   - Module responsibilities (what each file does)
   - Code patterns (lazy loading, agent loop, permission resolution)
   - Testing strategy
   - Common tasks (add a command, add a tool, debug)
   - Build commands

8. **`docs/ECOSYSTEM.md`**
   - How Opta CLI relates to other Opta components
   - Data flow: CLI → Opta-LMX → response
   - Who calls what
   - Dependency relationships

9. **`docs/KNOWLEDGE.md`**
   - External resources (Opta-LMX API, OpenAI function calling)
   - Research documents already in `docs/research/`
   - Where to find AIALL skills
   - When to search the landscape research

10. **`docs/runbooks/trigger-modes-and-skill-stacking.md`**

- Current trigger-word highlighting behavior in TUI input
- How workflow modes are actually activated (`/plan`, `/review`, `/research`, Shift+Tab)
- Browser command workflow vs workflow modes
- Recommended architecture for stacking trigger words and dynamic skill loading

**Time:** ~35 minutes | **Why:** You need to know which file to edit and how it connects.

---

## Level 4: Understand the Roadmap (5 min)

Last, see the long-term vision.

11. **`docs/ROADMAP.md`**
    - v0.5.0-alpha.1 current state (what shipped)
    - 4-phase finish sequence to v1.0 (Stability Lock → Runtime Confidence → Release Readiness → Documentation Lock)
    - v1.0 release criteria checklist
    - Deferred post-v1.0 items

12. **`docs/OPERATOR-RUNBOOK.md`** *(new — 2026-02-28)*
    - Daemon start/stop/restart/status lifecycle
    - Authentication (token from state.json)
    - Monitoring: metrics, log tail, session list
    - Common failure modes and recovery steps
    - Session operations via HTTP API
    - Startup verification checklist

13. **`docs/COMMAND-MATRIX.md`** *(new — 2026-02-28)*
    - Status-coded matrix for all commands (✅/⚠️/🔧/❌)
    - Post-install smoke test sequence
    - Platform availability (macOS/Linux/Windows)

14. **`docs/RELEASE-RUNBOOK.md`**
    - Release gate checklist
    - npm + GitHub artifact publishing flow
    - Opta Init download-link naming contract
    - Clean-machine install validation steps

15. **`docs/FEATURE-AUDIT-CHECKLIST.md`**
    - Full feature-by-feature verification gate
    - Required automated + manual audit coverage
    - Release blocking sign-off list

16. **`docs/AUDIT-INTEROP-2026-02-28.md`**
    - Cross-app and bot interoperability audit
    - Contract mismatches and release blockers
    - Required interop fixes before upload

17. **`docs/DAEMON-INTEROP-CONTRACT.md`**
    - Canonical daemon v3 consumer contract for apps and bots
    - HTTP/WS auth model, envelope schema, and reconnect semantics
    - LMX compatibility bridge routes and payload requirements

16. **`docs/plans/2026-02-28-plan-state-matrix.md`**
    - Canonical plan-state matrix for all CLI plan docs
    - Reconciles ACTIVE/REVIEW/COMPLETED/ARCHIVED conflicts
    - Replaces stale generated plan-state artifacts when they disagree

18. **`docs/plans/2026-02-28-browser-full-autonomy-upgrade-design.md`**
    - MCP-backed browser full-autonomy upgrade architecture
    - BrowserMcpInterceptor safety pipeline design
    - Sub-agent delegation model for autonomous browser goals

**Time:** ~5 minutes | **Why:** Know what's out of scope to avoid rabbit holes.

---

## When to Return to Each Document

### Actively Developing a Feature

1. **Design Doc** — Reread the section for the feature you're building
2. **CLAUDE.md** — Find the file(s) you need to edit
3. **Design Doc again** — Check error handling and edge cases
4. **GUARDRAILS.md** — Check safety rules for your feature
5. **Code** — Implement

### Debugging an Issue

1. **DECISIONS.md** — Why was this designed this way?
2. **Design Doc** (relevant section) — What should happen?
3. **CLAUDE.md** (relevant module) — How does it work?
4. **Code** — Trace the actual execution

### Adding a New Command

1. **Design Doc** → Commands section — Is it in scope?
2. **CLAUDE.md** → File structure — Where does it go?
3. **CLAUDE.md** → Common Tasks → "Add a New Command"
4. **Code** → Look at similar command for patterns

### Adding a New Tool

1. **Design Doc** → Tool System section — Check the 8 tools
2. **GUARDRAILS.md** — Permission rules for this tool
3. **CLAUDE.md** → Common Tasks → "Add a New Tool"
4. **Code** → `src/core/tools.ts`

---

## Reference Cards (Quick Lookup)

### Files You'll Edit Most Often

| File                 | Purpose          | When                                |
| -------------------- | ---------------- | ----------------------------------- |
| `src/commands/*.ts`  | CLI subcommands  | Adding a new command                |
| `src/core/agent.ts`  | Agent loop       | Changing loop behavior              |
| `src/core/tools.ts`  | Tool definitions | Adding a tool, changing permissions |
| `src/core/config.ts` | Config schema    | Adding a config option              |
| `tests/**/*.test.ts` | Test cases       | Writing or debugging                |

### Files You'll Read Often

| File                                          | Content          | When                      |
| --------------------------------------------- | ---------------- | ------------------------- |
| `docs/plans/2026-02-12-opta-cli-v1-design.md` | Full spec        | Every major feature       |
| `CLAUDE.md`                                   | Module map       | File navigation           |
| `docs/DECISIONS.md`                           | Design rationale | Understanding constraints |
| `docs/GUARDRAILS.md`                          | Safety rules     | Tool-using code           |

### Files You'll Rarely Edit

| File                    | Purpose                      |
| ----------------------- | ---------------------------- |
| `src/index.ts`          | Entry point (stable)         |
| `src/providers/base.ts` | Provider interface (stable)  |
| `src/memory/store.ts`   | Session storage (stable)     |
| `src/ui/*.ts`           | Terminal UI helpers (stable) |

---

## Checklists

### Before Starting Any Feature

- [ ] Read APP.md (vision)
- [ ] Read relevant section of design doc
- [ ] Read DECISIONS.md (constraints)
- [ ] Read GUARDRAILS.md (safety)
- [ ] Read CLAUDE.md file map (where to edit)
- [ ] Read this INDEX.md again for checklists

### Before Submitting a PR

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Tests added for new code
- [ ] CLAUDE.md updated if architecture changed
- [ ] docs/DECISIONS.md updated if new design decisions
- [ ] Commit message references design doc section

### For AI Code Generation

If you (Claude Code or an AI agent) are generating code:

1. **Context:** Read APP.md + design doc section + CLAUDE.md file you're editing
2. **Constraints:** Read GUARDRAILS.md + DECISIONS.md
3. **Examples:** Look at similar files in src/ for patterns
4. **Tests:** Generate tests alongside code
5. **Validation:** Read the generated code and ask "Is this safe? Does it follow patterns?"

---

## Document Statistics

| Document                | Lines | Read Time | Purpose                        |
| ----------------------- | ----- | --------- | ------------------------------ |
| APP.md                  | 250   | 15 min    | Vision + scope                 |
| README.md               | 375   | 10 min    | Quick start + feature overview |
| CLAUDE.md               | 400   | 20 min    | Architecture + module map      |
| DECISIONS.md            | 150   | 10 min    | Rationale                      |
| GUARDRAILS.md           | 120   | 10 min    | Safety rules                   |
| ECOSYSTEM.md            | 260   | 12 min    | Component relationships        |
| KNOWLEDGE.md            | 80    | 5 min     | External resources             |
| ROADMAP.md              | 120   | 8 min     | v0.5 state + path to v1.0      |
| OPERATOR-RUNBOOK.md     | 348   | 15 min    | Daemon operations              |
| COMMAND-MATRIX.md       | 258   | 10 min    | Known-good command reference   |
| DAEMON-INTEROP-CONTRACT | 200   | 10 min    | HTTP/WS protocol contracts     |

**Total: ~125 minutes to read everything. Worth it.**

---

## Questions?

If something is unclear:

1. Search the design doc for keywords
2. Check DECISIONS.md for "why" questions
3. Check GUARDRAILS.md for "should we" questions
4. Look at similar code in src/ for patterns
5. Ask Matthew directly if still stuck

**Never guess. The answer is in the docs or in the code.**

---

## Keep This Index Current

- When adding a new docs file, add it to this index
- When renaming a section of the design doc, update the link above
- When deprecating a document, mark it with ⚠️ DEPRECATED
- Keep the read time estimates accurate

**Rule:** This file is the single source of truth for documentation order. Everything else flows from it.
