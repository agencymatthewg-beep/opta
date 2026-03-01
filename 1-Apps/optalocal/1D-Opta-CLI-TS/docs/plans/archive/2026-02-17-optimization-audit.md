---
status: archived
---

# Opta CLI — Optimization Audit & Action Plan

> **Date:** 2026-02-17
> **Sources:** 4 parallel review agents (deep code review, CLI best practices, inefficiency analysis, TypeScript audit)
> **Scope:** All 62 source files, ~60K LOC
>
> **Status (verified 2026-02-27):** 46 of 50 items DONE. 4 items PARTIAL. See closure notes below.
>
> **Closure Summary:**
> - **S1 (path traversal):** DONE — `assertWithinCwd()` in tools/executors.ts
> - **S2 (env leak):** DONE — ALLOWED_ENV_KEYS allowlist in hooks/manager.ts + tools/custom.ts
> - **B1 (SIGINT cleanup):** DONE — cleanup() with 3s grace + forceKillAllProcesses()
> - **B2 (process.exit in agent):** DONE — throws OptaError, no process.exit() in agent.ts
> - **B3 (sub-agent timeout):** DONE — AbortController threaded to client.chat.completions.create()
> - **B4 (ProcessManager singleton):** DONE — sub-agents skip initProcessManager
> - **B5-B7:** DONE — CI non-interactive break, single permission defaults source, config set Zod validation
> - **T1-T6:** 4 DONE, 2 PARTIAL — unsafe JSON.parse casts remain in store.ts + daemon/client.ts; DEFAULT_PERMISSIONS still Record<string,string>
> - **D1-D6:** 5 DONE, 1 PARTIAL — "No model" error unified in agent path but not in chat.ts/do.ts/server.ts
> - **A1-A6, P1-P4:** All DONE — slash command decomposed, tools.ts split, agent profiles wired, shell completions, --help examples, config --json, FORCE_COLOR
> - **Dead code:** All removed

---

## Consolidated Scorecard

| Category | Score | Source |
|----------|-------|--------|
| Startup Performance | A | CLI Audit |
| Command UX | B+ | CLI Audit |
| Shell Completions | C+ | CLI Audit |
| Interactive vs Non-Interactive | A- | CLI Audit |
| Configuration | A | CLI Audit |
| Output Handling | B+ | CLI Audit |
| Type Safety | 72/100 | TS Audit |
| ESM Compliance | 78/100 | TS Audit |
| Modern TS Patterns | 75/100 | TS Audit |
| Error Types | 82/100 | TS Audit |
| Build & Config | 80/100 | TS Audit |

**Overall: B+ (solid foundation, security + consistency gaps from parallel agent construction)**

---

## Priority 1: Security (Fix Immediately)

### S1. Path Traversal — No Sandbox in File Tools
- **File:** `src/core/tools.ts` lines 619, 634, 646, 667, 887
- **Problem:** `resolve(String(args['path']))` with no bounds check. Model can read/write any file on disk.
- **Fix:** Add `assertWithinCwd()` guard before every file operation.

### S2. Hook + Custom Tool Commands Leak Full process.env
- **Files:** `src/hooks/manager.ts:152`, `src/tools/custom.ts:95`
- **Problem:** `...process.env` spreads ALL env vars (API keys, secrets) to user shell scripts. Malicious `.opta/config.json` or `.opta/tools/*.json` in a repo can exfiltrate credentials.
- **Fix:** Use allowlist: `PATH`, `HOME`, `USER`, `SHELL`, `TERM`, `LANG` + `OPTA_*` vars only.

---

## Priority 2: Critical Bugs (Fix This Sprint)

### B1. SIGINT Bypasses All Cleanup
- **Files:** `src/index.ts:11-21`, `src/core/agent.ts:622-632`, `src/commands/server.ts:187`
- **Problem:** SIGINT handler calls `process.exit(130)` before `registry.close()`, `fireSessionEnd()`, and `shutdownProcessManager()`. Leaves MCP servers and bg processes as zombies. Server.ts registers a conflicting second handler.
- **Fix:** Use shared cleanup registry drained by both SIGINT and normal exit.

### B2. `process.exit()` Inside Agent Loop Bypasses Cleanup
- **File:** `src/core/agent.ts:323-331`
- **Problem:** `process.exit(3)` when no model configured skips all cleanup.
- **Fix:** Throw `OptaError` instead, let callers handle exit.

