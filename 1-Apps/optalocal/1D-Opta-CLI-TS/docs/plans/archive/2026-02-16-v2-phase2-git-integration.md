---
status: completed
---

# V2 Phase 2: Git Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic git checkpoint snapshots during the agent loop, a clean commit when tasks complete, `/undo` mid-task rollback, and an `opta diff` command showing session changes.

**Architecture:** Two new modules (`src/git/checkpoints.ts`, `src/git/commit.ts`) handle patch creation and auto-commit. The agent loop in `agent.ts` calls `createCheckpoint()` after each `edit_file`/`write_file` tool execution. Chat's REPL handles `/undo`. The existing `diff.ts` stub gets a real implementation. All git features gracefully skip in non-git directories.

**Tech Stack:** Node.js fs/promises, execa (already in deps), vitest for tests. No new dependencies.

---

### Task 1: Create Git Utilities Module

**Files:**
- Create: `src/git/utils.ts`
- Test: `tests/git/utils.test.ts`

**Step 1: Write the failing tests**

Create `tests/git/utils.test.ts` with tests for:
- `isGitRepo(cwd)` returns `true` inside a git repo
- `isGitRepo(cwd)` returns `false` for a non-repo temp directory
- `getModifiedFiles(cwd)` returns list of changed files
- `getModifiedFiles(cwd)` returns empty array for clean repo
- `gitDiff(cwd, file)` returns diff output for a modified file
- `gitDiff(cwd, file)` returns empty string for unmodified file
- `isDirty(cwd)` returns `true` when working tree has changes
- `isDirty(cwd)` returns `false` for clean working tree

Use temp directory pattern. Each test should use `execa` to `git init` + `git add` + `git commit` to create a real (throwaway) git repo.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { isGitRepo, getModifiedFiles, gitDiff, isDirty } from '../../src/git/utils.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-git-test-'));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

async function gitInit(dir: string) {
  await execa('git', ['init'], { cwd: dir });
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  await execa('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

async function gitCommitAll(dir: string, msg: string) {
  await execa('git', ['add', '-A'], { cwd: dir });
  await execa('git', ['commit', '-m', msg], { cwd: dir });
}
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/git/utils.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/git/utils.ts` with:

```typescript
import { execa } from 'execa';

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const result = await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd, reject: false });
    return result.stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export async function isDirty(cwd: string): Promise<boolean> {
  const result = await execa('git', ['status', '--porcelain'], { cwd, reject: false });
  return result.stdout.trim().length > 0;
}

export async function getModifiedFiles(cwd: string): Promise<string[]> {
  const result = await execa('git', ['diff', '--name-only'], { cwd, reject: false });
  const staged = await execa('git', ['diff', '--name-only', '--cached'], { cwd, reject: false });
  const files = new Set<string>();
  for (const line of result.stdout.split('\n').concat(staged.stdout.split('\n'))) {
    if (line.trim()) files.add(line.trim());
  }
  return [...files];
}

export async function gitDiff(cwd: string, file?: string): Promise<string> {
  const args = ['diff'];
  if (file) args.push('--', file);
  const result = await execa('git', args, { cwd, reject: false });
  return result.stdout;
}
```

Note: Uses `execa` (already in deps) with array arguments — no shell injection risk. All git commands use `reject: false` for safe error handling.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/git/utils.test.ts`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add src/git/utils.ts tests/git/utils.test.ts
git commit -m "feat(git): add git utility functions (isGitRepo, isDirty, getModifiedFiles, gitDiff)"
```

---

### Task 2: Create Checkpoint System

**Files:**
- Create: `src/git/checkpoints.ts`
- Test: `tests/git/checkpoints.test.ts`

**Step 1: Write the failing tests**

Create `tests/git/checkpoints.test.ts` with tests for:
- `createCheckpoint` saves a patch file at `.opta/checkpoints/<session>/<n>.patch`
- `createCheckpoint` creates an index.json with metadata (tool, path, timestamp)
- `createCheckpoint` appends to existing index.json
- `listCheckpoints` returns all checkpoints for a session in order
- `listCheckpoints` returns empty array for unknown session
- `undoCheckpoint` applies patch in reverse (restores file)
- `undoCheckpoint` without `n` undoes the last checkpoint
- `undoCheckpoint` with specific `n` undoes that checkpoint
- `cleanupCheckpoints` removes the session's checkpoint directory
- `cleanupCheckpoints` is a no-op for unknown session

Use a real git repo in temp directory. Create files, modify them, then use the checkpoint functions.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/git/checkpoints.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/git/checkpoints.ts`:

```typescript
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import { gitDiff } from './utils.js';

export interface Checkpoint {
  n: number;
  tool: string;
  path: string;
  timestamp: string;
}

interface CheckpointIndex {
  session: string;
  checkpoints: Checkpoint[];
}

function checkpointDir(cwd: string, sessionId: string): string {
  return join(cwd, '.opta', 'checkpoints', sessionId);
}

export async function createCheckpoint(
  cwd: string, sessionId: string, n: number, tool: string, filePath: string
): Promise<void> {
  const dir = checkpointDir(cwd, sessionId);
  await mkdir(dir, { recursive: true });

  // Save the diff as a patch
  const diff = await gitDiff(cwd, filePath);
  if (!diff) return; // No changes to checkpoint

  await writeFile(join(dir, `${n}.patch`), diff, 'utf-8');

  // Update index
  const indexPath = join(dir, 'index.json');
  let index: CheckpointIndex;
  try {
    index = JSON.parse(await readFile(indexPath, 'utf-8'));
  } catch {
    index = { session: sessionId, checkpoints: [] };
  }

  index.checkpoints.push({
    n,
    tool,
    path: filePath,
    timestamp: new Date().toISOString(),
  });

  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

export async function listCheckpoints(
  cwd: string, sessionId: string
): Promise<Checkpoint[]> {
  const indexPath = join(checkpointDir(cwd, sessionId), 'index.json');
  try {
    const index: CheckpointIndex = JSON.parse(await readFile(indexPath, 'utf-8'));
    return index.checkpoints;
  } catch {
    return [];
  }
}

export async function undoCheckpoint(
  cwd: string, sessionId: string, n?: number
): Promise<{ undone: string; path: string } | null> {
  const checkpoints = await listCheckpoints(cwd, sessionId);
  if (checkpoints.length === 0) return null;

  const target = n !== undefined
    ? checkpoints.find(c => c.n === n)
    : checkpoints[checkpoints.length - 1];

  if (!target) return null;

  const patchPath = join(checkpointDir(cwd, sessionId), `${target.n}.patch`);
  await execa('git', ['apply', '-R', patchPath], { cwd });

  return { undone: `Checkpoint #${target.n}`, path: target.path };
}

export async function cleanupCheckpoints(
  cwd: string, sessionId: string
): Promise<void> {
  const dir = checkpointDir(cwd, sessionId);
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Already cleaned or never existed
  }
}
```

Note: Uses `execa` with array args (no shell injection). `git apply -R` is the standard way to reverse a patch.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/git/checkpoints.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add src/git/checkpoints.ts tests/git/checkpoints.test.ts
git commit -m "feat(git): add checkpoint system with patch creation, undo, and cleanup"
```

---

### Task 3: Create Auto-Commit Module

**Files:**
- Create: `src/git/commit.ts`
- Test: `tests/git/commit.test.ts`

**Step 1: Write the failing tests**

Create `tests/git/commit.test.ts` with tests for:
- `generateCommitMessage` returns a string when given session messages
- `generateCommitMessage` falls back to default message on API error
- `commitSessionChanges` stages specified files and commits
- `commitSessionChanges` uses the provided message
- `commitSessionChanges` returns false when no files changed
- `getSessionSummary` extracts user messages and tool call descriptions

Use a real git repo in temp directory. Mock the OpenAI client for `generateCommitMessage`.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/git/commit.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `src/git/commit.ts`:

```typescript
import { execa } from 'execa';
import type { AgentMessage } from '../core/agent.js';
import { debug } from '../core/debug.js';

export function getSessionSummary(messages: AgentMessage[]): string {
  return messages
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content))
    .map(m => `[${m.role}] ${(m.content ?? '').slice(0, 200)}`)
    .join('\n');
}

export async function generateCommitMessage(
  messages: AgentMessage[],
  client: import('openai').default,
  model: string
): Promise<string> {
  const summary = getSessionSummary(messages);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'Generate a concise git commit message (max 72 chars for subject line) for these changes. Use conventional commit format (feat/fix/refactor/docs). Reply with ONLY the commit message, no explanation.',
        },
        { role: 'user', content: summary },
      ],
      max_tokens: 100,
    });

    const msg = response.choices[0]?.message?.content?.trim();
    return msg || 'feat: apply AI-assisted changes';
  } catch (err) {
    debug(`Commit message generation failed: ${err}`);
    return 'feat: apply AI-assisted changes';
  }
}

export async function commitSessionChanges(
  cwd: string,
  files: string[],
  message: string
): Promise<boolean> {
  if (files.length === 0) return false;

  try {
    // Stage the specified files
    await execa('git', ['add', ...files], { cwd });

    // Check if there are staged changes
    const status = await execa('git', ['diff', '--cached', '--name-only'], { cwd, reject: false });
    if (!status.stdout.trim()) return false;

    // Commit
    await execa('git', ['commit', '-m', message], { cwd });
    return true;
  } catch (err) {
    debug(`Commit failed: ${err}`);
    return false;
  }
}
```

Note: All git commands use `execa` with array args. No shell interpolation.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/git/commit.test.ts`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add src/git/commit.ts tests/git/commit.test.ts
git commit -m "feat(git): add auto-commit with model-generated messages"
```

---

### Task 4: Hook Checkpoints into Agent Loop

**Files:**
- Modify: `src/core/agent.ts`
- Modify: `tests/core/agent.test.ts`

**Step 1: Add failing tests**

Add to `tests/core/agent.test.ts`:
- `buildSystemPrompt` includes dirty working tree warning when git repo is dirty
- `buildSystemPrompt` does not include warning for clean repos
- `buildSystemPrompt` does not include warning for non-git directories

These tests should create temp directories with `git init` (via `execa`) to test the dirty warning feature.

**Step 2: Run tests — FAIL**

**Step 3: Modify `agent.ts`**

Changes to `src/core/agent.ts`:

1. **Add dirty-tree warning to `buildSystemPrompt()`:**

After the export map section, add:

```typescript
// Warn about dirty working tree
try {
  const { isGitRepo, isDirty } = await import('../git/utils.js');
  if (await isGitRepo(workingDir) && await isDirty(workingDir)) {
    prompt += '\n\nNote: Working tree has uncommitted changes from outside this session.';
  }
} catch {
  // Git utils unavailable — skip
}
```

2. **Add checkpoint hook after tool execution (in `agentLoop`):**

After the `executeTool` call (around line 346), add checkpoint creation for `edit_file` and `write_file`:

```typescript
// Create checkpoint for file-modifying tools
if (config.git.checkpoints && (call.name === 'edit_file' || call.name === 'write_file')) {
  try {
    const { isGitRepo } = await import('../git/utils.js');
    if (await isGitRepo(process.cwd())) {
      const { createCheckpoint } = await import('../git/checkpoints.js');
      const parsedArgs = JSON.parse(call.args);
      checkpointCount++;
      await createCheckpoint(process.cwd(), sessionId, checkpointCount, call.name, String(parsedArgs.path));
    }
  } catch {
    // Checkpoint creation failed — non-fatal
  }
}
```

3. **Add `sessionId` parameter to `AgentLoopOptions`:**

```typescript
export interface AgentLoopOptions {
  existingMessages?: AgentMessage[];
  sessionId?: string;
}
```

4. **Add local variables at loop start:**

```typescript
const sessionId = options?.sessionId ?? 'unknown';
let checkpointCount = 0;
```

5. **Add auto-commit after loop completes:**

After the agent loop's `break` (when no tool calls), before the token usage printout:

```typescript
// Auto-commit if enabled
if (config.git.autoCommit && toolCallCount > 0 && options?.sessionId) {
  try {
    const { isGitRepo, getModifiedFiles } = await import('../git/utils.js');
    if (await isGitRepo(process.cwd())) {
      const modifiedFiles = await getModifiedFiles(process.cwd());
      if (modifiedFiles.length > 0) {
        const { generateCommitMessage, commitSessionChanges } = await import('../git/commit.js');
        const commitMsg = await generateCommitMessage(messages, client, model);
        const committed = await commitSessionChanges(process.cwd(), modifiedFiles, commitMsg);
        if (committed) {
          console.log(chalk.green('✓') + chalk.dim(` Committed: ${commitMsg}`));
        }
        const { cleanupCheckpoints } = await import('../git/checkpoints.js');
        await cleanupCheckpoints(process.cwd(), options.sessionId);
      }
    }
  } catch {
    // Auto-commit failed — non-fatal
  }
}
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/agent.ts tests/core/agent.test.ts
git commit -m "feat(git): hook checkpoints + auto-commit into agent loop"
```

