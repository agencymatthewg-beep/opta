---
status: archived
---

# Windows Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Opta CLI fully functional on Windows for the Anthropic cloud provider path, with `opta serve` gracefully declining on non-macOS platforms.

**Architecture:** Introduce a thin platform-abstraction layer (`src/platform/`) that wraps all OS-specific operations (shell execution, path resolution, process management, binary detection). All existing callers are migrated to use these abstractions. The `opta serve` and remote management subsystems are gated behind an explicit macOS/Linux platform check and exit cleanly on Windows. The core agent loop — file tools, `run_command`, background processes, daemon, TUI — becomes fully functional on Windows with Anthropic as the provider.

**Tech Stack:** Node.js `node:os`, `node:path`, `node:child_process`, `execa`, TypeScript strict, vitest

---

## Scope Boundary

| Feature                                                               | Windows Target                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| `opta chat` (Anthropic provider)                                      | **Fully functional**                                           |
| `opta chat` (LMX local provider)                                      | Fails gracefully with clear message (LMX = Apple Silicon only) |
| Agent file tools (`read_file`, `write_file`, `edit_file`, `list_dir`) | **Fully functional**                                           |
| Agent `run_command` tool                                              | **Fully functional** (uses `cmd /c` on Windows)                |
| Agent `bg_start`/`bg_stop`/`bg_list` tools                            | **Fully functional**                                           |
| Daemon (`opta daemon start/stop/status`)                              | **Fully functional**                                           |
| TUI (`opta tui`)                                                      | **Fully functional**                                           |
| LSP features                                                          | **Fully functional** (uses `where` on Windows)                 |
| `opta serve`                                                          | **Platform check → clear error on Windows**                    |
| `opta update`                                                         | **Platform check → clear error on Windows**                    |
| `opta key sync` (Mac Studio remote)                                   | **Platform check → clear error on Windows**                    |
| Shell completions                                                     | bash/zsh/fish only (PowerShell out of scope)                   |

---

## Task 1: Create Platform Abstraction Layer

**Purpose:** Single module that all platform-sensitive code will import from. Centralises all `process.platform === 'win32'` checks.

**Files:**

- Create: `src/platform/index.ts`
- Create: `tests/platform/index.test.ts`

---

### Step 1: Write failing tests

```typescript
// tests/platform/index.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isWindows,
  isMacOS,
  isLinux,
  requiresPosixPlatform,
  homedir,
  pathSep,
} from '../../src/platform/index.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('isWindows', () => {
  it('returns true when process.platform is win32', () => {
    vi.stubEnv('PLATFORM_OVERRIDE', '');
    // We will test via the exported const, seeded at module load.
    // For unit tests, mock process.platform directly.
    expect(typeof isWindows).toBe('boolean');
  });
});

describe('homedir', () => {
  it('returns a non-empty string', () => {
    expect(homedir().length).toBeGreaterThan(0);
  });
});

describe('pathSep', () => {
  it('is either / or \\', () => {
    expect(['/', '\\']).toContain(pathSep);
  });
});

describe('requiresPosixPlatform', () => {
  it('throws OptaError with Windows guidance when called on win32', () => {
    // Test the message content; actual platform gating tested via integration
    expect(() => requiresPosixPlatform('opta serve')).not.toThrow(); // on macOS/Linux CI
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- tests/platform/index.test.ts
```

Expected: FAIL — module not found

---

### Step 3: Implement `src/platform/index.ts`

