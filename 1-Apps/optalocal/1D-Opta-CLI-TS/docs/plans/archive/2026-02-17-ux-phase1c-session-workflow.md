---
status: archived
---

# Phase 1C: Session & Workflow Enhancements

> **Status: SUPERSEDED** — Goals achieved via TUI overlays (SessionPicker, ModelPicker, slash commands, session analytics). Verified 2026-02-27.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive session picker, model picker, JSON export, session analytics, server mode, agent picker, and non-interactive mode improvements — completing all Session & State and Commands & Workflow gaps.

**Architecture:** Enhance existing slash commands with interactive `@inquirer/prompts select()` pickers. Add analytics tracking to session store. Create lightweight HTTP server for server mode. All within current Commander.js stack.

**Tech Stack:** @inquirer/prompts, Node.js http, conf (existing deps)

**Gaps Closed:** G22, G23, G24, G25, G26, G27, G28, G30

---

### Task 1: Add JSON export to /share (G22)

**Files:**
- Create: `src/commands/share.ts`
- Test: `src/__tests__/commands/share.test.ts`
- Modify: `src/commands/chat.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/commands/share.test.ts
import { describe, it, expect } from 'vitest';
import { formatSessionExport } from '../../commands/share.js';

describe('session export', () => {
  it('should export as markdown', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'markdown');
    expect(result).toContain('# Opta CLI Session');
    expect(result).toContain('hello');
  });

  it('should export as JSON', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.id).toBe('test-123');
    expect(parsed.messages).toHaveLength(2);
  });

  it('should export as text', () => {
    const result = formatSessionExport({
      id: 'test-123',
      model: 'Qwen2.5-72B',
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
      ],
    }, 'text');
    expect(result).toContain('User: hello');
    expect(result).toContain('Assistant: hi there');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/commands/share.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/commands/share.ts
export type ExportFormat = 'markdown' | 'json' | 'text';

interface ExportInput {
  id: string;
  model: string;
  messages: Array<{ role: string; content: string | unknown }>;
  title?: string;
  created?: string;
  toolCallCount?: number;
}

export function formatSessionExport(session: ExportInput, format: ExportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        id: session.id,
        model: session.model,
        title: session.title,
        created: session.created ?? new Date().toISOString(),
        messages: session.messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : '[multimodal]',
          })),
        toolCallCount: session.toolCallCount ?? 0,
      }, null, 2);

    case 'text': {
      const lines: string[] = [];
      lines.push(`Session: ${session.id}`);
      lines.push(`Model: ${session.model}`);
      lines.push(`Date: ${session.created ?? new Date().toISOString()}`);
      lines.push('');
      for (const m of session.messages) {
        if (m.role === 'system') continue;
        const content = typeof m.content === 'string' ? m.content : '[multimodal]';
        const label = m.role === 'user' ? 'User' : 'Assistant';
        lines.push(`${label}: ${content}`);
        lines.push('');
      }
      return lines.join('\n');
    }

    case 'markdown':
    default: {
      let md = `# Opta CLI Session\n\n`;
      md += `- **Session:** ${session.id}\n`;
      md += `- **Model:** ${session.model}\n`;
      md += `- **Date:** ${session.created ?? new Date().toISOString()}\n\n---\n\n`;
      for (const m of session.messages) {
        if (m.role === 'system') continue;
        const content = typeof m.content === 'string' ? m.content : '[multimodal]';
        md += m.role === 'user' ? `## User\n\n${content}\n\n` : `## Assistant\n\n${content}\n\n`;
      }
      return md;
    }
  }
}
```

Then update `/share` in `chat.ts` to use the new format picker via `@inquirer/prompts select()`.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/commands/share.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/commands/share.ts src/__tests__/commands/share.test.ts src/commands/chat.ts
git commit -m "feat(cli): add JSON and text export formats to /share (G22)"
```

---

### Task 2: Add post-response token display (G23)