### B3. Sub-Agent Timeout Doesn't Cancel Inflight LLM Request
- **File:** `src/core/subagent.ts:353-387`
- **Problem:** `Promise.race` timeout settles the outer promise but the inner `runLoop()` keeps executing — consuming GPU time and potentially mutating filesystem after parent receives "timed out."
- **Fix:** Thread `AbortController.signal` through OpenAI client call.

### B4. ProcessManager Singleton Shared Across Sub-Agents
- **File:** `src/core/tools.ts:377-378, 985-1012`
- **Problem:** `initProcessManager()` runs unconditionally, replacing parent's process manager when sub-agent starts. Parent's bg processes become unreachable.
- **Fix:** Skip `initProcessManager` for sub-agents.

### B5. CI Mode Can Hang at Circuit Breaker Confirm
- **Files:** `src/core/agent.ts:588-591`, `src/commands/do.ts:102`
- **Problem:** `confirm()` prompt runs when `!silent`, but `silent` isn't derived from `isCI`. In CI without `--format json`, the loop hangs forever.
- **Fix:** Set `silent = true` when `isCI`.

### B6. Dual Permission Defaults Already Drifting
- **Files:** `src/core/config.ts:42-66`, `src/core/tools.ts:493-520`
- **Problem:** Two independent sources of truth for default permissions. They already differ (`read_project_docs`, `spawn_agent`, `delegate_task` in tools.ts but not config.ts).
- **Fix:** Single canonical source in config.ts; tools.ts imports from config.

### B7. `config set` Bypasses Zod Validation
- **File:** `src/commands/config.ts:92`
- **Problem:** Writes directly to store without validating through `OptaConfigSchema.parse()`.
- **Fix:** Parse merged config through Zod before saving.

---

## Priority 3: Type Safety & ESM (Fix Soon)

### T1. `createRequire()` in ESM — CLAUDE.md Violation
- **File:** `src/core/version.ts:2`
- **Problem:** Violates "No `require()` or `module.exports`" rule.
- **Fix:** Use `readFileSync` + `JSON.parse` with `import.meta.url`.

### T2. Unsafe `as` Casts on JSON.parse Boundaries
- **Files:** `src/memory/store.ts:65,89`, `src/lmx/client.ts:144`
- **Problem:** `JSON.parse(data) as Session` and `response.json() as Promise<T>` — no runtime validation.
- **Fix:** Parse through Zod schemas (infrastructure already exists).

### T3. `process.env as Record<string, string>` Drops Undefineds
- **File:** `src/hooks/manager.ts:153`
- **Problem:** Undefined env vars become string `"undefined"` in child process.
- **Fix:** Filter with type guard: `Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined)`.

### T4. `DEFAULT_TOOL_PERMISSIONS` Typed Too Loosely
- **File:** `src/core/tools.ts:493`
- **Problem:** `Record<string, string>` instead of `Record<string, 'allow' | 'ask' | 'deny'>`. Forces unsafe `as` cast on return.
- **Fix:** Use literal union type.

### T5. ESLint Missing `strict-type-checked` Rules
- **File:** `eslint.config.js`
- **Problem:** Only `recommended` rules. Doesn't catch `no-explicit-any`, `no-unsafe-assignment`, etc.
- **Fix:** Upgrade to `tseslint.configs['strict-type-checked']`.

### T6. `marked.parse() as string` — Potential Promise
- **File:** `src/ui/markdown.ts:58`
- **Problem:** Could return `Promise<string>` with async extensions.
- **Fix:** Use `{ async: false }` option or `marked.parseInline()`.

---

## Priority 4: Deduplication (Parallel Agent Seams)

### D1. Token Estimation — 8 Implementations
- **Locations:** agent.ts (2x), subagent.ts, registry.ts, thinking.ts (3x), chat.ts
- **Fix:** Single `estimateTokens()` in a `src/utils/tokens.ts` module.

### D2. Token Formatting — 4 Implementations
- **Locations:** box.ts, statusbar.ts, Sidebar.tsx, StatusBar.tsx
- **Fix:** Single `formatTokens()` in `src/utils/tokens.ts`.

### D3. Dual Model Metadata Systems
- **Files:** `src/core/models.ts` (regex matching), `src/lmx/client.ts` (substring matching)
- **Fix:** Single `MODEL_PROFILES` source of truth.