---

### Task 5: Add `/undo` Slash Command

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add `/undo` to the help text**

In `handleSlashCommand`, update the `/help` case to include:
```
  /undo [n]     Reverse last checkpoint (or specific #n)
  /undo list    Show all checkpoints
```

**Step 2: Add the `/undo` case to the switch statement**

```typescript
case '/undo': {
  try {
    const { isGitRepo } = await import('../git/utils.js');
    if (!(await isGitRepo(process.cwd()))) {
      console.log(chalk.dim('  Not in a git repository'));
      return 'handled';
    }

    if (arg === 'list') {
      const { listCheckpoints } = await import('../git/checkpoints.js');
      const checkpoints = await listCheckpoints(process.cwd(), session.id);
      if (checkpoints.length === 0) {
        console.log(chalk.dim('  No checkpoints in this session'));
      } else {
        console.log('\n' + chalk.bold('Checkpoints:'));
        for (const cp of checkpoints) {
          console.log(`  #${cp.n}  ${cp.tool}  ${cp.path}  ${chalk.dim(cp.timestamp)}`);
        }
        console.log();
      }
      return 'handled';
    }

    const { undoCheckpoint } = await import('../git/checkpoints.js');
    const n = arg ? parseInt(arg, 10) : undefined;
    const result = await undoCheckpoint(process.cwd(), session.id, n);

    if (result) {
      console.log(chalk.green('✓') + ` Undone: ${result.undone} (${result.path})`);
      session.messages.push({
        role: 'user',
        content: `[System: User reversed ${result.undone} — changes to ${result.path} have been reverted. Adjust your approach accordingly.]`,
      });
    } else {
      console.log(chalk.dim('  No checkpoints to undo'));
    }
  } catch (err) {
    console.error(chalk.red('✗') + ` Undo failed: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
}
```

**Step 3: Pass `sessionId` to `agentLoop`**

In the REPL loop section of `startChat`, update the `agentLoop` call:

```typescript
const result = await agentLoop(userInput, config, {
  existingMessages: session.messages,
  sessionId: session.id,
});
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(git): add /undo slash command for checkpoint rollback"
```

---

### Task 6: Implement `opta diff` Command

**Files:**
- Modify: `src/commands/diff.ts`
- Modify: `src/index.ts`
- Create: `tests/commands/diff.test.ts`

**Step 1: Write the failing tests**

Create `tests/commands/diff.test.ts` with tests for:
- `showDiff` outputs diff for modified files in a git repo
- `showDiff` handles clean repo gracefully
- `showDiff` with `--session` shows checkpoints for that session
- `showDiff` handles non-git directories gracefully

**Step 2: Run tests — FAIL**

**Step 3: Rewrite `src/commands/diff.ts`**

Replace the stub with the real implementation:

```typescript
import chalk from 'chalk';
import { isGitRepo, gitDiff, getModifiedFiles } from '../git/utils.js';
import { listCheckpoints } from '../git/checkpoints.js';

interface DiffOptions {
  session?: string;
}

export async function diff(opts?: DiffOptions): Promise<void> {
  const cwd = process.cwd();

  if (!(await isGitRepo(cwd))) {
    console.log(chalk.yellow('Not a git repository.'));
    return;
  }

  if (opts?.session) {
    const checkpoints = await listCheckpoints(cwd, opts.session);
    if (checkpoints.length === 0) {
      console.log(chalk.dim('No checkpoints for this session.'));
      return;
    }
    console.log(chalk.bold(`Session ${opts.session} — ${checkpoints.length} checkpoints:`));
    for (const cp of checkpoints) {
      console.log(`  #${cp.n}  ${chalk.cyan(cp.tool)}  ${cp.path}  ${chalk.dim(cp.timestamp)}`);
    }
    return;
  }

  const modifiedFiles = await getModifiedFiles(cwd);
  if (modifiedFiles.length === 0) {
    console.log(chalk.dim('No uncommitted changes.'));
    return;
  }

  console.log(chalk.bold(`${modifiedFiles.length} file(s) changed:\n`));
  const diffOutput = await gitDiff(cwd);
  console.log(diffOutput);
}
```

**Step 4: Update `src/index.ts`**

The `diff` command is already registered but doesn't pass `opts`. Update the action to pass options:

```typescript
.action(async (opts) => {
  const { diff } = await import('./commands/diff.js');
  await diff(opts);
});
```

**Step 5: Run tests**

Run: `npm test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/commands/diff.ts src/index.ts tests/commands/diff.test.ts
git commit -m "feat(git): implement opta diff command with session checkpoint view"
```

---

### Task 7: Add CLI Flags for Git Features

**Files:**
- Modify: `src/index.ts`
- Modify: `src/commands/chat.ts`
- Modify: `src/commands/do.ts`

**Step 1: Add `--no-commit` and `--no-checkpoints` flags**

In `src/index.ts`, add flags to `chat` and `do` commands:

```typescript
.option('--no-commit', 'disable auto-commit at task end')
.option('--no-checkpoints', 'disable checkpoint creation')
```

**Step 2: Wire flags into config overrides**

In `chat.ts`, update the `ChatOptions` interface and overrides:

```typescript
interface ChatOptions {
  resume?: string;
  plan?: boolean;
  model?: string;
  noCommit?: boolean;
  noCheckpoints?: boolean;
}
```

And in the overrides section:

```typescript
if (opts.noCommit) {
  overrides['git'] = { ...(overrides['git'] as Record<string, unknown> ?? {}), autoCommit: false };
}
if (opts.noCheckpoints) {
  overrides['git'] = { ...(overrides['git'] as Record<string, unknown> ?? {}), checkpoints: false };
}
```

Do the same in `do.ts`.

**Step 3: Run tests**

Run: `npm test`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/index.ts src/commands/chat.ts src/commands/do.ts
git commit -m "feat(git): add --no-commit and --no-checkpoints CLI flags"
```

