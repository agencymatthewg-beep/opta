# Opta CLI UX Improvements — Session 1

## Context
Opta CLI is a TypeScript AI coding CLI that connects to Opta-LMX (local inference server).
Codebase: `~/Synced/Opta/1-Apps/1D-Opta-CLI-TS/`
Build: `pnpm build` (tsup ESM)
Test: `npx vitest run` (393 tests, all passing)
Current state: Basic inquirer input, 11 slash commands, thinking display, status summary.

## Goal
Bring slash commands and interactive UX up to par with Claude Code and OpenCode.

## Tasks (in order)

### 1. Interactive Slash Command Menu
**File:** `src/commands/chat.ts`

When the user types exactly `/` and presses Enter, show an interactive select menu instead of "Unknown command: /".

Use `@inquirer/prompts` `select` to show all commands with descriptions:
```typescript
import { select } from '@inquirer/prompts';

const commands = [
  { name: '/help        Show available commands', value: '/help' },
  { name: '/exit        Save and exit', value: '/exit' },
  { name: '/model       Switch model', value: '/model' },
  { name: '/plan        Toggle plan mode', value: '/plan' },
  { name: '/undo        Reverse last checkpoint', value: '/undo' },
  { name: '/compact     Force context compaction', value: '/compact' },
  { name: '/clear       Clear screen', value: '/clear' },
  { name: '/history     Show conversation summary', value: '/history' },
  { name: '/image       Analyze an image', value: '/image' },
  { name: '/status      System & LMX status', value: '/status' },
  { name: '/diff        Show session file changes', value: '/diff' },
  { name: '/cost        Token usage breakdown', value: '/cost' },
  { name: '/init        Generate project context', value: '/init' },
  { name: '/sessions    List recent sessions', value: '/sessions' },
  { name: '/share       Export conversation', value: '/share' },
];
```

When user selects a command, execute it immediately.

In `handleSlashCommand`, add this case:
```typescript
case '/':
  // Show interactive command menu
  const selected = await select({ message: 'Command:', choices: commands });
  return handleSlashCommand(selected, session, config, state);
```

### 2. /status Command
**File:** `src/commands/chat.ts` (add case in handleSlashCommand)

Show system status:
```
╭─ Opta Status ──────────────────────────╮
│ LMX:     192.168.188.11:1234 (ok)      │
│ Model:   M2.5-4bit (123 GB loaded)     │
│ Memory:  209/512 GB (41%)              │
│ Session: z41A3Y5k (47 messages)        │
│ Tokens:  ~2.4K (this session)          │
│ Speed:   74 t/s average                │
╰─────────────────────────────────────────╯
```