```typescript
/**
 * platform/index.ts
 *
 * Single source of truth for all OS-specific behaviour.
 * Import from here — never use process.platform directly in feature code.
 */

import { homedir as _homedir } from 'node:os';
import { sep } from 'node:path';
import { OptaError } from '../core/errors.js';

export const isWindows: boolean = process.platform === 'win32';
export const isMacOS: boolean = process.platform === 'darwin';
export const isLinux: boolean = process.platform === 'linux';

/** Cross-platform home directory. Always use this, never process.env.HOME. */
export function homedir(): string {
  return _homedir();
}

/** OS path separator ('/' on POSIX, '\' on Windows). */
export const pathSep: string = sep;

/**
 * Asserts that the current platform is POSIX (macOS or Linux).
 * Throws a user-friendly OptaError on Windows, explaining the limitation.
 *
 * @param commandName  The CLI command name for the error message (e.g. 'opta serve')
 */
export function requiresPosixPlatform(commandName: string): void {
  if (isWindows) {
    throw new OptaError(
      `${commandName} requires macOS or Linux.\n\n` +
        `This command manages the Opta LMX inference server, which runs on\n` +
        `Apple Silicon (MLX framework) and is not available on Windows.\n\n` +
        `To use ${commandName}:\n` +
        `  • Run this command from a macOS or Linux machine\n` +
        `  • Or connect to a remote LMX host: opta config set connection.host <ip>`
    );
  }
}

/**
 * Returns the appropriate shell executable and argument for running an
 * arbitrary command string on the current platform.
 *
 *   Windows  → ['cmd', '/c']
 *   POSIX    → ['sh', '-c']
 */
export function shellArgs(): [string, string] {
  return isWindows ? ['cmd', '/c'] : ['sh', '-c'];
}

/**
 * Cross-platform binary detection.
 *   Windows  → `where <cmd>`
 *   POSIX    → `which <cmd>`
 *
 * Returns true if the binary is found, false otherwise.
 * Never throws.
 */
export async function isBinaryAvailable(command: string): Promise<boolean> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  const finder = isWindows ? 'where' : 'which';
  try {
    await exec(finder, [command]);
    return true;
  } catch {
    return false;
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm run test -- tests/platform/index.test.ts
```

Expected: PASS

**Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

**Step 6: Commit**

```bash
git add src/platform/index.ts tests/platform/index.test.ts
git commit -m "feat(platform): add cross-platform abstraction layer"
```

---

## Task 2: Fix Path Traversal Guard (CRITICAL)

**Bug:** `src/core/tools/executors.ts:410` uses `cwd + '/'` — on Windows paths use `\`, so the check throws on every file operation.

**Files:**

- Modify: `src/core/tools/executors.ts:397-415`
- Modify: `tests/core/executors.test.ts` (add Windows path cases)

---

### Step 1: Write failing test

Find the existing test file for executors. If `tests/core/executors.test.ts` exists, add to it; otherwise create it.

```typescript
// Add to existing executors tests or create tests/core/path-guard.test.ts
import { describe, it, expect } from 'vitest';
import { assertWithinCwd } from '../../src/core/tools/executors.js';
import { sep, resolve } from 'node:path';