**Files:**
- Modify: `src/ui/statusbar.ts`
- Test: `src/__tests__/ui/statusbar.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/ui/statusbar.test.ts
import { describe, it, expect } from 'vitest';
import { StatusBar } from '../../ui/statusbar.js';

describe('StatusBar', () => {
  it('should track cumulative tokens', () => {
    const bar = new StatusBar({ model: 'test', sessionId: '123' });
    bar.markStart();
    bar.setPromptTokens(100);
    bar.update(50);
    bar.finalizeTurn();
    expect(bar.getCumulativeTokens()).toBe(150);
  });

  it('should track cumulative tools', () => {
    const bar = new StatusBar({ model: 'test', sessionId: '123' });
    bar.addToolCall();
    bar.addToolCall();
    expect(bar.getCumulativeTools()).toBe(2);
  });

  it('should format summary with cost', () => {
    const bar = new StatusBar({ model: 'Qwen2.5-72B', sessionId: '123' });
    bar.markStart();
    bar.setPromptTokens(1000);
    bar.update(500);
    bar.finalizeTurn();
    const summary = bar.getSummaryString();
    expect(summary).toContain('1.5K');
    expect(summary).toContain('$0.00');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ui/statusbar.test.ts`
Expected: FAIL — methods not found

**Step 3: Write minimal implementation**

Add to `StatusBar` class:

```typescript
getCumulativeTokens(): number {
  return this.cumulativeTokens;
}

getCumulativeTools(): number {
  return this.cumulativeTools;
}

getSummaryString(): string {
  const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
  const speed = elapsed > 0.1 ? this.completionTokens / elapsed : 0;
  const total = this.promptTokens + this.completionTokens;

  const parts: string[] = [];
  parts.push(`~${this.formatTokens(total)} tokens`);
  parts.push(`${this.toolCalls} tool${this.toolCalls !== 1 ? 's' : ''}`);
  if (speed > 0) parts.push(`${speed.toFixed(0)} t/s`);
  if (elapsed > 0) parts.push(`${elapsed.toFixed(1)}s`);
  parts.push('$0.00');

  return parts.join(' · ');
}
```

Enhance `printSummary` to include cumulative stats:

```typescript
printSummary(): void {
  if (!this.enabled) return;
  const summary = this.getSummaryString();
  const cumParts = [
    `session: ~${this.formatTokens(this.cumulativeTokens)} total`,
    `${this.cumulativeTools} tools`,
  ];
  console.log(chalk.dim(`  ${summary}  │  ${cumParts.join(' · ')}`));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ui/statusbar.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/ui/statusbar.ts src/__tests__/ui/statusbar.test.ts
git commit -m "feat(cli): enhance token display with cumulative session stats (G23)"
```

---

### Task 3: Create session analytics module (G24)