### D4. Config Override Construction — 2 Copies
- **Files:** `src/commands/chat.ts:48-72`, `src/commands/do.ts:85-100`
- **Fix:** Extract `buildConfigOverrides(opts)` utility.

### D5. "No Model Configured" Error — 4 Locations
- **Files:** chat.ts, do.ts, server.ts, agent.ts
- **Fix:** Single `ensureModel()` function returning model or throwing `OptaError`.

### D6. JSON Argument Parsing — 6 Repetitions
- **Fix:** Single `parseToolArgs(raw: string): Record<string, unknown>` utility.

---

## Priority 5: Architecture Cleanup

### A1. `handleSlashCommand` — 661 Lines
- **File:** `src/commands/chat.ts:296-957`
- **Fix:** Extract command handlers into `src/commands/slash/*.ts` modules with a registry pattern.

### A2. `tools.ts` — 1088 Lines Mixing 4 Concerns
- **File:** `src/core/tools.ts`
- **Fix:** Split into `tools/schemas.ts`, `tools/permissions.ts`, `tools/executors.ts`, `tools/background.ts`.

### A3. Agent Profiles — Non-Functional Dead Code
- **Files:** `src/core/agent-profiles.ts`, `src/commands/chat.ts:880-930`
- **Fix:** Either wire into agent loop (filter tool schemas by profile) or remove entirely.

### A4. `fireError` Imported But Never Called
- **File:** `src/core/agent.ts:20`
- **Fix:** Wire `fireError()` into try/catch blocks in agent loop, or remove import.

### A5. LSP Client Buffer Growth Unbounded
- **File:** `src/lsp/client.ts:307-338`
- **Fix:** Add MAX_BUFFER_SIZE guard (64MB), reject pending on overflow.

### A6. OpenAI Client Created Per agentLoop Call
- **File:** `src/core/agent.ts:316-319`
- **Fix:** Create once at session start, pass as dependency.

---

## Priority 6: CLI Polish

### P1. Shell Completions — Missing Commands & Flags
- **File:** `src/commands/completions.ts`
- **Missing commands:** `init`, `diff`, `server`
- **Missing flags:** `--format`, `--no-commit`, `--no-checkpoints`, `--auto`, `--dangerous`, `--yolo`, `--tui` on chat; `mcp add/remove/test` subcommands
- **Fix:** Regenerate all 3 completion scripts (bash/zsh/fish).

### P2. No `--help` Examples on Any Command
- **Fix:** Add `.addHelpText('after', ...)` with usage examples to all commands in index.ts.

### P3. `config list` Missing `--json` Flag
- **Fix:** Add `--json` option consistent with `status`, `models`, `sessions`.

### P4. `FORCE_COLOR` Not Handled
- **File:** `src/ui/output.ts:4`
- **Fix:** Check `process.env.FORCE_COLOR` to override `isCI` for non-color behaviors.

---

## Priority 7: Dead Code Removal

| Item | File | Lines |
|------|------|-------|
| `die()` function | `src/core/errors.ts:42-44` | ~3 |
| `renderMarkdown` import | `src/core/agent.ts:7` | 1 |
| `void config` | `src/core/agent.ts:132` | 1 |
| InputEditor (13 unused methods) | `src/ui/input.ts` | ~100 |
| `skills/loader.ts` empty stub | `src/skills/loader.ts` | ~2 |
| Unused ModelProfile fields | `src/core/models.ts` | ~10 |
| `init.ts` misleading stub | `src/commands/init.ts` | 6 |

---

## Execution Strategy

| Phase | Items | Est. Time | Risk |
|-------|-------|-----------|------|
| 1. Security | S1, S2 | 1h | High — these are exploitable |
| 2. Critical Bugs | B1-B7 | 3h | High — data loss, hangs |
| 3. Type Safety | T1-T6 | 2h | Medium — prevents future bugs |
| 4. Deduplication | D1-D6 | 2h | Medium — maintenance debt |
| 5. Architecture | A1-A6 | 4h | Low — readability, not correctness |
| 6. CLI Polish | P1-P4 | 1.5h | Low — UX improvement |
| 7. Dead Code | All | 30m | Low — cleanup |

**Total: ~14h of optimization work across 7 phases.**