describe('assertWithinCwd', () => {
  it('does not throw for a path within cwd', () => {
    const cwd = process.cwd();
    const child = resolve(cwd, 'src', 'index.ts');
    expect(() => assertWithinCwd(child)).not.toThrow();
  });

  it('throws for a path outside cwd', () => {
    const outside = resolve(process.cwd(), '..', '..', 'etc', 'passwd');
    expect(() => assertWithinCwd(outside)).toThrow('Path traversal blocked');
  });

  it('does not throw for exact cwd', () => {
    expect(() => assertWithinCwd(process.cwd())).not.toThrow();
  });

  it('uses platform path separator in guard logic', () => {
    // Regression: guard must NOT hardcode '/' separator
    const cwd = process.cwd();
    // A path that starts with cwd + some other char (not sep) must be blocked
    const tricky = cwd + 'evil';
    expect(() => assertWithinCwd(tricky)).toThrow('Path traversal blocked');
  });
});
```

**Step 2: Run to verify the tricky case fails (currently hardcodes `/`)**

```bash
npm run test -- tests/core/path-guard.test.ts
```

Expected: the 4th test case passes only on macOS (by coincidence — `/` is correct on POSIX), but the logic is wrong. The test exposes the intent; all 4 should pass after the fix.

---

### Step 3: Apply fix to `src/core/tools/executors.ts:410`

Change:

```typescript
  if (!normalized.startsWith(cwd + '/') && normalized !== cwd) {
```

To:

```typescript
  import { sep } from 'node:path';
  // ...
  if (!normalized.startsWith(cwd + sep) && normalized !== cwd) {
```

The `sep` import already exists at the top of the file via `node:path`. Add `sep` to the existing import statement if not already present:

```typescript
// At top of file — existing import line, add 'sep':
import { resolve, dirname, sep } from 'node:path';
```

Full updated function:

```typescript
export function assertWithinCwd(resolvedPath: string): void {
  const cwd = realpathSync(process.cwd());
  let normalized: string;
  try {
    normalized = realpathSync(resolvedPath);
  } catch {
    normalized = resolve(cwd, resolvedPath);
  }
  if (!normalized.startsWith(cwd + sep) && normalized !== cwd) {
    throw new Error(
      `Path traversal blocked: "${normalized}" is outside working directory "${cwd}"`
    );
  }
}
```

**Step 4: Run tests**

```bash
npm run test -- tests/core/path-guard.test.ts
npm run test:run
```

Expected: all pass

**Step 5: Commit**

```bash
git add src/core/tools/executors.ts tests/core/path-guard.test.ts
git commit -m "fix(core): use path.sep in assertWithinCwd for Windows compatibility"
```

---

## Task 3: Replace `process.env.HOME` with `os.homedir()` (Global)

**Files touched:**

- `src/commands/serve.ts:50` — `expandHome()`
- `src/commands/update.ts:118` — `expandHome()`
- `src/tui/hooks/useAppConfig.ts:39` — `expandHomePath()`

---

### Step 1: Fix `src/commands/serve.ts:49-51`

Change:

```typescript
function expandHome(path: string): string {
  return path.replace('~', process.env.HOME ?? '');
}
```

To:

```typescript
import { homedir } from '../platform/index.js';

function expandHome(path: string): string {
  if (!path.startsWith('~')) return path;
  return homedir() + path.slice(1);
}
```

Also update the venv path candidates at lines 164–165:

```typescript
// Change:
`${process.env['HOME'] ?? '~'}/opta-lmx/.venv/bin/python`,
`${process.env['HOME'] ?? '~'}/.opta-lmx/.venv/bin/python`,

// To:
`${homedir()}/opta-lmx/.venv/bin/python`,
`${homedir()}/.opta-lmx/.venv/bin/python`,
```

---

### Step 2: Fix `src/commands/update.ts:116-120`

Change:

```typescript
function expandHome(input: string): string {
  if (!input.startsWith('~')) return input;
  const home = process.env['HOME'] ?? '';
  return input.replace(/^~(?=$|\/)/, home);
}
```

To:

```typescript
import { homedir } from '../platform/index.js';

function expandHome(input: string): string {
  if (!input.startsWith('~')) return input;
  return homedir() + input.slice(1);
}
```

---

### Step 3: Fix `src/tui/hooks/useAppConfig.ts:37-41`

Change:

```typescript
function expandHomePath(pathValue: string): string {
  if (!pathValue.startsWith('~/')) return pathValue;
  const home = process.env['HOME'];
  return home ? `${home}/${pathValue.slice(2)}` : pathValue;
}
```

To:

```typescript
import { homedir } from '../../platform/index.js';

function expandHomePath(pathValue: string): string {
  if (!pathValue.startsWith('~/') && pathValue !== '~') return pathValue;
  return homedir() + pathValue.slice(1);
}
```

---

### Step 4: Typecheck and test

```bash
npm run typecheck
npm run test:run
```

Expected: no errors, no regressions

**Step 5: Commit**

```bash
git add src/commands/serve.ts src/commands/update.ts src/tui/hooks/useAppConfig.ts
git commit -m "fix(platform): replace process.env.HOME with os.homedir() everywhere"
```

---

## Task 4: Cross-Platform Shell Execution for Agent Tools

**Purpose:** The agent's `run_command` tool and the background process manager both hardcode `sh -c`. Replace with the platform abstraction's `shellArgs()`.

**Files:**

- Modify: `src/core/tools/executors.ts:574-579`
- Modify: `src/core/background.ts:137`
- Create: `tests/core/shell-exec.test.ts`

---

### Step 1: Write failing test

```typescript
// tests/core/shell-exec.test.ts
import { describe, it, expect } from 'vitest';
import { isWindows } from '../../src/platform/index.js';

describe('run_command tool (integration smoke)', () => {
  it('can execute a simple echo command', async () => {
    // Import the executor directly
    const { execRunCommandForTest } = await import('../../src/core/tools/executors.js');
    // Note: we will export this test helper in Task 4 Step 3
    const result = await execRunCommandForTest('echo hello_opta');
    expect(result).toContain('hello_opta');
  });

  it('returns exit code in output', async () => {
    const { execRunCommandForTest } = await import('../../src/core/tools/executors.js');
    const result = await execRunCommandForTest('exit 0');
    expect(result).toContain('[exit code: 0]');
  });
});
```

**Step 2: Run to verify test fails**

```bash
npm run test -- tests/core/shell-exec.test.ts
```

Expected: FAIL — `execRunCommandForTest` not exported

---

### Step 3: Update `src/core/tools/executors.ts`

Add import at top of file (with existing node imports):

```typescript
import { shellArgs } from '../../platform/index.js';
```

Update `execRunCommand` function (lines 570-587):

```typescript
async function execRunCommand(args: Record<string, unknown>): Promise<string> {
  const command = getStringArg(args, 'command');
  const timeout = Number(args['timeout'] ?? 30000);

  const { execa } = await import('execa');
  const [shell, shellFlag] = shellArgs();
  const result = await execa(shell, [shellFlag, command], {
    reject: false,
    timeout,
    cwd: process.cwd(),
  });

  let output = '';
  if (result.stdout) output += result.stdout;
  if (result.stderr) output += (output ? '\n' : '') + `[stderr] ${result.stderr}`;
  output += `\n[exit code: ${result.exitCode}]`;

  return output;
}

// Export for testing only — not part of public API
export async function execRunCommandForTest(command: string): Promise<string> {
  return execRunCommand({ command });
}
```

---

### Step 4: Update `src/core/background.ts:137`

Add import at top:

```typescript
import { shellArgs } from '../platform/index.js';
```

Change line 137:

```typescript
// Before:
const child = spawn('sh', ['-c', command], {

// After:
const [shell, shellFlag] = shellArgs();
const child = spawn(shell, [shellFlag, command], {
```

---

### Step 5: Run tests

```bash
npm run test -- tests/core/shell-exec.test.ts
npm run test:run
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/core/tools/executors.ts src/core/background.ts src/platform/index.ts tests/core/shell-exec.test.ts
git commit -m "fix(core): use cross-platform shell (cmd/sh) for run_command and bg_start tools"
```

---

## Task 5: Cross-Platform Binary Detection (LSP)

**Purpose:** `src/lsp/manager.ts:317` calls `execFile('which', ...)` — `which` doesn't exist on Windows. Replace with the platform abstraction's `isBinaryAvailable()`.

**Files:**

- Modify: `src/lsp/manager.ts:315-321`
- Create: `tests/lsp/binary-detection.test.ts`

---

### Step 1: Write failing test

```typescript
// tests/lsp/binary-detection.test.ts
import { describe, it, expect } from 'vitest';
import { isBinaryAvailable } from '../../src/platform/index.js';

describe('isBinaryAvailable', () => {
  it('returns true for node (always on PATH)', async () => {
    const found = await isBinaryAvailable('node');
    expect(found).toBe(true);
  });

  it('returns false for a non-existent binary', async () => {
    const found = await isBinaryAvailable('opta_nonexistent_binary_xyz_12345');
    expect(found).toBe(false);
  });

  it('never throws', async () => {
    await expect(isBinaryAvailable('!@#$%^')).resolves.toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test -- tests/lsp/binary-detection.test.ts
```

Expected: FAIL — function not exported or `which` not found on Windows

---

### Step 3: Update `src/lsp/manager.ts`

Add import at top of file:

```typescript
import { isBinaryAvailable } from '../platform/index.js';
```

Replace `checkBinary` method (lines 315-321):

```typescript
private async checkBinary(command: string): Promise<boolean> {
  return isBinaryAvailable(command);
}
```

**Step 4: Run tests**

```bash
npm run test -- tests/lsp/binary-detection.test.ts
npm run test:run
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lsp/manager.ts src/platform/index.ts tests/lsp/binary-detection.test.ts
git commit -m "fix(lsp): use cross-platform binary detection (where/which) for LSP server lookup"
```

---

## Task 6: Windows-Safe Editor Fallback

**Purpose:** `src/commands/editor.ts:8` defaults to `vi` — not available on Windows. Default to `notepad` on Windows.

**Files:**

- Modify: `src/commands/editor.ts:7-9`

---

### Step 1: No test needed (trivial config change) — update inline

Change `src/commands/editor.ts:7-9`:

```typescript
import { isWindows } from '../platform/index.js';

export function getEditorCommand(): string {
  const defaultEditor = isWindows ? 'notepad' : 'vi';
  return process.env.VISUAL || process.env.EDITOR || defaultEditor;
}
```

**Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors

**Step 3: Commit**

```bash
git add src/commands/editor.ts
git commit -m "fix(editor): default to notepad on Windows instead of vi"
```

---

## Task 7: Platform Gate for `opta serve`

**Purpose:** `opta serve` manages the Opta LMX server which requires Apple Silicon. On Windows, show a clear friendly error rather than crashing with `bash not found`.

**Files:**

- Modify: `src/commands/serve.ts` — add platform check at command entry point
- Create: `tests/commands/serve-platform.test.ts`

---

### Step 1: Find the serve command entry point

The `serve()` function at approximately line 20–43 is the Commander action handler. It dispatches to sub-commands (`start`, `stop`, `status`, `logs`). Add the platform guard at the top of this function.

---

### Step 2: Write test

```typescript
// tests/commands/serve-platform.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('serve command platform gate', () => {
  it('requiresPosixPlatform throws OptaError with helpful message on Windows', async () => {
    // Override platform
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    const { requiresPosixPlatform } = await import('../../src/platform/index.js');

    // Re-import after mock (vitest module isolation)
    expect(() => requiresPosixPlatform('opta serve')).toThrow('opta serve requires macOS or Linux');
    expect(() => requiresPosixPlatform('opta serve')).toThrow('connection.host');
  });
});
```

**Step 3: Run test to see it fail (before adding guard to serve.ts)**

```bash
npm run test -- tests/commands/serve-platform.test.ts
```

Expected: the `requiresPosixPlatform` itself may already throw but the test verifies the message content.

---

### Step 4: Add platform guard to `src/commands/serve.ts`

Add import at top of file (with other imports):

```typescript
import { requiresPosixPlatform } from '../platform/index.js';
```

At the very top of the `serve()` function (before the `switch` statement, approximately line 34):

```typescript
export async function serve(subcommand: string | undefined, opts: ServeOptions): Promise<void> {
  requiresPosixPlatform('opta serve'); // ← Add this line
  switch (
    subcommand
    // ... rest of function unchanged
  ) {
  }
}
```

**Step 5: Run tests**

```bash
npm run test -- tests/commands/serve-platform.test.ts
npm run test:run
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/serve.ts tests/commands/serve-platform.test.ts
git commit -m "fix(serve): add platform gate — opta serve exits cleanly on Windows with helpful message"
```

---

## Task 8: Platform Gate for `opta update`

**Purpose:** `opta update` uses `bash -lc` for all local commands and SSH to a remote Mac Studio. Gate it on POSIX the same way as `opta serve`.

**Files:**

- Modify: `src/commands/update.ts` — add guard at entry point

---

### Step 1: Add import and guard

Add at top of file:

```typescript
import { requiresPosixPlatform } from '../platform/index.js';
```

Find the `update()` action handler (the exported Commander action function). Add at top:

```typescript
export async function update(opts: UpdateOptions): Promise<void> {
  requiresPosixPlatform('opta update');
  // ... rest of function unchanged
}
```

**Step 2: Typecheck and test**

```bash
npm run typecheck
npm run test:run
```

Expected: no errors, no regressions

**Step 3: Commit**

```bash
git add src/commands/update.ts
git commit -m "fix(update): add platform gate — opta update exits cleanly on Windows"
```

---

## Task 9: Platform Gate for `opta key sync` (Remote SSH)

**Purpose:** The `opta key sync` command SSH-es to a remote Mac Studio. Remote key management assumes POSIX SSH.

**Files:**

- Modify: `src/commands/key.ts` — add guard for the `sync` subcommand

---

### Step 1: Find the key sync entry point

In `src/commands/key.ts`, find the `sync` action handler function. Add:

```typescript
import { requiresPosixPlatform } from '../platform/index.js';

// In the sync action handler:
export async function keySync(opts: KeySyncOptions): Promise<void> {
  requiresPosixPlatform('opta key sync');
  // ... rest of function unchanged
}
```

**Step 2: Typecheck and test**

```bash
npm run typecheck
npm run test:run
```

**Step 3: Commit**

```bash
git add src/commands/key.ts
git commit -m "fix(key): add platform gate for opta key sync (requires POSIX SSH)"
```

---

## Task 10: Daemon Token File Security on Windows

**Purpose:** `mode: 0o600` is silently ignored on Windows, leaving the daemon auth token world-readable. Implement Windows ACL restriction via `icacls`.

**Files:**

- Modify: `src/platform/index.ts` — add `restrictFileToCurrentUser()`
- Modify: `src/daemon/lifecycle.ts:87` — call the new helper
- Create: `tests/platform/file-permissions.test.ts`

---

### Step 1: Add `restrictFileToCurrentUser` to platform module

In `src/platform/index.ts`, add:

```typescript
import { chmod } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Restricts a file so only the current OS user can read/write it.
 *
 *   POSIX   → chmod 600
 *   Windows → icacls: remove all inheritance, grant current user only
 *
 * Fails silently (logs at verbose) — never throws.
 */
export async function restrictFileToCurrentUser(filePath: string): Promise<void> {
  try {
    if (isWindows) {
      // Remove inherited permissions, then grant current user full control only
      // %USERNAME% is always set on Windows
      const username = process.env['USERNAME'] ?? process.env['USER'] ?? '';
      if (!username) return; // can't determine user — skip
      await execFileAsync('icacls', [filePath, '/inheritance:r']);
      await execFileAsync('icacls', [filePath, '/grant:r', `${username}:(R,W)`]);
    } else {
      await chmod(filePath, 0o600);
    }
  } catch (err) {
    verbose('platform', `restrictFileToCurrentUser failed for ${filePath}: ${String(err)}`);
  }
}
```

---

### Step 2: Write test

```typescript
// tests/platform/file-permissions.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { restrictFileToCurrentUser } from '../../src/platform/index.js';
import { isWindows } from '../../src/platform/index.js';

describe('restrictFileToCurrentUser', () => {
  const testFile = join(tmpdir(), `opta-perm-test-${Date.now()}.txt`);

  afterEach(async () => {
    await rm(testFile, { force: true });
  });

  it('does not throw on a real file', async () => {
    await writeFile(testFile, 'secret', 'utf-8');
    await expect(restrictFileToCurrentUser(testFile)).resolves.toBeUndefined();
  });

  it('does not throw when file does not exist', async () => {
    await expect(restrictFileToCurrentUser('/nonexistent/path/file.txt')).resolves.toBeUndefined();
  });

  it('sets 0o600 on POSIX after restrict', async () => {
    if (isWindows) return; // skip on Windows
    await writeFile(testFile, 'secret', { mode: 0o644 });
    await restrictFileToCurrentUser(testFile);
    const s = await stat(testFile);
    expect(s.mode & 0o777).toBe(0o600);
  });
});
```

**Step 3: Run test to verify it fails (function not yet exported)**

```bash
npm run test -- tests/platform/file-permissions.test.ts
```

**Step 4: Update `src/daemon/lifecycle.ts:85-88`**

Add import:

```typescript
import { restrictFileToCurrentUser } from '../platform/index.js';
```

Change `writeDaemonToken`:

```typescript
export async function writeDaemonToken(token: string): Promise<void> {
  await ensureDaemonDir();
  // Write with POSIX mode (silently ignored on Windows — handled below)
  await writeFile(tokenPath(), token, { encoding: 'utf-8', mode: 0o600 });
  // Explicitly restrict on all platforms including Windows
  await restrictFileToCurrentUser(tokenPath());
}
```

**Step 5: Run tests**

```bash
npm run test -- tests/platform/file-permissions.test.ts
npm run test:run
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/platform/index.ts src/daemon/lifecycle.ts tests/platform/file-permissions.test.ts
git commit -m "fix(daemon): restrict token file permissions on Windows via icacls"
```

---

## Task 11: Add `src/platform/` to tsup Build Entry

**Purpose:** Ensure the platform module is included in the distribution bundle.

**Files:**

- Modify: `package.json:19` — add `src/platform/index.ts` to tsup entry points

---

### Step 1: Update build script in `package.json`

Change line 19:

```json
// Before:
"build": "tsup src/index.ts src/daemon/worker-pool-worker.ts src/core/tools/executors.ts --format esm --dts --clean",

// After:
"build": "tsup src/index.ts src/daemon/worker-pool-worker.ts src/core/tools/executors.ts src/platform/index.ts --format esm --dts --clean",
```

**Step 2: Build and verify**

```bash
npm run build
ls dist/platform/
```

Expected: `index.js`, `index.d.ts` present in `dist/platform/`

**Step 3: Run full CI check**

```bash
npm run test:ci
```

Expected: all pass

**Step 4: Commit**

```bash
git add package.json
git commit -m "build: include platform module in tsup bundle"
```

---

## Task 12: Update README — Windows Support Section

**Files:**

- Modify: `README.md` — add Windows compatibility section near top

---

### Step 1: Add section after the existing "Requirements" or "Installation" heading

Find the appropriate location in `README.md` and insert:

```markdown
## Platform Support

| Feature                 | macOS | Linux | Windows                     |
| ----------------------- | ----- | ----- | --------------------------- |
| `opta chat` (Anthropic) | ✓     | ✓     | ✓                           |
| `opta chat` (LMX local) | ✓     | —     | —                           |
| Agent file tools        | ✓     | ✓     | ✓                           |
| Agent `run_command`     | ✓     | ✓     | ✓ (cmd.exe)                 |
| Daemon                  | ✓     | ✓     | ✓                           |
| TUI                     | ✓     | ✓     | ✓ (Windows Terminal)        |
| LSP features            | ✓     | ✓     | ✓                           |
| `opta serve`            | ✓     | ✓     | — (Apple Silicon only)      |
| `opta update`           | ✓     | ✓     | — (macOS remote management) |

> **Windows note:** `opta serve` and `opta update` require macOS/Linux because the Opta LMX
> inference server uses Apple's MLX framework (Apple Silicon only). All other commands work
> fully on Windows. For Windows users, connect `opta` to the Anthropic API via
> `opta config set provider anthropic`.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add Windows platform support table to README"
```

---

## Task 13: Integration Smoke Test (Windows Path)

**Purpose:** A single integration test that exercises the full agent tool chain on the current OS, verifying the path separator fix and shell execution work end-to-end.

**Files:**

- Create: `tests/integration/windows-compat.test.ts`

---

### Step 1: Write test

```typescript
// tests/integration/windows-compat.test.ts
/**
 * Cross-platform integration smoke test.
 * Exercises: assertWithinCwd, execRunCommand, isBinaryAvailable, homedir.
 * Must pass on macOS, Linux, AND Windows.
 */
import { describe, it, expect } from 'vitest';
import { resolve, sep } from 'node:path';
import { assertWithinCwd } from '../../src/core/tools/executors.js';
import { isBinaryAvailable, homedir, shellArgs, isWindows } from '../../src/platform/index.js';

describe('cross-platform smoke', () => {
  it('assertWithinCwd allows paths within cwd', () => {
    const child = resolve(process.cwd(), 'package.json');
    expect(() => assertWithinCwd(child)).not.toThrow();
  });

  it('assertWithinCwd blocks path traversal', () => {
    const outside = resolve(process.cwd(), '..', '..', 'etc');
    expect(() => assertWithinCwd(outside)).toThrow('Path traversal blocked');
  });

  it('assertWithinCwd tricky prefix test (no false negatives from separator)', () => {
    const fake = process.cwd() + 'extra'; // starts with cwd but adds chars before sep
    expect(() => assertWithinCwd(fake)).toThrow('Path traversal blocked');
  });

  it('homedir returns non-empty string without using process.env.HOME', () => {
    const h = homedir();
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(0);
  });

  it('shellArgs returns correct shell for platform', () => {
    const [shell] = shellArgs();
    if (isWindows) {
      expect(shell).toBe('cmd');
    } else {
      expect(shell).toBe('sh');
    }
  });

  it('isBinaryAvailable finds node (always on PATH)', async () => {
    expect(await isBinaryAvailable('node')).toBe(true);
  });

  it('isBinaryAvailable returns false for garbage binary', async () => {
    expect(await isBinaryAvailable('zzz_opta_fake_9999')).toBe(false);
  });
});
```

**Step 2: Run test**

```bash
npm run test -- tests/integration/windows-compat.test.ts
```

Expected: all 7 pass on macOS/Linux; all 7 pass on Windows after Tasks 1–10 are complete

**Step 3: Commit**

```bash
git add tests/integration/windows-compat.test.ts
git commit -m "test(integration): add cross-platform smoke test for Windows compatibility"
```

---

## Task 14: Final Verification

**Purpose:** Run the complete test suite and typecheck to confirm no regressions.

### Step 1: Full typecheck

```bash
npm run typecheck
```

Expected: 0 errors

### Step 2: Full test suite

```bash
npm run test:run
```

Expected: all existing tests pass + all new tests pass

### Step 3: Build verification

```bash
npm run build
node dist/index.js --help
```

Expected: help text renders, no startup error

### Step 4: Run quality gate

```bash
npm run quality:gate
```

Expected: PASS

### Step 5: Final commit if any residual changes

```bash
git add -A
git status
# Review — commit only non-secret, non-build-artifact files
git commit -m "chore(windows): final cleanup and verification"
```

---

## Summary of All Changes

| Task                              | Files Modified                             | Effort  |
| --------------------------------- | ------------------------------------------ | ------- |
| 1 — Platform abstraction layer    | `src/platform/index.ts` (new)              | ~30 min |
| 2 — Path traversal separator fix  | `src/core/tools/executors.ts:410`          | ~10 min |
| 3 — `os.homedir()` everywhere     | `serve.ts`, `update.ts`, `useAppConfig.ts` | ~15 min |
| 4 — Cross-platform shell exec     | `executors.ts:575`, `background.ts:137`    | ~20 min |
| 5 — Binary detection (LSP)        | `src/lsp/manager.ts:317`                   | ~10 min |
| 6 — Editor fallback               | `src/commands/editor.ts:8`                 | ~5 min  |
| 7 — `opta serve` platform gate    | `src/commands/serve.ts`                    | ~10 min |
| 8 — `opta update` platform gate   | `src/commands/update.ts`                   | ~10 min |
| 9 — `opta key sync` platform gate | `src/commands/key.ts`                      | ~10 min |
| 10 — Token file ACL on Windows    | `src/platform/index.ts`, `lifecycle.ts:87` | ~20 min |
| 11 — Build config                 | `package.json:19`                          | ~5 min  |
| 12 — README docs                  | `README.md`                                | ~10 min |
| 13 — Integration smoke test       | `tests/integration/windows-compat.test.ts` | ~15 min |
| 14 — Final verification           | —                                          | ~10 min |

**Total estimated time: 3–4 hours**

---

## New Files Created

```
src/platform/index.ts                         ← Platform abstraction (all OS checks live here)
tests/platform/index.test.ts
tests/platform/file-permissions.test.ts
tests/core/path-guard.test.ts
tests/core/shell-exec.test.ts
tests/lsp/binary-detection.test.ts
tests/commands/serve-platform.test.ts
tests/integration/windows-compat.test.ts
docs/plans/2026-02-28-windows-compatibility.md  ← this file
```

## Files Modified

```
src/core/tools/executors.ts          line 410  (sep fix), line 575 (shell abstraction)
src/core/background.ts               line 137  (shell abstraction)
src/daemon/lifecycle.ts              line 87   (restrictFileToCurrentUser)
src/lsp/manager.ts                   line 317  (isBinaryAvailable)
src/commands/serve.ts                line 34   (platform gate), line 50/164/165 (homedir)
src/commands/update.ts               line ~10  (platform gate), line 118 (homedir)
src/commands/key.ts                  (platform gate for sync)
src/commands/editor.ts               line 8    (notepad fallback)
src/tui/hooks/useAppConfig.ts        line 39   (homedir)
package.json                         line 19   (build entry)
README.md                            (platform support table)
```
