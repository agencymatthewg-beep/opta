# Phase 1A: Input & Editor Enhancements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Opta CLI's single-line readline input into a multiline, mode-aware editor with shell mode, @ autocomplete, line range refs, $EDITOR integration, and escape handling — all within the current Commander.js stack (no Ink dependency).

**Architecture:** Replace `@inquirer/prompts input()` with a custom `InputEditor` class wrapping Node.js `readline` that supports multiline editing, mode detection, history, and keypress events. This becomes the foundation that Phase 2 (Ink migration) later wraps in a React component.

**Tech Stack:** Node.js readline, process.stdin raw mode, chalk, fast-glob (existing dep)

**Gaps Closed:** G09, G10, G11, G12, G13, G14, G15, G16, G29, G33

---

### Task 1: Create InputEditor module with basic single-line input

**Files:**
- Create: `src/ui/input.ts`
- Test: `src/__tests__/ui/input.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/input.test.ts
import { describe, it, expect } from 'vitest';
import { InputEditor } from '../../ui/input.js';

describe('InputEditor', () => {
  it('should create with default options', () => {
    const editor = new InputEditor({ prompt: '›' });
    expect(editor).toBeDefined();
    expect(editor.getBuffer()).toBe('');
  });

  it('should track buffer content', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('hello');
    expect(editor.getBuffer()).toBe('hello');
  });

  it('should clear buffer', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('hello');
    editor.clear();
    expect(editor.getBuffer()).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/input.ts
import chalk from 'chalk';

export interface InputEditorOptions {
  prompt: string;
  multiline?: boolean;
  mode?: 'normal' | 'shell' | 'plan' | 'auto';
}

export class InputEditor {
  private buffer = '';
  private cursor = 0;
  private options: Required<InputEditorOptions>;

  constructor(options: InputEditorOptions) {
    this.options = {
      prompt: options.prompt,
      multiline: options.multiline ?? false,
      mode: options.mode ?? 'normal',
    };
  }

  getBuffer(): string {
    return this.buffer;
  }

  insertText(text: string): void {
    this.buffer =
      this.buffer.slice(0, this.cursor) + text + this.buffer.slice(this.cursor);
    this.cursor += text.length;
  }

  clear(): void {
    this.buffer = '';
    this.cursor = 0;
  }

  getPromptDisplay(): string {
    switch (this.options.mode) {
      case 'shell': return chalk.yellow('!') + chalk.dim(' ›');
      case 'plan': return chalk.magenta('plan') + chalk.dim(' ›');
      case 'auto': return chalk.yellow('auto') + chalk.dim(' ›');
      default: return chalk.cyan('›');
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts src/__tests__/ui/input.test.ts
git commit -m "feat(cli): add InputEditor foundation with buffer management"
```

---

### Task 2: Add multiline support to InputEditor (G09)

**Files:**
- Modify: `src/ui/input.ts`
- Modify: `src/__tests__/ui/input.test.ts`

**Step 1: Write the failing test**

```typescript
describe('multiline', () => {
  it('should insert newline in multiline mode', () => {
    const editor = new InputEditor({ prompt: '›', multiline: true });
    editor.insertText('line 1');
    editor.insertNewline();
    editor.insertText('line 2');
    expect(editor.getBuffer()).toBe('line 1\nline 2');
    expect(editor.getLineCount()).toBe(2);
  });

  it('should NOT insert newline in single-line mode', () => {
    const editor = new InputEditor({ prompt: '›', multiline: false });
    editor.insertText('line 1');
    editor.insertNewline();
    expect(editor.getBuffer()).toBe('line 1');
    expect(editor.getLineCount()).toBe(1);
  });

  it('should track cursor position across lines', () => {
    const editor = new InputEditor({ prompt: '›', multiline: true });
    editor.insertText('abc');
    editor.insertNewline();
    editor.insertText('def');
    expect(editor.getCursorLine()).toBe(1);
    expect(editor.getCursorCol()).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: FAIL — methods not found

**Step 3: Write minimal implementation**

Add to `InputEditor` class in `src/ui/input.ts`:

```typescript
insertNewline(): void {
  if (!this.options.multiline) return;
  this.buffer =
    this.buffer.slice(0, this.cursor) + '\n' + this.buffer.slice(this.cursor);
  this.cursor += 1;
}