Implementation: fetch from LMX admin API at `http://{host}:{port}/admin/status`:
```typescript
case '/status': {
  try {
    const res = await fetch(`http://${config.connection.host}:${config.connection.port}/admin/status`);
    const data = await res.json();
    const model = data.models?.[0];
    console.log();
    console.log(chalk.bold('  Opta Status'));
    console.log(chalk.dim('  ─'.repeat(20)));
    console.log(`  LMX:     ${config.connection.host}:${config.connection.port} ${chalk.green('(ok)')}`);
    if (model) {
      console.log(`  Model:   ${model}`);
    }
    console.log(`  Memory:  ${data.memory?.used_gb?.toFixed(0)}/${data.memory?.total_gb?.toFixed(0)} GB (${data.memory?.usage_percent?.toFixed(0)}%)`);
    console.log(`  Session: ${session.id.slice(0, 8)} (${session.messages.length} messages)`);
    const tokens = estimateTokens(session.messages);
    console.log(`  Tokens:  ~${tokens > 1000 ? (tokens/1000).toFixed(1) + 'K' : tokens}`);
    console.log(`  Uptime:  ${Math.floor(data.uptime_seconds / 60)}m`);
    console.log();
  } catch (err) {
    console.log(chalk.red('  ✗ Cannot reach LMX server'));
  }
  return 'handled';
}
```

Note: You'll need to import or reference `estimateTokens` from `../core/agent.js`. It's already exported.

### 3. /diff Command
Show git changes made during this session.

```typescript
case '/diff': {
  try {
    const { execSync } = await import('node:child_process');
    const diff = execSync('git diff --stat', { encoding: 'utf-8', cwd: process.cwd() });
    if (!diff.trim()) {
      console.log(chalk.dim('  No uncommitted changes'));
    } else {
      console.log();
      console.log(chalk.bold('  Changes:'));
      for (const line of diff.trim().split('\n')) {
        console.log('  ' + line);
      }
      console.log();
    }
  } catch {
    console.log(chalk.dim('  Not a git repository'));
  }
  return 'handled';
}
```

### 4. /cost Command
Show token usage breakdown for the session.

```typescript
case '/cost': {
  const msgs = session.messages;
  let promptTokens = 0;
  let completionTokens = 0;
  for (const m of msgs) {
    const len = typeof m.content === 'string' ? m.content.length : 0;
    const tokens = Math.ceil(len / 4);
    if (m.role === 'assistant') completionTokens += tokens;
    else promptTokens += tokens;
  }
  const total = promptTokens + completionTokens;
  console.log();
  console.log(chalk.bold('  Token Usage'));
  console.log(chalk.dim('  ─'.repeat(20)));
  console.log(`  Prompt:     ~${promptTokens > 1000 ? (promptTokens/1000).toFixed(1) + 'K' : promptTokens} tokens`);
  console.log(`  Completion: ~${completionTokens > 1000 ? (completionTokens/1000).toFixed(1) + 'K' : completionTokens} tokens`);
  console.log(`  Total:      ~${total > 1000 ? (total/1000).toFixed(1) + 'K' : total} tokens`);
  console.log(`  Messages:   ${msgs.length}`);
  console.log(`  Tool calls: ${session.toolCallCount}`);
  console.log(chalk.dim(`  Cost:       $0.00 (local inference)`));
  console.log();
  return 'handled';
}
```

### 5. /share Command  
Export conversation to a markdown file.

```typescript
case '/share': {
  const { writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const filename = `opta-session-${session.id.slice(0, 8)}-${Date.now()}.md`;
  const filepath = join(process.cwd(), filename);
  
  let md = `# Opta CLI Session\n\n`;
  md += `- **Session:** ${session.id}\n`;
  md += `- **Model:** ${session.model}\n`;
  md += `- **Date:** ${new Date().toISOString()}\n\n---\n\n`;
  
  for (const m of session.messages) {
    if (m.role === 'system') continue;
    const content = typeof m.content === 'string' ? m.content : '[multimodal]';
    if (m.role === 'user') {
      md += `## User\n\n${content}\n\n`;
    } else if (m.role === 'assistant') {
      md += `## Assistant\n\n${content}\n\n`;
    }
  }
  
  await writeFile(filepath, md, 'utf-8');
  console.log(chalk.green('✓') + ` Exported to ${chalk.cyan(filename)}`);
  return 'handled';
}
```

### 6. /sessions Command
List recent sessions with ability to resume.

```typescript
case '/sessions': {
  const { listSessions } = await import('../memory/store.js');
  const sessions = await listSessions();
  if (sessions.length === 0) {
    console.log(chalk.dim('  No saved sessions'));
    return 'handled';
  }
  console.log();
  console.log(chalk.bold('  Recent Sessions'));
  console.log(chalk.dim('  ─'.repeat(20)));
  for (const s of sessions.slice(0, 10)) {
    const title = s.title || 'Untitled';
    const msgs = s.messages?.length ?? 0;
    const date = new Date(s.updatedAt ?? s.createdAt).toLocaleDateString();
    const current = s.id === session.id ? chalk.green(' (current)') : '';
    console.log(`  ${chalk.cyan(s.id.slice(0, 8))}  ${title.slice(0, 40)}  ${chalk.dim(`${msgs} msgs · ${date}`)}${current}`);
  }
  console.log(chalk.dim('\n  Resume with: /exit then opta chat -r <id>'));
  console.log();
  return 'handled';
}
```

Note: Check if `listSessions` exists in `src/memory/store.ts`. If not, add it:
```typescript
export async function listSessions(): Promise<Session[]> {
  const dir = getSessionDir();
  const files = await readdir(dir).catch(() => []);
  const sessions: Session[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await readFile(join(dir, f), 'utf-8'));
      sessions.push(data);
    } catch { continue; }
  }
  return sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}
