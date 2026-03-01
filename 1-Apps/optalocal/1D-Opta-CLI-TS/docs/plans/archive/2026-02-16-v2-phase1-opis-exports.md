---
status: archived
---

# V2 Phase 1: OPIS Integration + Export Map — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OPIS-aware context injection and export map scanning to the system prompt, replacing `.opta/memory.md` with structured project understanding.

**Architecture:** Two new modules (`src/context/opis.ts`, `src/context/exports.ts`) load project docs and scan source exports at session start. The system prompt in `agent.ts:buildSystemPrompt()` now includes a compressed OPIS summary (~500t) + export map (~500-1000t). A new `read_project_docs` tool (#9) lets the model deep-dive into specific docs on demand.

**Tech Stack:** Node.js fs/promises, fast-glob (already in deps), vitest for tests, zod validation on config

---

### Task 1: Create OPIS Context Loader

**Files:**
- Create: `src/context/opis.ts`
- Test: `tests/context/opis.test.ts`

**Step 1: Write the failing tests**

Create `tests/context/opis.test.ts` with tests for:
- `loadOpisContext` returns `hasOpis=true` when `APP.md` exists (with frontmatter parsed)
- `loadOpisContext` returns `hasOpis=false` when no `APP.md`
- Falls back to `.opta/memory.md` when no OPIS scaffold
- Falls back to `CLAUDE.md` when no OPIS and no `memory.md`
- Handles `APP.md` without frontmatter gracefully
- `readProjectDoc` reads from `docs/` directory
- `readProjectDoc` reads `APP.md` from project root
- `readProjectDoc` returns helpful message when file not found (mentions `opta init`)

Use temp directory pattern from existing tests (`tmpdir()` + `beforeEach`/`afterEach`).

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/context/opis.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/context/opis.ts` with:
- `OpisContext` interface: `{ summary: string; hasOpis: boolean; docsDir: string; fallbackMemory?: string }`
- `loadOpisContext(cwd)` — reads `APP.md`, parses frontmatter, extracts guardrails + decisions, builds summary
- `readProjectDoc(cwd, file)` — reads OPIS doc from `docs/` or root, with whitelist check
- Helper: `parseFrontmatter()` — splits YAML frontmatter from body
- Helper: `extractGuardrails()` — finds `G-XX` rules in `GUARDRAILS.md`
- Helper: `extractRecentDecisions()` — finds last 5 `D-XX` entries
- Fallback chain: `APP.md` > `.opta/memory.md` > `CLAUDE.md` > no context

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/context/opis.test.ts`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add src/context/opis.ts tests/context/opis.test.ts
git commit -m "feat(v2): add OPIS context loader with fallback chain"
```

---

### Task 2: Create Export Map Scanner

**Files:**
- Create: `src/context/exports.ts`
- Test: `tests/context/exports.test.ts`

**Step 1: Write the failing tests**

Create `tests/context/exports.test.ts` with tests for:
- Finds TypeScript exports (function, class, const, type, interface, enum, async function)
- Finds Python definitions (class, def, async def, top-level UPPER_CASE assignments)
- Finds Swift declarations (func, class, struct, enum, protocol)
- Skips test files (`.test.ts`, `.spec.ts`, `__tests__/`)
- Skips `node_modules` and `dist`
- Truncates at 100 files (sets `truncated=true`, preserves `fileCount`)
- Returns empty for no source files
- `formatExportMap` produces `path: symbol1, symbol2` format
- `formatExportMap` shows truncation notice

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/context/exports.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/context/exports.ts` with:
- `ExportEntry` interface: `{ path: string; exports: string[] }`
- `ExportMap` interface: `{ entries: ExportEntry[]; truncated: boolean; fileCount: number }`
- Language patterns: regex arrays for TS/JS, Python, Swift
- `scanExports(cwd)` — uses `fast-glob` to find source files, applies language-specific regex, caps at 100 files
- `formatExportMap(map)` — formats as `path: export1, export2` lines
- File filtering: respects ignore list (node_modules, dist, .git, etc.), skips test files

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/context/exports.test.ts`
Expected: All 9 tests PASS

**Step 5: Commit**

```bash
git add src/context/exports.ts tests/context/exports.test.ts
git commit -m "feat(v2): add export map scanner for repo awareness"
```

---

### Task 3: Add `read_project_docs` Tool

**Files:**
- Modify: `src/core/tools.ts` (add schema + executor)
- Modify: `tests/core/tools.test.ts` (update count, add tests)

**Step 1: Add failing tests**

Update `tests/core/tools.test.ts`:
- Change "defines exactly 8 tools" to "defines exactly 9 tools" with `toHaveLength(9)`
- Add test: `read_project_docs` is in tool names
- Add test: reads OPIS docs from `docs/` directory (uses temp dir + `process.chdir`)
- Add test: returns helpful message for missing docs

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/core/tools.test.ts`
Expected: FAIL — tool count is 8, read_project_docs not found

**Step 3: Add tool schema and executor**

In `src/core/tools.ts`:
- Add `read_project_docs` schema to `TOOL_SCHEMAS` array (after `ask_user`)
- Add `case 'read_project_docs':` to `executeTool` switch
- Add `execReadProjectDocs` function that lazy-imports `readProjectDoc` from `../context/opis.js`

**Step 4: Run tests**

Run: `npm test -- tests/core/tools.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/tools.ts tests/core/tools.test.ts
git commit -m "feat(v2): add read_project_docs tool (#9)"
```

---

### Task 4: Wire OPIS + Export Map into System Prompt

**Files:**
- Modify: `src/core/agent.ts` (enhance `buildSystemPrompt()`)
- Create: `tests/core/agent.test.ts`

**Step 1: Write the failing tests**

Create `tests/core/agent.test.ts` with tests for `buildSystemPrompt`:
- Includes base instructions (Opta, coding, working directory)
- Includes OPIS summary when `APP.md` exists
- Includes export map when source files exist
- Includes fallback memory when no OPIS
- Suggests `opta init` when no context available

All tests use temp directories with `APP.md`, `docs/`, and `src/` files.

**Key change:** `buildSystemPrompt` gets a new optional `cwd` parameter (defaults to `process.cwd()`).

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/core/agent.test.ts`
Expected: FAIL — `buildSystemPrompt` doesn't accept `cwd` parameter

**Step 3: Modify `buildSystemPrompt()`**

In `src/core/agent.ts`:
- Add `cwd?: string` parameter (defaults to `process.cwd()`)
- Remove old `.opta/memory.md` loading block
- Add OPIS context loading via `loadOpisContext(workingDir)`
- Add export map loading via `scanExports(workingDir)` + `formatExportMap()`
- Both are wrapped in try/catch (never block the session)
- Fallback logic: OPIS summary > fallbackMemory > "run opta init" tip

**Step 4: Run all tests**

Run: `npm test`
Expected: All tests PASS (existing callers of `buildSystemPrompt(config)` still work since `cwd` is optional)

**Step 5: Commit**

```bash
git add src/core/agent.ts tests/core/agent.test.ts
git commit -m "feat(v2): wire OPIS context + export map into system prompt"
```

---

### Task 5: Update Config Schema for Git Settings

**Files:**
- Modify: `src/core/config.ts`
- Modify: `tests/core/config.test.ts`

**Step 1: Add failing tests**

Add to `tests/core/config.test.ts`:
- `DEFAULT_CONFIG.git.autoCommit` is `true`
- `DEFAULT_CONFIG.git.checkpoints` is `true`
- Validates partial git config (e.g. `{ git: { autoCommit: false } }`)

**Step 2: Run tests — FAIL**

**Step 3: Add git object to `OptaConfigSchema`**

```typescript
git: z
  .object({
    autoCommit: z.boolean().default(true),
    checkpoints: z.boolean().default(true),
  })
  .default({}),
```

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add src/core/config.ts tests/core/config.test.ts
git commit -m "feat(v2): add git config schema (autoCommit, checkpoints)"
```

---

### Task 6: Register `init` + `diff` Command Stubs

**Files:**
- Create: `src/commands/init.ts` (stub)
- Create: `src/commands/diff.ts` (stub)
- Modify: `src/index.ts`
- Modify: `tests/cli.test.ts`

**Step 1: Create stub commands**

`src/commands/init.ts` — prints "coming in V2 Phase 4" message
`src/commands/diff.ts` — prints "coming in V2 Phase 2" message

**Step 2: Register in `src/index.ts`**

Add `init` command with `--mode` and `--force` options.
Add `diff` command with `--session` option.

**Step 3: Update CLI integration test**

In `tests/cli.test.ts`, add `'init'` and `'diff'` to the expected commands list.

**Step 4: Run tests — PASS**

**Step 5: Commit**

```bash
git add src/commands/init.ts src/commands/diff.ts src/index.ts tests/cli.test.ts
git commit -m "feat(v2): register init + diff commands (Phase 2/4 stubs)"
```

---

### Task 7: Run Full Suite + Typecheck

**Step 1: Typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Full test suite**

Run: `npm test`
Expected: All tests PASS (~90+ tests)

**Step 3: Version bump commit**

Update `package.json` version to `0.2.0-alpha.1`.

```bash
git add package.json
git commit -m "chore: V2 Phase 1 complete — OPIS + export map"
```

---

## Summary

| Task | New Files | Modified Files | Tests Added |
|------|-----------|----------------|-------------|
| 1. OPIS Context Loader | `src/context/opis.ts` | — | ~8 |
| 2. Export Map Scanner | `src/context/exports.ts` | — | ~9 |
| 3. read_project_docs Tool | — | `src/core/tools.ts` | ~2 |
| 4. System Prompt Wiring | — | `src/core/agent.ts` | ~5 |
| 5. Git Config Schema | — | `src/core/config.ts` | ~2 |
| 6. CLI Command Stubs | `src/commands/init.ts`, `src/commands/diff.ts` | `src/index.ts`, `tests/cli.test.ts` | 0 |
| 7. Final Validation | — | `package.json` | 0 |
| **Total** | **4 new** | **6 modified** | **~26 new** |
