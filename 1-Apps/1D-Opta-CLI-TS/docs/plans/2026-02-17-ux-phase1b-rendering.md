# Phase 1B: Rendering & Display Enhancements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tool call cards, inline diff viewer, theme system, thinking toggle, and improved syntax highlighting to Opta CLI's rendering pipeline — all within the current chalk + marked-terminal stack.

**Architecture:** Create rendering modules that transform tool call data and diff output into visually rich terminal displays. Add a theme layer that wraps chalk colors in configurable theme tokens. Enhance ThinkingRenderer with interactive expand/collapse (via keypress).

**Tech Stack:** chalk, marked, marked-terminal, Node.js child_process (execFileSync for git diff)

**Gaps Closed:** G17, G18, G19, G20, G21

---

### Task 1: Create tool call card renderer (G18)

**Files:**
- Create: `src/ui/toolcards.ts`
- Test: `src/__tests__/ui/toolcards.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/toolcards.test.ts
import { describe, it, expect } from 'vitest';
import { formatToolCall, formatToolResult } from '../../ui/toolcards.js';

describe('tool call cards', () => {
  it('should format read_file call', () => {
    const output = formatToolCall('read_file', { path: 'src/agent.ts' });
    expect(output).toContain('read_file');
    expect(output).toContain('src/agent.ts');
  });

  it('should format edit_file call with diff preview', () => {
    const output = formatToolCall('edit_file', {
      path: 'src/agent.ts',
      old_text: 'const x = 1;',
      new_text: 'const x = 2;',
    });
    expect(output).toContain('edit_file');
    expect(output).toContain('src/agent.ts');
  });

  it('should format run_command call', () => {
    const output = formatToolCall('run_command', { command: 'npm test' });
    expect(output).toContain('run_command');
    expect(output).toContain('npm test');
  });

  it('should format tool result with truncation', () => {
    const longResult = 'x'.repeat(500);
    const output = formatToolResult('read_file', longResult);
    expect(output.length).toBeLessThan(400);
  });

  it('should format write_file with line count', () => {
    const output = formatToolCall('write_file', {
      path: 'new-file.ts',
      content: 'line1\nline2\nline3',
    });
    expect(output).toContain('3 lines');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/toolcards.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/toolcards.ts
import chalk from 'chalk';

const TOOL_ICONS: Record<string, string> = {
  read_file: '📄',
  write_file: '✏️',
  edit_file: '🔧',
  list_dir: '📁',
  search_files: '🔍',
  find_files: '🔎',
  run_command: '⚡',
  ask_user: '💬',
};

export function formatToolCall(name: string, args: Record<string, unknown>): string {
  const icon = TOOL_ICONS[name] || '🔧';
  const parts: string[] = [];

  parts.push(chalk.dim('  ┌─') + ` ${icon} ${chalk.bold(name)}`);

  switch (name) {
    case 'read_file':
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path)));
      if (args.offset || args.limit) {
        parts.push(chalk.dim('  │ ') + chalk.dim(`lines ${args.offset ?? 1}-${(args.offset as number ?? 0) + (args.limit as number ?? 0)}`));
      }
      break;

    case 'write_file': {
      const content = String(args.content ?? '');
      const lineCount = content.split('\n').length;
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path)) + chalk.dim(` (${lineCount} lines)`));
      break;
    }

    case 'edit_file':
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path)));
      if (args.old_text && args.new_text) {
        const oldLines = String(args.old_text).split('\n').length;
        const newLines = String(args.new_text).split('\n').length;
        parts.push(chalk.dim('  │ ') + chalk.red(`- ${oldLines} line${oldLines > 1 ? 's' : ''}`) +
          chalk.dim(' → ') + chalk.green(`+ ${newLines} line${newLines > 1 ? 's' : ''}`));
      }
      break;

    case 'run_command':
      parts.push(chalk.dim('  │ ') + chalk.yellow(`$ ${String(args.command)}`));
      break;

    case 'search_files':
      parts.push(chalk.dim('  │ ') + chalk.yellow(`/${String(args.pattern)}/`));
      if (args.path) parts.push(chalk.dim('  │ ') + chalk.dim(`in ${args.path}`));
      break;

    case 'list_dir':
      parts.push(chalk.dim('  │ ') + chalk.cyan(String(args.path || '.')));
      break;

    case 'ask_user':
      parts.push(chalk.dim('  │ ') + chalk.italic(String(args.question ?? '').slice(0, 60)));
      break;

    default:
      for (const [k, v] of Object.entries(args)) {
        const val = String(v).slice(0, 50);
        parts.push(chalk.dim('  │ ') + chalk.dim(`${k}: `) + val);
      }
  }

  parts.push(chalk.dim('  └─'));
  return parts.join('\n');
}

export function formatToolResult(name: string, result: string, maxLen = 300): string {
  const trimmed = result.length > maxLen
    ? result.slice(0, maxLen) + chalk.dim(`... (${result.length} chars total)`)
    : result;

  if (name === 'run_command') {
    return chalk.dim('  ') + trimmed.split('\n').map(l => chalk.dim('  │ ') + l).join('\n');
  }

  return chalk.dim('  ') + trimmed.split('\n').slice(0, 10).map(l => chalk.dim('  │ ') + l).join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/toolcards.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/toolcards.ts src/__tests__/ui/toolcards.test.ts
git commit -m "feat(cli): add styled tool call card renderer (G18)"
```