```

### 7. /init Command
Generate a project context file (like CLAUDE.md / AGENTS.md).

```typescript
case '/init': {
  const { writeFile, readFile: readFs, access } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const contextFile = join(process.cwd(), 'OPTA.md');
  
  try {
    await access(contextFile);
    console.log(chalk.yellow('  OPTA.md already exists. Delete it first to regenerate.'));
    return 'handled';
  } catch { /* doesn't exist, good */ }
  
  // Ask the model to generate project context
  console.log(chalk.dim('  Analyzing project...'));
  
  // Inject as a user message that triggers analysis
  session.messages.push({
    role: 'user',
    content: 'Analyze this project and generate an OPTA.md project context file. Include: project name, tech stack, architecture overview, key files, coding conventions, and any important notes for an AI assistant working on this codebase. Write it as a markdown file.'
  });
  
  // The next agent loop iteration will handle this
  console.log(chalk.dim('  Ask me to generate the OPTA.md file and I\'ll analyze the project.'));
  return 'handled';
}
```

### 8. @ File References
**File:** Create `src/core/fileref.ts`

Parse `@path/to/file` references in user messages and inject file contents.

```typescript
import { readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { glob } from 'node:fs';
import chalk from 'chalk';

export interface FileRef {
  original: string;  // @src/core/agent.ts
  path: string;      // resolved absolute path
  content: string;   // file contents
  lines: number;     // line count
}

export async function resolveFileRefs(message: string): Promise<{ cleanMessage: string; refs: FileRef[] }> {
  // Match @path patterns (not @mentions which start with uppercase or are emails)
  const pattern = /@((?:\.{1,2}\/|[a-z_])[^\s,;:!?'")\]}>]+)/g;
  const refs: FileRef[] = [];
  const matches = [...message.matchAll(pattern)];
  
  let cleanMessage = message;
  
  for (const match of matches) {
    const refPath = match[1]!;
    const fullPath = resolve(process.cwd(), refPath);
    
    try {
      const content = await readFile(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      refs.push({
        original: match[0],
        path: fullPath,
        content,
        lines,
      });
      console.log(chalk.dim(`  📎 attached: ${relative(process.cwd(), fullPath)} (${lines} lines)`));
    } catch {
      // File doesn't exist — leave the @reference as-is
    }
  }
  
  return { cleanMessage, refs };
}

export function buildContextWithRefs(message: string, refs: FileRef[]): string {
  if (refs.length === 0) return message;
  
  let context = '';
  for (const ref of refs) {
    context += `\n\n<file path="${ref.path}">\n${ref.content}\n</file>\n`;
  }
  
  return message + context;
}
```

**Integrate in `src/commands/chat.ts`** — before sending user input to agentLoop:
```typescript
import { resolveFileRefs, buildContextWithRefs } from '../core/fileref.js';

// In the REPL loop, before agentLoop call:
const { cleanMessage, refs } = await resolveFileRefs(userInput);
const enrichedInput = buildContextWithRefs(userInput, refs);
// Use enrichedInput instead of userInput for the agentLoop call
```

## Testing
After all changes:
1. `pnpm build` — must succeed
2. `npx vitest run` — all 393+ tests must pass
3. Add tests for new features:
   - `tests/ui/thinking.test.ts` — test ThinkingRenderer with M2.5 patterns
   - `tests/core/fileref.test.ts` — test @ reference parsing

## Important Notes
- All imports use `.js` extension (ESM)
- Use `chalk` for colors (already a dependency)
- Use `@inquirer/prompts` for interactive prompts (already a dependency)
- Don't add new dependencies without checking package.json first
- The `handleSlashCommand` function in `src/commands/chat.ts` is the central slash command handler
- `estimateTokens` is in `src/core/agent.ts` and is already exported
- Session type is in `src/memory/store.ts`