**Files:**
- Create: `src/memory/analytics.ts`
- Test: `src/__tests__/memory/analytics.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/memory/analytics.test.ts
import { describe, it, expect } from 'vitest';
import { SessionAnalytics } from '../../memory/analytics.js';

describe('SessionAnalytics', () => {
  it('should compute basic stats from sessions', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'Qwen2.5-72B', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: 'Test 1' },
      { id: '2', model: 'Qwen2.5-72B', created: '2026-02-16', messageCount: 20, toolCallCount: 8, title: 'Test 2' },
      { id: '3', model: 'GLM-5', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: 'Test 3' },
    ]);
    expect(analytics.totalSessions).toBe(3);
    expect(analytics.totalMessages).toBe(35);
    expect(analytics.totalToolCalls).toBe(15);
    expect(analytics.avgMessagesPerSession).toBeCloseTo(11.67, 1);
  });

  it('should compute model usage breakdown', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'Qwen2.5-72B', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: '' },
      { id: '2', model: 'Qwen2.5-72B', created: '2026-02-16', messageCount: 20, toolCallCount: 8, title: '' },
      { id: '3', model: 'GLM-5', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: '' },
    ]);
    const breakdown = analytics.modelBreakdown;
    expect(breakdown['Qwen2.5-72B']).toBe(2);
    expect(breakdown['GLM-5']).toBe(1);
  });

  it('should compute daily activity', () => {
    const analytics = new SessionAnalytics([
      { id: '1', model: 'M', created: '2026-02-17', messageCount: 10, toolCallCount: 5, title: '' },
      { id: '2', model: 'M', created: '2026-02-17', messageCount: 20, toolCallCount: 8, title: '' },
      { id: '3', model: 'M', created: '2026-02-16', messageCount: 5, toolCallCount: 2, title: '' },
    ]);
    expect(analytics.sessionsToday('2026-02-17')).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/memory/analytics.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/memory/analytics.ts
interface SessionSummary {
  id: string;
  model: string;
  created: string;
  messageCount: number;
  toolCallCount: number;
  title: string;
}

export class SessionAnalytics {
  private sessions: SessionSummary[];

  constructor(sessions: SessionSummary[]) {
    this.sessions = sessions;
  }

  get totalSessions(): number { return this.sessions.length; }

  get totalMessages(): number {
    return this.sessions.reduce((sum, s) => sum + s.messageCount, 0);
  }

  get totalToolCalls(): number {
    return this.sessions.reduce((sum, s) => sum + s.toolCallCount, 0);
  }

  get avgMessagesPerSession(): number {
    if (this.sessions.length === 0) return 0;
    return this.totalMessages / this.sessions.length;
  }

  get modelBreakdown(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of this.sessions) {
      counts[s.model] = (counts[s.model] ?? 0) + 1;
    }
    return counts;
  }

  sessionsToday(today?: string): number {
    const d = today ?? new Date().toISOString().split('T')[0]!;
    return this.sessions.filter(s => s.created.startsWith(d)).length;
  }

  get mostUsedModel(): string {
    const breakdown = this.modelBreakdown;
    let max = 0;
    let model = 'none';
    for (const [m, count] of Object.entries(breakdown)) {
      if (count > max) { max = count; model = m; }
    }
    return model;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/memory/analytics.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/memory/analytics.ts src/__tests__/memory/analytics.test.ts
git commit -m "feat(cli): add session analytics module (G24)"
```

---

### Task 4: Add /stats slash command

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add /stats handler in handleSlashCommand**

```typescript
case '/stats':
case '/analytics': {
  const { listSessions } = await import('../memory/store.js');
  const { SessionAnalytics } = await import('../memory/analytics.js');
  const allSessions = await listSessions();
  const analytics = new SessionAnalytics(allSessions);

  const modelLines = Object.entries(analytics.modelBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([model, count]) => kv(model, `${count} sessions`, 20));

  console.log('\n' + box('Session Analytics', [
    kv('Total', `${analytics.totalSessions} sessions`, 14),
    kv('Messages', `${analytics.totalMessages} total`, 14),
    kv('Tool Calls', `${analytics.totalToolCalls} total`, 14),
    kv('Avg/Session', `${analytics.avgMessagesPerSession.toFixed(1)} msgs`, 14),
    kv('Today', `${analytics.sessionsToday()} sessions`, 14),
    '',
    chalk.dim('Model Usage:'),
    ...modelLines,
    '',
    kv('Cost', chalk.green('$0.00') + chalk.dim(' (local inference)'), 14),
  ]));
  return 'handled';
}
```

Add to help menu and `/` browse menu.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add /stats command for session analytics (G24)"
```

---

### Task 5: Create interactive session picker (G25)

**Files:**
- Modify: `src/commands/chat.ts` (enhance /sessions)

**Step 1: Replace list-only /sessions with interactive picker**

Use `@inquirer/prompts select()` to let users pick a session and choose an action (resume, delete, export).

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add interactive session picker with actions (G25)"
```

---

### Task 6: Create interactive model picker (G27)