---

### Task 8: Add `.opta/checkpoints/` to `.gitignore`

**Files:**
- Create or modify: `.gitignore` (in the Opta CLI project directory)

**Step 1: Check existing .gitignore**

Read `.gitignore` if it exists.

**Step 2: Add checkpoint ignore rule**

Add this line to `.gitignore`:

```
.opta/checkpoints/
```

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .opta/checkpoints/ in git"
```

---

### Task 9: Run Full Suite + Typecheck

**Step 1: Typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 3: Version bump**

Update `package.json` version from `0.2.0-alpha.1` to `0.2.0-alpha.2`.

**Step 4: Commit**

```bash
git add package.json
git commit -m "chore: V2 Phase 2 complete — git integration (checkpoints, auto-commit, /undo, diff)"
```

---

## Summary

| Task | New Files | Modified Files | Tests Added |
|------|-----------|----------------|-------------|
| 1. Git Utilities | `src/git/utils.ts` | — | ~8 |
| 2. Checkpoint System | `src/git/checkpoints.ts` | — | ~10 |
| 3. Auto-Commit | `src/git/commit.ts` | — | ~6 |
| 4. Agent Loop Hooks | — | `src/core/agent.ts` | ~3 |
| 5. /undo Command | — | `src/commands/chat.ts` | 0 |
| 6. Diff Command | — | `src/commands/diff.ts`, `src/index.ts` | ~4 |
| 7. CLI Flags | — | `src/index.ts`, `chat.ts`, `do.ts` | 0 |
| 8. .gitignore | `.gitignore` | — | 0 |
| 9. Final Validation | — | `package.json` | 0 |
| **Total** | **3 new** | **7 modified** | **~31 new** |

## Success Criteria (from design doc) — ALL VERIFIED 2026-02-27

- [x] Checkpoint patches created after each edit_file/write_file — _agent-execution.ts:220-230, git/checkpoints.ts_
- [x] `/undo` reverses the correct patch — _commands/slash/workflow.ts:117-281, git apply -R_
- [x] Task completion creates one clean commit — _agent.ts:862-880, git/commit.ts_
- [x] `--no-commit` flag disables auto-commit — _index.ts:106,180 → git.autoCommit: false_
- [x] Dirty working tree warning at session start — _agent-setup.ts:145-153 (system prompt)_
- [x] No git features in non-git directories (graceful skip) — _all git ops guarded by isGitRepo()_