---

### Task 2: Wire tool cards into agent loop

**Files:**
- Modify: `src/core/agent.ts` (import and use formatToolCall)

**Step 1: Find tool call display code in agent.ts**

Read agent.ts to find where tool calls are currently displayed. Look for the section that prints tool name + args.

**Step 2: Import and wire toolcards**

Add import at top of agent.ts:
```typescript
import { formatToolCall, formatToolResult } from '../ui/toolcards.js';
```

Replace the existing tool call display (likely something like `console.log(chalk.dim(...))`) with:
```typescript
console.log(formatToolCall(toolCall.function.name, args));
```

And after tool execution, replace result display with:
```typescript
console.log(formatToolResult(toolCall.function.name, resultText));
```

**Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/core/agent.ts
git commit -m "feat(cli): wire tool call cards into agent loop (G18)"
```

---

### Task 3: Create inline diff renderer (G19)

**Files:**
- Create: `src/ui/diff.ts`
- Test: `src/__tests__/ui/diff.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/diff.test.ts
import { describe, it, expect } from 'vitest';
import { formatUnifiedDiff, formatInlineDiff } from '../../ui/diff.js';

describe('diff rendering', () => {
  it('should format unified diff with colors', () => {
    const diff = `--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 const a = 1;
-const b = 2;
+const b = 3;
 const c = 4;`;
    const output = formatUnifiedDiff(diff);
    expect(output).toContain('file.ts');
  });

  it('should format inline diff between old and new text', () => {
    const output = formatInlineDiff('const x = 1;', 'const x = 2;');
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });

  it('should handle multi-line diffs', () => {
    const old = 'line1\nline2\nline3';
    const new_ = 'line1\nmodified\nline3';
    const output = formatInlineDiff(old, new_);
    expect(output).toContain('modified');
  });

  it('should handle additions', () => {
    const old = 'line1\nline2';
    const new_ = 'line1\nnew line\nline2';
    const output = formatInlineDiff(old, new_);
    expect(output).toContain('new line');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/diff.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/diff.ts
import chalk from 'chalk';

export function formatUnifiedDiff(diff: string): string {
  const lines = diff.split('\n');
  const out: string[] = [];

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      out.push(chalk.bold(line));
    } else if (line.startsWith('@@')) {
      out.push(chalk.cyan(line));
    } else if (line.startsWith('+')) {
      out.push(chalk.green(line));
    } else if (line.startsWith('-')) {
      out.push(chalk.red(line));
    } else {
      out.push(chalk.dim(line));
    }
  }

  return out.join('\n');
}

export function formatInlineDiff(oldText: string, newText: string): string {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const out: string[] = [];

  let i = 0, j = 0;

  while (i < oldLines.length || j < newLines.length) {
    const oldLine = oldLines[i];
    const newLine = newLines[j];

    if (oldLine === newLine) {
      out.push(chalk.dim('  ') + (oldLine ?? ''));
      i++; j++;
    } else if (oldLine !== undefined && !newLines.includes(oldLine)) {
      out.push(chalk.red('- ') + chalk.red(oldLine));
      i++;
    } else if (newLine !== undefined && !oldLines.includes(newLine)) {
      out.push(chalk.green('+ ') + chalk.green(newLine));
      j++;
    } else {
      if (oldLine !== undefined) {
        out.push(chalk.red('- ') + chalk.red(oldLine));
        i++;
      }
      if (newLine !== undefined) {
        out.push(chalk.green('+ ') + chalk.green(newLine));
        j++;
      }
    }
  }

  return out.join('\n');
}

export function formatDiffStat(stat: string): string {
  const lines = stat.trim().split('\n');
  const out: string[] = [];

  for (const line of lines) {
    const colored = line
      .replace(/(\++)/g, chalk.green('$1'))
      .replace(/(-+)/g, chalk.red('$1'));
    out.push('  ' + colored);
  }

  return out.join('\n');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/diff.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/diff.ts src/__tests__/ui/diff.test.ts
git commit -m "feat(cli): add inline diff renderer with unified + line-by-line modes (G19)"
```

---

### Task 4: Enhance /diff command with inline diff display

**Files:**
- Modify: `src/commands/chat.ts` (enhance /diff handler)

**Step 1: Enhance /diff to show full unified diff**

Replace the current `/diff` handler with an enhanced version using `execFileSync` (safe, no shell injection):

```typescript
case '/diff': {
  try {
    const { execFileSync } = await import('node:child_process');
    const { formatUnifiedDiff } = await import('../ui/diff.js');

    const stat = execFileSync('git', ['diff', '--stat'], { encoding: 'utf-8', cwd: process.cwd() });
    if (!stat.trim()) {
      console.log(chalk.dim('  No uncommitted changes'));
      return 'handled';
    }

    // Show stat summary in a box
    const statLines = stat.trim().split('\n');
    const summary = statLines[statLines.length - 1] ?? '';
    const fileLines = statLines.slice(0, -1).map(l => ' ' + l.trim());
    console.log('\n' + box('Changes', [...fileLines, '', chalk.dim(summary.trim())]));

    // If user passed a file, show full diff for that file
    if (arg) {
      const fullDiff = execFileSync('git', ['diff', '--', arg], { encoding: 'utf-8', cwd: process.cwd() });
      if (fullDiff.trim()) {
        console.log('\n' + formatUnifiedDiff(fullDiff));
      }
    } else {
      console.log(chalk.dim('  Tip: /diff <file> for inline diff'));
    }
  } catch {
    console.log(chalk.dim('  Not a git repository'));
  }
  return 'handled';
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): enhance /diff with inline unified diff display (G19)"
```

---

### Task 5: Create theme system (G20)

**Files:**
- Create: `src/ui/theme.ts`
- Test: `src/__tests__/ui/theme.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/theme.test.ts
import { describe, it, expect } from 'vitest';
import { getTheme, setTheme, listThemes } from '../../ui/theme.js';

describe('theme system', () => {
  it('should have default theme', () => {
    const theme = getTheme();
    expect(theme.name).toBe('opta');
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.success).toBeDefined();
    expect(theme.colors.error).toBeDefined();
  });

  it('should list available themes', () => {
    const themes = listThemes();
    expect(themes.length).toBeGreaterThanOrEqual(3);
    expect(themes.map(t => t.name)).toContain('opta');
    expect(themes.map(t => t.name)).toContain('minimal');
    expect(themes.map(t => t.name)).toContain('solarized');
  });

  it('should switch themes', () => {
    setTheme('minimal');
    const theme = getTheme();
    expect(theme.name).toBe('minimal');
    setTheme('opta'); // reset
  });

  it('should apply theme colors', () => {
    const theme = getTheme();
    const styled = theme.primary('hello');
    expect(styled).toBeDefined();
    expect(typeof styled).toBe('string');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/theme.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/ui/theme.ts
import chalk, { type ChalkInstance } from 'chalk';

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  muted: string;
  text: string;
  border: string;
}

export interface Theme {
  name: string;
  description: string;
  colors: ThemeColors;
  primary: ChalkInstance;
  secondary: ChalkInstance;
  success: ChalkInstance;
  error: ChalkInstance;
  warning: ChalkInstance;
  info: ChalkInstance;
  muted: ChalkInstance;
  dim: ChalkInstance;
}

const THEMES: Record<string, { description: string; colors: ThemeColors }> = {
  opta: {
    description: 'Default Opta theme — Electric Violet accent',
    colors: {
      primary: '#8B5CF6',
      secondary: '#3B82F6',
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#06B6D4',
      muted: '#52525B',
      text: '#FAFAFA',
      border: '#3F3F46',
    },
  },
  minimal: {
    description: 'Minimal — muted grays, no color accents',
    colors: {
      primary: '#A1A1AA',
      secondary: '#71717A',
      success: '#A1A1AA',
      error: '#F87171',
      warning: '#FCD34D',
      info: '#A1A1AA',
      muted: '#52525B',
      text: '#E4E4E7',
      border: '#3F3F46',
    },
  },
  solarized: {
    description: 'Solarized Dark — warm tones',
    colors: {
      primary: '#268BD2',
      secondary: '#2AA198',
      success: '#859900',
      error: '#DC322F',
      warning: '#B58900',
      info: '#6C71C4',
      muted: '#586E75',
      text: '#FDF6E3',
      border: '#073642',
    },
  },
  dracula: {
    description: 'Dracula — purple and cyan',
    colors: {
      primary: '#BD93F9',
      secondary: '#8BE9FD',
      success: '#50FA7B',
      error: '#FF5555',
      warning: '#F1FA8C',
      info: '#8BE9FD',
      muted: '#6272A4',
      text: '#F8F8F2',
      border: '#44475A',
    },
  },
  catppuccin: {
    description: 'Catppuccin Mocha — pastel colors',
    colors: {
      primary: '#CBA6F7',
      secondary: '#89B4FA',
      success: '#A6E3A1',
      error: '#F38BA8',
      warning: '#F9E2AF',
      info: '#74C7EC',
      muted: '#585B70',
      text: '#CDD6F4',
      border: '#45475A',
    },
  },
};

let currentThemeName = 'opta';

function buildTheme(name: string): Theme {
  const def = THEMES[name] ?? THEMES['opta']!;
  const colors = def.colors;

  return {
    name,
    description: def.description,
    colors,
    primary: chalk.hex(colors.primary),
    secondary: chalk.hex(colors.secondary),
    success: chalk.hex(colors.success),
    error: chalk.hex(colors.error),
    warning: chalk.hex(colors.warning),
    info: chalk.hex(colors.info),
    muted: chalk.hex(colors.muted),
    dim: chalk.dim,
  };
}

export function getTheme(): Theme {
  return buildTheme(currentThemeName);
}

export function setTheme(name: string): void {
  if (THEMES[name]) {
    currentThemeName = name;
  }
}

export function listThemes(): Array<{ name: string; description: string }> {
  return Object.entries(THEMES).map(([name, def]) => ({
    name,
    description: def.description,
  }));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/theme.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/theme.ts src/__tests__/ui/theme.test.ts
git commit -m "feat(cli): add theme system with 5 built-in themes (G20)"
```

---

### Task 6: Add /theme slash command

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add /theme handler**

```typescript
case '/theme': {
  const { getTheme, setTheme, listThemes } = await import('../ui/theme.js');
  if (!arg) {
    const themes = listThemes();
    const current = getTheme();
    console.log('\n' + box('Themes', themes.map(t =>
      (t.name === current.name ? chalk.green('● ') : chalk.dim('  ')) +
      chalk.cyan(t.name.padEnd(14)) + chalk.dim(t.description)
    )));
    console.log(chalk.dim('  Usage: /theme <name>\n'));
    return 'handled';
  }
  setTheme(arg);
  const theme = getTheme();
  if (theme.name === arg) {
    console.log(chalk.green('✓') + ` Theme: ${theme.primary(theme.name)}`);
  } else {
    console.log(chalk.yellow(`  Unknown theme: ${arg}. Try /theme to see options.`));
  }
  return 'handled';
}
```

Also add `/theme` to the help menu and `/` browse menu.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add /theme command for switching themes (G20)"
```

---

### Task 7: Enhance thinking renderer with expand/collapse (G17)

**Files:**
- Modify: `src/ui/thinking.ts`
- Test: `src/__tests__/ui/thinking.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/thinking.test.ts
import { describe, it, expect } from 'vitest';
import { ThinkingRenderer } from '../../ui/thinking.js';

describe('ThinkingRenderer', () => {
  it('should process thinking tags', () => {
    const renderer = new ThinkingRenderer();
    const result1 = renderer.process('<think>reasoning here</think>actual output');
    expect(result1).toContain('actual output');
  });

  it('should track thinking content for toggle', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('<think>my reasoning</think>output');
    expect(renderer.getThinkingText()).toContain('my reasoning');
    expect(renderer.hasThinking()).toBe(true);
  });

  it('should generate collapsed summary', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('<think>a long reasoning process</think>output');
    const summary = renderer.getCollapsedSummary();
    expect(summary).toContain('thinking');
    expect(summary).toContain('tokens');
  });

  it('should generate expanded view', () => {
    const renderer = new ThinkingRenderer();
    renderer.process('<think>detailed reasoning</think>output');
    const expanded = renderer.getExpandedView();
    expect(expanded).toContain('detailed reasoning');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/thinking.test.ts`
Expected: FAIL — methods not found

**Step 3: Write minimal implementation**

Add to `ThinkingRenderer` class in `src/ui/thinking.ts`:

```typescript
getThinkingText(): string {
  return this.thinkText;
}

hasThinking(): boolean {
  return this.thinkText.length > 0;
}

getCollapsedSummary(): string {
  const tokens = Math.ceil(this.thinkText.length / 4);
  return chalk.dim(`  ⚙ thinking (${tokens} tokens) `) + chalk.dim.italic('[/expand to view]');
}

getExpandedView(): string {
  const lines = this.thinkText.split('\n');
  const formatted = lines.map(l => chalk.dim('  │ ') + chalk.dim.italic(l)).join('\n');
  const tokens = Math.ceil(this.thinkText.length / 4);
  return chalk.dim(`  ⚙ thinking (${tokens} tokens)\n`) + formatted + '\n' + chalk.dim('  └─');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/thinking.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/thinking.ts src/__tests__/ui/thinking.test.ts
git commit -m "feat(cli): add expand/collapse thinking display (G17)"
```

---

### Task 8: Add /expand slash command for thinking toggle

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add /expand handler**

Track the last ThinkingRenderer instance so we can toggle. Add to `ChatState`:

```typescript
export interface ChatState {
  currentMode: OptaMode;
  lastThinkingRenderer?: import('../ui/thinking.js').ThinkingRenderer;
  thinkingExpanded?: boolean;
}
```

Add handler:

```typescript
case '/expand':
case '/think': {
  if (!state.lastThinkingRenderer?.hasThinking()) {
    console.log(chalk.dim('  No thinking to display'));
    return 'handled';
  }
  if (state.thinkingExpanded) {
    console.log(state.lastThinkingRenderer.getCollapsedSummary());
    state.thinkingExpanded = false;
  } else {
    console.log(state.lastThinkingRenderer.getExpandedView());
    state.thinkingExpanded = true;
  }
  return 'handled';
}
```

Wire the ThinkingRenderer from agent.ts to be accessible in chat state after each turn.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add /expand command for thinking toggle (G17)"
```

---

### Task 9: Improve syntax highlighting in code blocks (G21)

**Files:**
- Modify: `src/ui/markdown.ts`

**Step 1: Enhance marked-terminal configuration**

Read current `markdown.ts` to understand the setup. Then enhance with better code block highlighting by updating the marked-terminal options for code blocks to use box-drawn borders.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/markdown.ts
git commit -m "feat(cli): enhance syntax highlighting in code blocks (G21)"
```

---

### Task 10: Wire theme colors into existing UI components

**Files:**
- Modify: `src/ui/box.ts` (use theme colors)
- Modify: `src/ui/toolcards.ts` (use theme colors)

**Step 1: Update box.ts to use theme**

Import `getTheme` and use theme colors for accents while keeping `chalk.dim` for borders.

**Step 2: Update toolcards.ts to use theme**

Similar theme color replacement.

**Step 3: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/ui/box.ts src/ui/toolcards.ts
git commit -m "feat(cli): wire theme system into UI components (G20)"
```

---

### Task 11: Add edit_file diff preview in tool cards

**Files:**
- Modify: `src/ui/toolcards.ts`

**Step 1: Enhance edit_file card with inline diff**

Import `formatInlineDiff` from `./diff.js` and use it in the edit_file case of `formatToolCall`.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/ui/toolcards.ts
git commit -m "feat(cli): add inline diff preview in edit_file tool cards (G19)"
```

---

### Task 12: Run full test suite and typecheck

**Step 1: Run all checks**

Run: `npm run typecheck && npm test && npm run lint`
Expected: All pass

**Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(cli): resolve Phase 1B typecheck and lint issues"
```

---

## Summary

| Task | Gap | What It Does |
|------|-----|-------------|
| 1 | G18 | Tool call card renderer module |
| 2 | G18 | Wire tool cards into agent loop |
| 3 | G19 | Inline diff renderer (unified + line-by-line) |
| 4 | G19 | Enhance /diff with full inline diff |
| 5 | G20 | Theme system (5 built-in themes) |
| 6 | G20 | /theme slash command |
| 7 | G17 | Thinking expand/collapse methods |
| 8 | G17 | /expand slash command |
| 9 | G21 | Enhanced syntax highlighting in code blocks |
| 10 | G20 | Wire theme into UI components |
| 11 | G19 | Edit_file diff preview in tool cards |
| 12 | — | Full test suite verification |

**Total:** 12 tasks, 5 gaps addressed (G17, G18, G19, G20, G21)