**Files:**
- Modify: `src/commands/chat.ts` (enhance /model)

**Step 1: When /model called without args, fetch models from LMX and show picker**

Use `fetch()` to `GET /v1/models` from LMX, then present an `@inquirer/prompts select()` picker. Mark current model with a green dot.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add interactive model picker (G27)"
```

---

### Task 7: Add agent picker (G28)

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add /agent command with profile selection**

Define agent profiles (default, reader, coder, researcher) with different tool sets. Use `@inquirer/prompts select()` when no arg provided.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add /agent command with agent profile picker (G28)"
```

---

### Task 8: Create server mode (G26)

**Files:**
- Create: `src/commands/server.ts`
- Test: `src/__tests__/commands/server.test.ts`
- Modify: `src/index.ts`

**Step 1: Write minimal test**

```typescript
// src/__tests__/commands/server.test.ts
import { describe, it, expect } from 'vitest';

describe('server mode', () => {
  it('should be importable', async () => {
    const mod = await import('../../commands/server.js');
    expect(mod.startServer).toBeDefined();
  });
});
```

**Step 2: Implement HTTP server**

Create `src/commands/server.ts` with `createServer` from `node:http`. Endpoints:
- `GET /health` — returns `{ status: 'ok', model }`
- `POST /v1/chat` — accepts `{ message }`, runs agent loop, returns response

Register as `opta server` command in `src/index.ts`.

**Step 3: Run test**

Run: `npm test -- src/__tests__/commands/server.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/commands/server.ts src/__tests__/commands/server.test.ts src/index.ts
git commit -m "feat(cli): add server mode with HTTP API endpoint (G26)"
```

---

### Task 9: Enhance non-interactive mode (G30)

**Files:**
- Modify: `src/commands/do.ts`
- Modify: `src/index.ts`

**Step 1: Add --json, --quiet flags to opta do**

Add output format flags so `opta do` can output JSON for scripting or quiet mode for piping.

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/do.ts src/index.ts
git commit -m "feat(cli): enhance non-interactive mode with output format flags (G30)"
```

---

### Task 10: Add responsive terminal width to box rendering (partial G06)

**Files:**
- Modify: `src/ui/box.ts`

**Step 1: Use process.stdout.columns for box width**

```typescript
const termWidth = process.stdout.columns || 80;
const width = fixedWidth ?? Math.min(
  Math.max(maxContent + 4, titleLen + 6, 40),
  termWidth - 4
);
```

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/ui/box.ts
git commit -m "feat(cli): add responsive terminal width to box rendering (partial G06)"
```

---

### Task 11: Update help and browse menus with all new commands

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add all new commands to /help and / menu**

New commands: `/theme`, `/stats`, `/expand`, `/agent`, `/editor`

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): update help and browse menus with all new commands"
```

---

### Task 12: Run full test suite

**Step 1: Run all checks**

Run: `npm run typecheck && npm test && npm run lint`
Expected: All pass

**Step 2: Final commit if needed**

```bash
git add -A
git commit -m "fix(cli): resolve Phase 1C test and lint issues"
```

---

## Summary

| Task | Gap | What It Does |
|------|-----|-------------|
| 1 | G22 | Multi-format session export (JSON, text, markdown) |
| 2 | G23 | Enhanced token display with cumulative stats |
| 3 | G24 | Session analytics module |
| 4 | G24 | /stats slash command |
| 5 | G25 | Interactive session picker with actions |
| 6 | G27 | Interactive model picker from LMX |
| 7 | G28 | Agent profile picker |
| 8 | G26 | HTTP API server mode |
| 9 | G30 | Enhanced non-interactive mode |
| 10 | G06 | Responsive terminal width (partial) |
| 11 | — | Update help and browse menus |
| 12 | — | Full test suite verification |

**Total:** 12 tasks, 8 gaps addressed (G22, G23, G24, G25, G26, G27, G28, G30)