getLineCount(): number {
  return this.buffer.split('\n').length;
}

getCursorLine(): number {
  return this.buffer.slice(0, this.cursor).split('\n').length - 1;
}

getCursorCol(): number {
  const lines = this.buffer.slice(0, this.cursor).split('\n');
  return lines[lines.length - 1]!.length;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts src/__tests__/ui/input.test.ts
git commit -m "feat(cli): add multiline editing to InputEditor (G09)"
```

---

### Task 3: Add shell mode detection (G12)

**Files:**
- Modify: `src/ui/input.ts`
- Modify: `src/__tests__/ui/input.test.ts`

**Step 1: Write the failing test**

```typescript
describe('shell mode', () => {
  it('should detect shell mode from ! prefix', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('!ls -la');
    expect(editor.isShellMode()).toBe(true);
    expect(editor.getShellCommand()).toBe('ls -la');
  });

  it('should NOT be shell mode without ! prefix', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('hello');
    expect(editor.isShellMode()).toBe(false);
    expect(editor.getShellCommand()).toBeNull();
  });

  it('should exit shell mode when ! is deleted', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('!cmd');
    expect(editor.isShellMode()).toBe(true);
    editor.clear();
    editor.insertText('cmd');
    expect(editor.isShellMode()).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: FAIL — methods not found

**Step 3: Write minimal implementation**

Add to `InputEditor` class:

```typescript
isShellMode(): boolean {
  return this.buffer.startsWith('!');
}

getShellCommand(): string | null {
  if (!this.isShellMode()) return null;
  return this.buffer.slice(1).trim();
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts src/__tests__/ui/input.test.ts
git commit -m "feat(cli): add shell mode detection via ! prefix (G12)"
```

---

### Task 4: Add line range reference parsing (G13)

**Files:**
- Modify: `src/core/fileref.ts`
- Test: `src/__tests__/core/fileref.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/core/fileref.test.ts
import { describe, it, expect } from 'vitest';
import { parseLineRange, extractFileRefParts } from '../../core/fileref.js';

describe('line range parsing', () => {
  it('should parse file:10-20 syntax', () => {
    const result = parseLineRange('src/agent.ts:10-20');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: 10, endLine: 20 });
  });

  it('should parse file:10 single line', () => {
    const result = parseLineRange('src/agent.ts:10');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: 10, endLine: 10 });
  });

  it('should return null for no line range', () => {
    const result = parseLineRange('src/agent.ts');
    expect(result).toEqual({ path: 'src/agent.ts', startLine: null, endLine: null });
  });

  it('should extract @file:range from message', () => {
    const parts = extractFileRefParts('@src/agent.ts:10-20');
    expect(parts).toEqual({ original: '@src/agent.ts:10-20', path: 'src/agent.ts', startLine: 10, endLine: 20 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/core/fileref.test.ts`
Expected: FAIL — functions not exported

**Step 3: Write minimal implementation**

Add to `src/core/fileref.ts`:

```typescript
export interface LineRange {
  path: string;
  startLine: number | null;
  endLine: number | null;
}

export function parseLineRange(ref: string): LineRange {
  const match = ref.match(/^(.+?):(\d+)(?:-(\d+))?$/);
  if (!match) return { path: ref, startLine: null, endLine: null };
  return {
    path: match[1]!,
    startLine: parseInt(match[2]!, 10),
    endLine: match[3] ? parseInt(match[3], 10) : parseInt(match[2]!, 10),
  };
}

export function extractFileRefParts(ref: string): { original: string; path: string; startLine: number | null; endLine: number | null } {
  const withoutAt = ref.startsWith('@') ? ref.slice(1) : ref;
  const range = parseLineRange(withoutAt);
  return { original: ref, ...range };
}
```

Then update `resolveFileRefs` to use `parseLineRange` — when a line range is specified, only include those lines in the resolved content.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/core/fileref.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/core/fileref.ts src/__tests__/core/fileref.test.ts
git commit -m "feat(cli): add line range refs @file:10-20 syntax (G13)"
```

---

### Task 5: Add /editor command for $EDITOR integration (G29)

**Files:**
- Create: `src/commands/editor.ts`
- Test: `src/__tests__/commands/editor.test.ts`
- Modify: `src/commands/chat.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/commands/editor.test.ts
import { describe, it, expect } from 'vitest';
import { getEditorCommand } from '../../commands/editor.js';

describe('/editor', () => {
  it('should detect $EDITOR from environment', () => {
    process.env.EDITOR = 'vim';
    const editor = getEditorCommand();
    expect(editor).toBe('vim');
  });

  it('should fallback to vi if no $EDITOR', () => {
    delete process.env.EDITOR;
    delete process.env.VISUAL;
    const editor = getEditorCommand();
    expect(editor).toBe('vi');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/commands/editor.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/commands/editor.ts
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { nanoid } from 'nanoid';

export function getEditorCommand(): string {
  return process.env.VISUAL || process.env.EDITOR || 'vi';
}

export async function editText(initial = ''): Promise<string | null> {
  const tmpFile = join(tmpdir(), `opta-${nanoid(6)}.md`);
  writeFileSync(tmpFile, initial, 'utf-8');

  const editor = getEditorCommand();
  try {
    execFileSync(editor, [tmpFile], { stdio: 'inherit' });
    const result = readFileSync(tmpFile, 'utf-8');
    unlinkSync(tmpFile);
    return result.trim() || null;
  } catch {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    return null;
  }
}
```

Then add `/editor` case to `handleSlashCommand` in `src/commands/chat.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/commands/editor.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/editor.ts src/__tests__/commands/editor.test.ts src/commands/chat.ts
git commit -m "feat(cli): add /editor command for \$EDITOR integration (G29)"
```

---

### Task 6: Add escape key handling (G33)

**Files:**
- Modify: `src/ui/input.ts`
- Modify: `src/__tests__/ui/input.test.ts`

**Step 1: Write the failing test**

```typescript
describe('escape handling', () => {
  it('should track escape state', () => {
    const editor = new InputEditor({ prompt: '›' });
    expect(editor.shouldCancel()).toBe(false);
    editor.handleEscape();
    expect(editor.shouldCancel()).toBe(true);
  });

  it('should exit shell mode on escape', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('!ls');
    expect(editor.isShellMode()).toBe(true);
    editor.handleEscape();
    expect(editor.isShellMode()).toBe(false);
    expect(editor.getBuffer()).toBe('');
  });

  it('should clear multiline on escape', () => {
    const editor = new InputEditor({ prompt: '›', multiline: true });
    editor.insertText('line 1');
    editor.insertNewline();
    editor.insertText('line 2');
    editor.handleEscape();
    expect(editor.getBuffer()).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: FAIL — methods not found

**Step 3: Write minimal implementation**

Add to `InputEditor` class:

```typescript
private cancelled = false;

handleEscape(): void {
  if (this.buffer.length > 0) {
    this.clear();
  } else {
    this.cancelled = true;
  }
}

shouldCancel(): boolean {
  return this.cancelled;
}

resetCancel(): void {
  this.cancelled = false;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts src/__tests__/ui/input.test.ts
git commit -m "feat(cli): add escape key handling to InputEditor (G33)"
```

---

### Task 7: Add paste detection (G10)

**Files:**
- Modify: `src/ui/input.ts`
- Modify: `src/__tests__/ui/input.test.ts`

**Step 1: Write the failing test**

```typescript
describe('paste detection', () => {
  it('should detect multi-line paste', () => {
    const editor = new InputEditor({ prompt: '›' });
    const result = editor.handlePaste('line1\nline2\nline3');
    expect(result.isPaste).toBe(true);
    expect(result.lineCount).toBe(3);
    expect(result.abbreviated).toBe('[Pasted ~3 lines]');
  });

  it('should NOT detect single-line as paste', () => {
    const editor = new InputEditor({ prompt: '›' });
    const result = editor.handlePaste('just text');
    expect(result.isPaste).toBe(false);
  });

  it('should store full paste content while showing abbreviated', () => {
    const editor = new InputEditor({ prompt: '›' });
    const result = editor.handlePaste('a\nb\nc\nd\ne');
    expect(result.isPaste).toBe(true);
    expect(result.fullContent).toBe('a\nb\nc\nd\ne');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: FAIL — method not found

**Step 3: Write minimal implementation**

Add to `InputEditor` class:

```typescript
private pastedContent: string | null = null;

handlePaste(text: string): { isPaste: boolean; lineCount: number; abbreviated: string; fullContent: string } {
  const lines = text.split('\n');
  const isPaste = lines.length > 1;

  if (isPaste) {
    this.pastedContent = text;
    const abbreviated = `[Pasted ~${lines.length} lines]`;
    this.insertText(abbreviated);
    return { isPaste: true, lineCount: lines.length, abbreviated, fullContent: text };
  }

  this.insertText(text);
  return { isPaste: false, lineCount: 1, abbreviated: text, fullContent: text };
}

getSubmitText(): string {
  if (this.pastedContent) {
    return this.buffer.replace(/\[Pasted ~\d+ lines\]/, this.pastedContent);
  }
  return this.buffer;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts src/__tests__/ui/input.test.ts
git commit -m "feat(cli): add paste detection with abbreviated display (G10)"
```

---

### Task 8: Add @ file autocomplete with fuzzy matching (G11)

**Files:**
- Create: `src/ui/autocomplete.ts`
- Test: `src/__tests__/ui/autocomplete.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/autocomplete.test.ts
import { describe, it, expect } from 'vitest';
import { fuzzyMatch, getCompletions } from '../../ui/autocomplete.js';

describe('fuzzy match', () => {
  it('should match substring', () => {
    expect(fuzzyMatch('agent', 'src/core/agent.ts')).toBe(true);
    expect(fuzzyMatch('xyz', 'src/core/agent.ts')).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(fuzzyMatch('Agent', 'src/core/agent.ts')).toBe(true);
  });
});

describe('getCompletions', () => {
  it('should return file matches for @ trigger', () => {
    const files = ['src/core/agent.ts', 'src/core/tools.ts', 'src/ui/box.ts'];
    const results = getCompletions('ag', files);
    expect(results).toContain('src/core/agent.ts');
    expect(results).not.toContain('src/ui/box.ts');
  });

  it('should limit results', () => {
    const files = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
    const results = getCompletions('file', files, 10);
    expect(results.length).toBeLessThanOrEqual(10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/autocomplete.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/autocomplete.ts
import fg from 'fast-glob';

export function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

export function getCompletions(query: string, files: string[], limit = 15): string[] {
  return files
    .filter(f => fuzzyMatch(query, f))
    .sort((a, b) => {
      const aBase = a.split('/').pop()!.toLowerCase();
      const bBase = b.split('/').pop()!.toLowerCase();
      const q = query.toLowerCase();
      const aStart = aBase.startsWith(q) ? 0 : 1;
      const bStart = bBase.startsWith(q) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      return a.length - b.length;
    })
    .slice(0, limit);
}

export async function getProjectFiles(cwd: string): Promise<string[]> {
  return fg(['**/*'], {
    cwd,
    ignore: ['node_modules/**', 'dist/**', '.git/**', '.next/**', '*.lock'],
    onlyFiles: true,
    dot: false,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/autocomplete.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/autocomplete.ts src/__tests__/ui/autocomplete.test.ts
git commit -m "feat(cli): add fuzzy file autocomplete for @ trigger (G11)"
```

---

### Task 9: Add input history with Up/Down navigation (G15)

**Files:**
- Create: `src/ui/history.ts`
- Test: `src/__tests__/ui/history.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/history.test.ts
import { describe, it, expect } from 'vitest';
import { InputHistory } from '../../ui/history.js';

describe('InputHistory', () => {
  it('should store entries', () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    expect(history.size()).toBe(2);
  });

  it('should navigate up through history', () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    history.startNavigation();
    expect(history.previous()).toBe('second');
    expect(history.previous()).toBe('first');
    expect(history.previous()).toBe('first');
  });

  it('should navigate down through history', () => {
    const history = new InputHistory();
    history.push('first');
    history.push('second');
    history.startNavigation();
    history.previous();
    history.previous();
    expect(history.next()).toBe('second');
    expect(history.next()).toBe('');
  });

  it('should not duplicate consecutive entries', () => {
    const history = new InputHistory();
    history.push('same');
    history.push('same');
    expect(history.size()).toBe(1);
  });

  it('should limit history size', () => {
    const history = new InputHistory(5);
    for (let i = 0; i < 10; i++) history.push(`entry${i}`);
    expect(history.size()).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/history.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/history.ts
export class InputHistory {
  private entries: string[] = [];
  private index = -1;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  push(entry: string): void {
    const trimmed = entry.trim();
    if (!trimmed) return;
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) return;
    this.entries.push(trimmed);
    if (this.entries.length > this.maxSize) this.entries.shift();
    this.index = -1;
  }

  startNavigation(): void {
    this.index = this.entries.length;
  }

  previous(): string {
    if (this.entries.length === 0) return '';
    if (this.index > 0) this.index--;
    return this.entries[this.index] ?? '';
  }

  next(): string {
    if (this.index < this.entries.length - 1) {
      this.index++;
      return this.entries[this.index]!;
    }
    this.index = this.entries.length;
    return '';
  }

  size(): number {
    return this.entries.length;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/history.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/history.ts src/__tests__/ui/history.test.ts
git commit -m "feat(cli): add input history with up/down navigation (G15)"
```

---

### Task 10: Add visual mode indicators to prompt (G16)

**Files:**
- Modify: `src/ui/input.ts`
- Modify: `src/__tests__/ui/input.test.ts`

**Step 1: Write the failing test**

```typescript
describe('mode indicators', () => {
  it('should show shell mode indicator', () => {
    const editor = new InputEditor({ prompt: '›', mode: 'shell' });
    const display = editor.getPromptDisplay();
    expect(display).toContain('!');
  });

  it('should show plan mode indicator', () => {
    const editor = new InputEditor({ prompt: '›', mode: 'plan' });
    const display = editor.getPromptDisplay();
    expect(display).toContain('plan');
  });

  it('should update mode dynamically', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.setMode('shell');
    expect(editor.getPromptDisplay()).toContain('!');
    editor.setMode('normal');
    expect(editor.getPromptDisplay()).not.toContain('!');
  });

  it('should auto-detect shell mode from buffer', () => {
    const editor = new InputEditor({ prompt: '›' });
    editor.insertText('!ls');
    expect(editor.getEffectiveMode()).toBe('shell');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: FAIL — methods not found

**Step 3: Write minimal implementation**

Add to `InputEditor` class:

```typescript
setMode(mode: InputEditorOptions['mode']): void {
  this.options.mode = mode ?? 'normal';
}

getEffectiveMode(): string {
  if (this.isShellMode()) return 'shell';
  return this.options.mode;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/input.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/input.ts src/__tests__/ui/input.test.ts
git commit -m "feat(cli): add dynamic visual mode indicators (G16)"
```

---

### Task 11: Wire InputEditor into chat.ts REPL loop

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Import InputEditor and InputHistory**

```typescript
import { InputEditor } from '../ui/input.js';
import { InputHistory } from '../ui/history.js';
```

**Step 2: Create history instance near top of startChat**

```typescript
const history = new InputHistory();
```

**Step 3: After receiving input, push to history**

```typescript
history.push(userInput);
```

Keep the existing `@inquirer/prompts input()` call for now — the InputEditor will fully replace it in Phase 2. For Phase 1, it provides buffer management, mode detection, and history that the chat loop reads from.

**Step 4: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): wire InputEditor and history into chat REPL loop"
```

---

### Task 12: Add shell mode execution in chat loop (G12 wiring)

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add shell mode handler after slash commands**

After the `if (userInput.startsWith('/'))` block, add:

```typescript
// Shell mode: !command executes directly
if (userInput.startsWith('!')) {
  const cmd = userInput.slice(1).trim();
  if (!cmd) continue;
  console.log(chalk.dim(`  $ ${cmd}`));
  try {
    const { execFileSync } = await import('node:child_process');
    // Split command into program + args for safe execution
    const parts = cmd.split(/\s+/);
    const program = parts[0]!;
    const args = parts.slice(1);
    const output = execFileSync(program, args, { encoding: 'utf-8', cwd: process.cwd(), timeout: 30000 });
    if (output.trim()) console.log(output);
    console.log(chalk.green('✓') + chalk.dim(' exit 0'));
  } catch (err: unknown) {
    const e = err as { status?: number; stderr?: string; stdout?: string };
    if (e.stdout) console.log(e.stdout);
    if (e.stderr) console.error(chalk.red(e.stderr));
    console.log(chalk.red('✗') + chalk.dim(` exit ${e.status ?? 1}`));
  }
  continue;
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add ! shell mode execution in chat loop (G12)"
```

---

### Task 13: Add /image enhancement for path-less image attach (G14)

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Enhance /image help text and UX**

Improve the `/image` command with better help and glob hints. Full clipboard paste requires Ink (Phase 2), but we improve the file-based UX now:

```typescript
case '/image': {
  if (!arg) {
    console.log(chalk.dim('  Usage: /image <path> [question]'));
    console.log(chalk.dim('  Examples:'));
    console.log(chalk.dim('    /image screenshot.png What is this?'));
    console.log(chalk.dim('    /image ./designs/mockup.png Review this'));
    return 'handled';
  }
  // ... existing implementation
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): enhance /image command UX (G14)"
```

---

### Task 14: Wire @ autocomplete hints into chat loop (G11 wiring)

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add autocomplete hint display after @ input**

When the user submits input containing `@` followed by text, show matching file suggestions as a hint:

```typescript
// After receiving userInput, before sending to agent:
if (userInput.includes('@') && !userInput.startsWith('/')) {
  const { getProjectFiles, getCompletions } = await import('../ui/autocomplete.js');
  const atMatch = userInput.match(/@(\S*)$/);
  if (atMatch?.[1]) {
    const files = await getProjectFiles(process.cwd());
    const matches = getCompletions(atMatch[1], files, 5);
    if (matches.length > 0 && matches[0] !== atMatch[1]) {
      console.log(chalk.dim('  Matches: ') + matches.map(f => chalk.cyan(`@${f}`)).join(chalk.dim(', ')));
    }
  }
}
```

This is a lightweight hint system. Full interactive autocomplete with cursor-position completion comes in Phase 2 (Ink).

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add @ file autocomplete hints in chat loop (G11)"
```

---

## Summary

| Task | Gap | What It Does |
|------|-----|-------------|
| 1 | Foundation | InputEditor module with buffer management |
| 2 | G09 | Multiline editing (insertNewline, line tracking) |
| 3 | G12 | Shell mode detection (! prefix) |
| 4 | G13 | Line range refs (@file:10-20) |
| 5 | G29 | /editor command ($EDITOR integration) |
| 6 | G33 | Escape key handling (clear/cancel) |
| 7 | G10 | Paste detection (abbreviated display) |
| 8 | G11 | @ file autocomplete (fuzzy matching) |
| 9 | G15 | Input history (Up/Down navigation) |
| 10 | G16 | Visual mode indicators (dynamic prompt) |
| 11 | — | Wire InputEditor into chat REPL |
| 12 | G12 | Wire shell mode execution |
| 13 | G14 | Enhance /image command UX |
| 14 | G11 | Wire @ autocomplete hints |

**Total:** 14 tasks, 10 gaps addressed (G09, G10, G11, G12, G13, G14, G15, G16, G29, G33)
