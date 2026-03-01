---
status: archived
---

# Opta CLI V2 Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Advance Opta CLI from 9 tools to 15+ with observation masking, model-specific compaction, progressive circuit breaker, 5 permission modes, plan mode, web search, and multimodal input.

**Architecture:** Seven improvement areas organized into 4 phases by dependency order. Phase 1 (context + safety) provides infrastructure for Phase 2 (tools), Phase 3 (plan mode depends on permission modes), and Phase 4 (multimodal + QoL). All changes are backward-compatible via Zod defaults.

**Tech Stack:** TypeScript, Zod, OpenAI SDK, @inquirer/core (custom prompt), cheerio (HTML-to-text), node:fs, node:fetch

---

## Phase 1: Context Optimization + Safety Infrastructure

### Task 1: Observation Masking (P0 — 52% context savings, zero API cost)

**Files:**
- Create: `src/core/context.ts`
- Create: `tests/core/context.test.ts`
- Modify: `src/core/agent.ts:269-280`

**Step 1: Write the failing test**

Create `tests/core/context.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { maskOldObservations } from '../src/core/context.js';
import type { AgentMessage } from '../src/core/agent.js';

describe('maskOldObservations', () => {
  it('masks tool results beyond window size', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta' },
      { role: 'user', content: 'Read the file' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } }] },
      { role: 'tool', content: 'A'.repeat(500), tool_call_id: 't1' },
      { role: 'user', content: 'Read another' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't2', type: 'function', function: { name: 'read_file', arguments: '{"path":"b.ts"}' } }] },
      { role: 'tool', content: 'B'.repeat(500), tool_call_id: 't2' },
      { role: 'user', content: 'Read one more' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't3', type: 'function', function: { name: 'read_file', arguments: '{"path":"c.ts"}' } }] },
      { role: 'tool', content: 'C'.repeat(500), tool_call_id: 't3' },
    ];

    const masked = maskOldObservations(messages, 2); // keep last 2 tool results

    // First tool result should be masked
    expect(masked[3]!.content).toContain('[Tool result truncated');
    expect(masked[3]!.content!.length).toBeLessThan(200);

    // Last 2 tool results should be preserved
    expect(masked[6]!.content).toBe('B'.repeat(500));
    expect(masked[9]!.content).toBe('C'.repeat(500));
  });

  it('preserves short tool results even outside window', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'edit_file', arguments: '{}' } }] },
      { role: 'tool', content: 'File edited: a.ts', tool_call_id: 't1' },
      { role: 'assistant', content: null, tool_calls: [{ id: 't2', type: 'function', function: { name: 'read_file', arguments: '{}' } }] },
      { role: 'tool', content: 'D'.repeat(500), tool_call_id: 't2' },
    ];

    const masked = maskOldObservations(messages, 1);

    // Short result preserved (under 200 chars)
    expect(masked[2]!.content).toBe('File edited: a.ts');
    // Last tool result in window preserved
    expect(masked[4]!.content).toBe('D'.repeat(500));
  });

  it('returns unchanged messages when fewer tool results than window', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Opta' },
      { role: 'tool', content: 'X'.repeat(500), tool_call_id: 't1' },
    ];

    const masked = maskOldObservations(messages, 4);
    expect(masked[1]!.content).toBe('X'.repeat(500));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/context.test.ts`
Expected: FAIL with "Cannot find module '../src/core/context.js'"

**Step 3: Write minimal implementation**

Create `src/core/context.ts`:

```typescript
import type { AgentMessage } from './agent.js';

/**
 * Replace old tool results with compact placeholders.
 * Keeps the last `windowSize` tool results verbatim.
 * Results under 200 chars are never masked (they're cheap).
 */
export function maskOldObservations(
  messages: AgentMessage[],
  windowSize: number
): AgentMessage[] {
  const toolResultIndices: number[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'tool') toolResultIndices.push(i);
  });

  const toMask = toolResultIndices.slice(0, -windowSize || undefined);

  return messages.map((m, i) => {
    if (toMask.includes(i) && m.content && m.content.length > 200) {
      const firstLine = m.content.split('\n')[0]?.slice(0, 100) ?? '';
      return {
        ...m,
        content: `[Tool result truncated: ${m.content.length} chars, first line: ${firstLine}]`,
      };
    }
    return m;
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/context.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/core/context.ts tests/core/context.test.ts
git commit -m "feat: add observation masking for context savings"
```

---

### Task 2: Integrate Observation Masking into Agent Loop

**Files:**
- Modify: `src/core/agent.ts:269-280`

**Step 1: Write the failing test**

Add to `tests/core/context.test.ts`:

```typescript
describe('observation masking integration', () => {
  it('maskOldObservations is exported and callable', () => {
    expect(typeof maskOldObservations).toBe('function');
  });
});
```

Already passes from Task 1, so this is a code-integration step.

**Step 2: Modify agent.ts**

In `src/core/agent.ts`, add import at top (after line 6):

```typescript
import { maskOldObservations } from './context.js';
```

In the agent loop, before the compaction check (line 269), add observation masking:

```typescript
    // 0. Observation masking (free context savings)
    const maskedMessages = maskOldObservations(messages, 4);
    messages.length = 0;
    messages.push(...maskedMessages);

    // 1. Context compaction
```

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/core/agent.ts
git commit -m "feat: integrate observation masking into agent loop"
```

---

### Task 3: Improve Compaction Prompt and Summary Budget

**Files:**
- Modify: `src/core/agent.ts:108-156`

**Step 1: Write the failing test**

Add to `tests/core/context.test.ts`:

```typescript
import { COMPACTION_PROMPT } from '../src/core/context.js';

describe('compaction prompt', () => {
  it('includes file preservation instructions', () => {
    expect(COMPACTION_PROMPT).toContain('FILES MODIFIED');
    expect(COMPACTION_PROMPT).toContain('DECISIONS MADE');
    expect(COMPACTION_PROMPT).toContain('CURRENT STATE');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/context.test.ts`
Expected: FAIL with "COMPACTION_PROMPT is not exported"

**Step 3: Add compaction prompt to context.ts**

Add to `src/core/context.ts`:

```typescript
export const COMPACTION_PROMPT = `Summarize this coding assistant conversation for continuity. Preserve:

1. FILES MODIFIED: Every file path that was read, edited, or created, with the nature of changes
2. DECISIONS MADE: Architectural choices, rejected alternatives, and rationale
3. ERRORS ENCOUNTERED: Bugs found, failed attempts, and how they were resolved
4. CURRENT STATE: What is done, what remains, any blockers
5. KEY CODE PATTERNS: Variable names, function signatures, data structures being worked with

Be thorough — this summary replaces the full history. Include specific file paths and code identifiers.`;
```

**Step 4: Update compactHistory in agent.ts to use new prompt and model-aware budget**

In `src/core/agent.ts`, replace the compaction system message (line 133-134) with:

```typescript
import { maskOldObservations, COMPACTION_PROMPT } from './context.js';
```

And update the compactHistory function to use `COMPACTION_PROMPT` and increase `max_tokens` from 500 to `Math.min(Math.floor(contextLimit * 0.05), 2000)`:

```typescript
async function compactHistory(
  messages: AgentMessage[],
  client: import('openai').default,
  model: string,
  contextLimit: number
): Promise<AgentMessage[]> {
  const systemPrompt = messages[0]!;
  const recentCount = Math.min(Math.floor(contextLimit / 4000), 20);
  const recent = messages.slice(-Math.max(recentCount, 6));
  const middle = messages.slice(1, -Math.max(recentCount, 6));

  if (middle.length === 0) return messages;

  debug(`Compacting ${middle.length} messages`);

  const middleText = middle
    .filter((m) => m.content)
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n');

  const summaryBudget = Math.min(Math.floor(contextLimit * 0.05), 2000);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: COMPACTION_PROMPT },
        { role: 'user', content: middleText },
      ],
      max_tokens: Math.max(summaryBudget, 500),
    });

    const summary = response.choices[0]?.message?.content ?? '';
    debug(`Compacted to ${summary.length} chars`);

    return [
      systemPrompt,
      {
        role: 'user' as const,
        content: `[Previous conversation summary]\n${summary}`,
      },
      ...recent,
    ];
  } catch (err) {
    debug(`Compaction failed: ${err}`);
    return messages;
  }
}
```

Update the call site at line 276 to pass `config.model.contextLimit`:

```typescript
const compacted = await compactHistory(messages, client, model, config.model.contextLimit);
```

**Step 5: Run tests**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/context.ts src/core/agent.ts tests/core/context.test.ts
git commit -m "feat: improve compaction prompt and model-aware summary budget"
```

---

### Task 4: Model Profiles with Per-Model compactAt

**Files:**
- Create: `src/core/models.ts`
- Create: `tests/core/models.test.ts`
- Modify: `src/core/config.ts:33-37`

**Step 1: Write the failing test**

Create `tests/core/models.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getModelProfile, type ModelProfile } from '../src/core/models.js';

describe('getModelProfile', () => {
  it('returns profile for known model', () => {
    const profile = getModelProfile('qwen2.5-72b');
    expect(profile.contextLimit).toBe(32768);
    expect(profile.compactAt).toBe(0.70);
    expect(profile.architecture).toBe('dense');
  });

  it('returns profile for GLM Flash', () => {
    const profile = getModelProfile('glm-4.7-flash');
    expect(profile.compactAt).toBe(0.75);
    expect(profile.architecture).toBe('moe');
  });

  it('returns profile for DeepSeek V3', () => {
    const profile = getModelProfile('deepseek-v3');
    expect(profile.compactAt).toBe(0.80);
    expect(profile.architecture).toBe('mla');
  });

  it('returns default profile for unknown model', () => {
    const profile = getModelProfile('unknown-model');
    expect(profile.contextLimit).toBe(32768);
    expect(profile.compactAt).toBe(0.70);
    expect(profile.architecture).toBe('dense');
  });

  it('matches partial model names', () => {
    const profile = getModelProfile('Qwen2.5-Coder-72B-Instruct-4bit');
    expect(profile.compactAt).toBe(0.70);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/models.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/core/models.ts`:

```typescript
export interface ModelProfile {
  contextLimit: number;
  compactAt: number;
  observationWindow: number;
  charToTokenRatio: number;
  architecture: 'dense' | 'moe' | 'mla' | 'hybrid';
}

const MODEL_PROFILES: Array<{ pattern: RegExp; profile: ModelProfile }> = [
  {
    pattern: /qwen.*coder|qwen2\.5/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4, charToTokenRatio: 3.5, architecture: 'dense' },
  },
  {
    pattern: /glm-4\.7-flash/i,
    profile: { contextLimit: 128000, compactAt: 0.75, observationWindow: 8, charToTokenRatio: 4.0, architecture: 'moe' },
  },
  {
    pattern: /glm-4\.7/i,
    profile: { contextLimit: 200000, compactAt: 0.70, observationWindow: 8, charToTokenRatio: 4.0, architecture: 'moe' },
  },
  {
    pattern: /deepseek-v3|deepseek-chat/i,
    profile: { contextLimit: 128000, compactAt: 0.80, observationWindow: 8, charToTokenRatio: 3.8, architecture: 'mla' },
  },
  {
    pattern: /deepseek-r1-distill/i,
    profile: { contextLimit: 32768, compactAt: 0.70, observationWindow: 4, charToTokenRatio: 4.0, architecture: 'dense' },
  },
  {
    pattern: /kimi|k2\.5/i,
    profile: { contextLimit: 256000, compactAt: 0.70, observationWindow: 8, charToTokenRatio: 4.0, architecture: 'moe' },
  },
  {
    pattern: /minimax/i,
    profile: { contextLimit: 1000000, compactAt: 0.85, observationWindow: 12, charToTokenRatio: 4.0, architecture: 'hybrid' },
  },
  {
    pattern: /gemma.*3/i,
    profile: { contextLimit: 8192, compactAt: 0.65, observationWindow: 2, charToTokenRatio: 3.5, architecture: 'dense' },
  },
  {
    pattern: /wizard/i,
    profile: { contextLimit: 4096, compactAt: 0.60, observationWindow: 2, charToTokenRatio: 4.0, architecture: 'dense' },
  },
];

const DEFAULT_PROFILE: ModelProfile = {
  contextLimit: 32768,
  compactAt: 0.70,
  observationWindow: 4,
  charToTokenRatio: 4.0,
  architecture: 'dense',
};

export function getModelProfile(modelName: string): ModelProfile {
  for (const { pattern, profile } of MODEL_PROFILES) {
    if (pattern.test(modelName)) return profile;
  }
  return DEFAULT_PROFILE;
}
```

**Step 4: Run tests**

Run: `npm test -- tests/core/models.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models.ts tests/core/models.test.ts
git commit -m "feat: add model profiles with per-model compaction thresholds"
```

---

### Task 5: Progressive Circuit Breaker

**Files:**
- Modify: `src/core/config.ts:51-56` (replace safety schema)
- Create: `tests/core/circuit-breaker.test.ts`
- Modify: `src/core/agent.ts:398-408` (replace circuit breaker)

**Step 1: Write the failing test**

Create `tests/core/circuit-breaker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { OptaConfigSchema } from '../src/core/config.js';

describe('circuit breaker config', () => {
  it('has progressive defaults', () => {
    const config = OptaConfigSchema.parse({});
    expect(config.safety.circuitBreaker.warnAt).toBe(20);
    expect(config.safety.circuitBreaker.pauseAt).toBe(40);
    expect(config.safety.circuitBreaker.hardStopAt).toBe(100);
  });

  it('accepts custom thresholds', () => {
    const config = OptaConfigSchema.parse({
      safety: { circuitBreaker: { pauseAt: 10, hardStopAt: 50 } },
    });
    expect(config.safety.circuitBreaker.pauseAt).toBe(10);
    expect(config.safety.circuitBreaker.hardStopAt).toBe(50);
  });

  it('backward-compat: maxToolCalls still accepted', () => {
    const config = OptaConfigSchema.parse({
      safety: { maxToolCalls: 25 },
    });
    expect(config.safety.maxToolCalls).toBe(25);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/circuit-breaker.test.ts`
Expected: FAIL (circuitBreaker not in schema)

**Step 3: Update config schema**

In `src/core/config.ts`, replace lines 51-56 with:

```typescript
  safety: z
    .object({
      maxToolCalls: z.number().default(30), // backward compat
      compactAt: z.number().default(0.7),
      circuitBreaker: z
        .object({
          warnAt: z.number().default(20),
          pauseAt: z.number().default(40),
          hardStopAt: z.number().default(100),
          perToolLimit: z.number().default(0),
          maxDuration: z.number().default(0),
          silentBehavior: z.enum(['stop', 'warn-and-continue', 'error']).default('stop'),
        })
        .default({}),
    })
    .default({}),
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/circuit-breaker.test.ts`
Expected: PASS

**Step 5: Update agent loop circuit breaker**

In `src/core/agent.ts`, replace lines 398-408 with:

```typescript
    // 7. Progressive circuit breaker
    const cb = config.safety.circuitBreaker;

    if (cb.hardStopAt > 0 && toolCallCount >= cb.hardStopAt) {
      if (!silent) console.log(chalk.red(`\n  Hard stop: ${cb.hardStopAt} tool calls reached.`));
      break;
    }

    if (cb.pauseAt > 0 && toolCallCount >= cb.pauseAt && toolCallCount % cb.pauseAt === 0) {
      if (silent) break;
      console.log(chalk.yellow(`\n  Reached ${toolCallCount} tool calls. Pausing.`));
      const { confirm } = await import('@inquirer/prompts');
      const shouldContinue = await confirm({ message: 'Continue?' });
      if (!shouldContinue) break;
    }

    if (cb.warnAt > 0 && toolCallCount === cb.warnAt && !silent) {
      console.log(chalk.dim(`\n  Note: ${cb.warnAt} tool calls used (pauses at ${cb.pauseAt})`));
    }
```

**Step 6: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/core/config.ts src/core/agent.ts tests/core/circuit-breaker.test.ts
git commit -m "feat: progressive circuit breaker (warn/pause/hard-stop)"
```

---

### Task 6: Permission Modes (safe/auto/plan/dangerous/ci)

**Files:**
- Modify: `src/core/config.ts:39-50` (add defaultMode)
- Modify: `src/core/tools.ts:153-164` (mode-aware resolvePermission)
- Create: `tests/core/permissions.test.ts`
- Modify: `src/index.ts` (add --auto, --dangerous, --yolo flags)
- Modify: `src/commands/chat.ts` (pass mode to agent)
- Modify: `src/commands/do.ts` (pass mode to agent)

**Step 1: Write the failing test**

Create `tests/core/permissions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolvePermission } from '../src/core/tools.js';
import { OptaConfigSchema } from '../src/core/config.js';

describe('permission modes', () => {
  it('safe mode: edits require ask', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'safe' });
    expect(resolvePermission('edit_file', config)).toBe('ask');
    expect(resolvePermission('read_file', config)).toBe('allow');
  });

  it('auto mode: edits allowed, shell asks', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'auto' });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('write_file', config)).toBe('allow');
    expect(resolvePermission('run_command', config)).toBe('ask');
  });

  it('plan mode: all writes denied', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'plan' });
    expect(resolvePermission('edit_file', config)).toBe('deny');
    expect(resolvePermission('write_file', config)).toBe('deny');
    expect(resolvePermission('run_command', config)).toBe('deny');
    expect(resolvePermission('read_file', config)).toBe('allow');
  });

  it('dangerous mode: everything allowed', () => {
    const config = OptaConfigSchema.parse({ defaultMode: 'dangerous' });
    expect(resolvePermission('edit_file', config)).toBe('allow');
    expect(resolvePermission('run_command', config)).toBe('allow');
  });

  it('per-tool overrides take precedence over mode', () => {
    const config = OptaConfigSchema.parse({
      defaultMode: 'dangerous',
      permissions: { run_command: 'deny' },
    });
    expect(resolvePermission('run_command', config)).toBe('deny');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/permissions.test.ts`
Expected: FAIL (defaultMode not in schema)

**Step 3: Add defaultMode to config schema**

In `src/core/config.ts`, add after line 38 (before `permissions`):

```typescript
  defaultMode: z.enum(['safe', 'auto', 'plan', 'dangerous', 'ci']).default('safe'),
```

**Step 4: Update resolvePermission in tools.ts**

Replace `resolvePermission` function (lines 155-164) with:

```typescript
const MODE_PERMISSIONS: Record<string, Record<string, 'allow' | 'ask' | 'deny'>> = {
  safe: {},
  auto: { edit_file: 'allow', write_file: 'allow' },
  plan: { edit_file: 'deny', write_file: 'deny', run_command: 'deny' },
  dangerous: { edit_file: 'allow', write_file: 'allow', run_command: 'allow' },
  ci: { edit_file: 'deny', write_file: 'deny', run_command: 'deny', ask_user: 'deny' },
};

export function resolvePermission(
  toolName: string,
  config: OptaConfig
): 'allow' | 'ask' | 'deny' {
  // Per-tool config overrides take highest precedence
  const configPerm = config.permissions[toolName];
  const defaultPerm = DEFAULT_TOOL_PERMISSIONS[toolName];

  // If the user explicitly set a per-tool override different from defaults, use it
  if (configPerm && configPerm !== defaultPerm) {
    if (isCI && configPerm === 'ask') return 'deny';
    return configPerm;
  }

  // Mode-level permissions
  const mode = config.defaultMode ?? 'safe';
  const modePerm = MODE_PERMISSIONS[mode]?.[toolName];
  if (modePerm) return modePerm;

  // Fall back to config permission or default
  const permission = configPerm ?? 'ask';
  if (isCI && permission === 'ask') return 'deny';
  return permission;
}

const DEFAULT_TOOL_PERMISSIONS: Record<string, string> = {
  read_file: 'allow',
  list_dir: 'allow',
  search_files: 'allow',
  find_files: 'allow',
  edit_file: 'ask',
  write_file: 'ask',
  run_command: 'ask',
  ask_user: 'allow',
  read_project_docs: 'allow',
};
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/core/permissions.test.ts`
Expected: PASS

**Step 6: Add CLI flags for modes**

In `src/index.ts`, add options to the `chat` command (after line 46, the `--no-checkpoints` line):

```typescript
  .option('-a, --auto', 'auto-accept file edits without prompting')
  .option('--dangerous', 'bypass all permission prompts')
  .option('--yolo', 'alias for --dangerous')
```

And to the `do` command (after line 59):

```typescript
  .option('-a, --auto', 'auto-accept file edits')
  .option('--dangerous', 'bypass all permission prompts')
  .option('--yolo', 'alias for --dangerous')
```

In `src/commands/chat.ts`, update `ChatOptions` interface to include:

```typescript
  auto?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
```

And in `startChat`, compute mode from flags and add to overrides:

```typescript
  if (opts.dangerous || opts.yolo) {
    overrides['defaultMode'] = 'dangerous';
  } else if (opts.auto) {
    overrides['defaultMode'] = 'auto';
  } else if (opts.plan) {
    overrides['defaultMode'] = 'plan';
  }
```

Do the same in `src/commands/do.ts`.

**Step 7: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 8: Commit**

```bash
git add src/core/config.ts src/core/tools.ts src/index.ts src/commands/chat.ts src/commands/do.ts tests/core/permissions.test.ts
git commit -m "feat: 5 permission modes (safe/auto/plan/dangerous/ci)"
```

---

## Phase 2: Tool Expansion

### Task 7: web_search Tool (SearXNG)

**Files:**
- Modify: `src/core/config.ts` (add search config)
- Modify: `src/core/tools.ts` (add web_search schema + executor)
- Create: `tests/core/web-search.test.ts`

**Step 1: Write the failing test**

Create `tests/core/web-search.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS } from '../src/core/tools.js';

describe('web_search tool', () => {
  it('is registered in tool schemas', () => {
    const schema = TOOL_SCHEMAS.find(t => t.function.name === 'web_search');
    expect(schema).toBeDefined();
    expect(schema!.function.parameters.required).toContain('query');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/web-search.test.ts`
Expected: FAIL

**Step 3: Add search config**

In `src/core/config.ts`, add before the closing of OptaConfigSchema:

```typescript
  search: z
    .object({
      searxngUrl: z.string().default('http://192.168.188.10:8888'),
    })
    .default({}),
```

**Step 4: Add web_search tool schema and executor**

In `src/core/tools.ts`, add to TOOL_SCHEMAS array (after ask_user):

```typescript
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description: 'Search the web for documentation, error messages, APIs, or current information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          max_results: { type: 'number', description: 'Max results (default: 5)' },
        },
        required: ['query'],
      },
    },
  },
```

Add executor case in `executeTool` switch:

```typescript
      case 'web_search':
        return await execWebSearch(args);
```

Add executor function:

```typescript
async function execWebSearch(args: Record<string, unknown>): Promise<string> {
  const query = String(args['query'] ?? '');
  const maxResults = Number(args['max_results'] ?? 5);

  // Load search URL from config
  let searxngUrl = 'http://192.168.188.10:8888';
  try {
    const { loadConfig } = await import('./config.js');
    const config = await loadConfig();
    searxngUrl = config.search?.searxngUrl ?? searxngUrl;
  } catch {
    // Use default
  }

  const url = `${searxngUrl}/search?q=${encodeURIComponent(query)}&format=json`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return `Error: Search returned ${response.status}`;

    const data = await response.json() as { results?: Array<{ title: string; url: string; content: string }> };
    const results = (data.results ?? []).slice(0, maxResults);

    if (results.length === 0) return 'No results found.';

    return results.map((r, i) =>
      `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content?.slice(0, 200) ?? ''}`
    ).join('\n\n');
  } catch (err) {
    return `Error: Search failed — ${err instanceof Error ? err.message : String(err)}`;
  }
}
```

Update default permissions to include web_search:

```typescript
    web_search: 'allow',
```

**Step 5: Run test**

Run: `npm test -- tests/core/web-search.test.ts`
Expected: PASS

**Step 6: Run full suite**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add src/core/tools.ts src/core/config.ts tests/core/web-search.test.ts
git commit -m "feat: add web_search tool via SearXNG"
```

---

### Task 8: web_fetch Tool

**Files:**
- Modify: `src/core/tools.ts` (add web_fetch schema + executor)
- Create: `tests/core/web-fetch.test.ts`

**Step 1: Write the failing test**

Create `tests/core/web-fetch.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS } from '../src/core/tools.js';

describe('web_fetch tool', () => {
  it('is registered in tool schemas', () => {
    const schema = TOOL_SCHEMAS.find(t => t.function.name === 'web_fetch');
    expect(schema).toBeDefined();
    expect(schema!.function.parameters.required).toContain('url');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/web-fetch.test.ts`
Expected: FAIL

**Step 3: Add web_fetch tool**

Add schema to TOOL_SCHEMAS:

```typescript
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description: 'Fetch and extract text content from a URL. Returns cleaned text.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          max_length: { type: 'number', description: 'Max characters to return (default: 4000)' },
        },
        required: ['url'],
      },
    },
  },
```

Add executor case and function:

```typescript
      case 'web_fetch':
        return await execWebFetch(args);
```

```typescript
async function execWebFetch(args: Record<string, unknown>): Promise<string> {
  const url = String(args['url'] ?? '');
  const maxLength = Number(args['max_length'] ?? 4000);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Opta-CLI/1.0' },
    });
    if (!response.ok) return `Error: Fetch returned ${response.status}`;

    const html = await response.text();

    // Simple HTML-to-text: strip tags, decode entities, collapse whitespace
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return text.slice(0, maxLength);
  } catch (err) {
    return `Error: Fetch failed — ${err instanceof Error ? err.message : String(err)}`;
  }
}
```

Add default permission:

```typescript
    web_fetch: 'allow',
```

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/tools.ts tests/core/web-fetch.test.ts
git commit -m "feat: add web_fetch tool for URL content extraction"
```

---

### Task 9: delete_file Tool

**Files:**
- Modify: `src/core/tools.ts`
- Add test in existing test file

**Step 1: Add tool schema, executor, and permission**

Add to TOOL_SCHEMAS:

```typescript
  {
    type: 'function' as const,
    function: {
      name: 'delete_file',
      description: 'Delete a file from the filesystem.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
        },
        required: ['path'],
      },
    },
  },
```

Add executor case:

```typescript
      case 'delete_file':
        return await execDeleteFile(args);
```

Add executor:

```typescript
async function execDeleteFile(args: Record<string, unknown>): Promise<string> {
  const path = resolve(String(args['path'] ?? ''));
  const { unlink } = await import('node:fs/promises');
  await unlink(path);
  return `File deleted: ${relative(process.cwd(), path)}`;
}
```

Add permission:

```typescript
    delete_file: 'ask',
```

**Step 2: Run tests**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/tools.ts
git commit -m "feat: add delete_file tool with permission gating"
```

---

### Task 10: multi_edit Tool

**Files:**
- Modify: `src/core/tools.ts`

**Step 1: Add schema**

```typescript
  {
    type: 'function' as const,
    function: {
      name: 'multi_edit',
      description: 'Apply multiple edits to a single file. Each edit replaces an exact unique string.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (relative to cwd)' },
          edits: {
            type: 'array',
            description: 'Array of {old_text, new_text} pairs',
            items: {
              type: 'object',
              properties: {
                old_text: { type: 'string', description: 'Exact text to find' },
                new_text: { type: 'string', description: 'Replacement text' },
              },
              required: ['old_text', 'new_text'],
            },
          },
        },
        required: ['path', 'edits'],
      },
    },
  },
```

**Step 2: Add executor**

```typescript
      case 'multi_edit':
        return await execMultiEdit(args);
```

```typescript
async function execMultiEdit(args: Record<string, unknown>): Promise<string> {
  const path = resolve(String(args['path'] ?? ''));
  const edits = args['edits'] as Array<{ old_text: string; new_text: string }> ?? [];

  if (edits.length === 0) return 'Error: No edits provided';

  let content = await readFile(path, 'utf-8');
  const applied: string[] = [];

  for (let i = 0; i < edits.length; i++) {
    const { old_text, new_text } = edits[i]!;
    const occurrences = content.split(old_text).length - 1;
    if (occurrences === 0) {
      return `Error: Edit ${i + 1} — old_text not found in ${relative(process.cwd(), path)}`;
    }
    if (occurrences > 1) {
      return `Error: Edit ${i + 1} — old_text appears ${occurrences} times (must be unique)`;
    }
    content = content.replace(old_text, new_text);
    applied.push(`Edit ${i + 1}: applied`);
  }

  await writeFile(path, content, 'utf-8');
  return `File edited: ${relative(process.cwd(), path)} (${applied.length} edits applied)`;
}
```

Add permission:

```typescript
    multi_edit: 'ask',
```

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/tools.ts
git commit -m "feat: add multi_edit tool for batch file edits"
```

---

### Task 11: save_memory Tool

**Files:**
- Modify: `src/core/tools.ts`

**Step 1: Add schema and executor**

Schema:

```typescript
  {
    type: 'function' as const,
    function: {
      name: 'save_memory',
      description: 'Save a piece of knowledge to the project memory file (.opta/memory.md) for cross-session persistence.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Knowledge to persist (decisions, patterns, lessons)' },
          category: { type: 'string', description: 'Category: decision, pattern, lesson, note' },
        },
        required: ['content'],
      },
    },
  },
```

Executor:

```typescript
      case 'save_memory':
        return await execSaveMemory(args);
```

```typescript
async function execSaveMemory(args: Record<string, unknown>): Promise<string> {
  const content = String(args['content'] ?? '');
  const category = String(args['category'] ?? 'note');
  const timestamp = new Date().toISOString().split('T')[0];

  const memoryPath = resolve(process.cwd(), '.opta', 'memory.md');

  const { mkdir } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  await mkdir(dirname(memoryPath), { recursive: true });

  let existing = '';
  try {
    existing = await readFile(memoryPath, 'utf-8');
  } catch {
    existing = '# Project Memory\n\n';
  }

  const entry = `\n## [${category}] ${timestamp}\n\n${content}\n`;
  await writeFile(memoryPath, existing + entry, 'utf-8');

  return `Memory saved to .opta/memory.md (${category})`;
}
```

Permission:

```typescript
    save_memory: 'allow',
```

**Step 2: Run tests, commit**

Run: `npm test`
Expected: PASS

```bash
git add src/core/tools.ts
git commit -m "feat: add save_memory tool for cross-session persistence"
```

---

### Task 12: Update CLI Help and Tests

**Files:**
- Modify: `tests/cli.test.ts` (update command lists)
- Modify: `src/core/tools.ts` (update default permissions in config)

**Step 1: Update tests**

In `tests/cli.test.ts`, update the commands list and global options to include new flags:

Add test for `--auto` and `--dangerous`:

```typescript
  it('chat command accepts --auto flag', async () => {
    const result = await run(['chat', '--help']);
    expect(result.stdout).toContain('--auto');
    expect(result.stdout).toContain('--dangerous');
  });

  it('do command accepts --auto flag', async () => {
    const result = await run(['do', '--help']);
    expect(result.stdout).toContain('--auto');
    expect(result.stdout).toContain('--dangerous');
  });
```

**Step 2: Update config defaults**

In `src/core/config.ts`, update the permissions default to include new tools:

```typescript
  permissions: z
    .record(z.string(), ToolPermission)
    .default({
      read_file: 'allow',
      list_dir: 'allow',
      search_files: 'allow',
      find_files: 'allow',
      edit_file: 'ask',
      write_file: 'ask',
      multi_edit: 'ask',
      delete_file: 'ask',
      run_command: 'ask',
      ask_user: 'allow',
      read_project_docs: 'allow',
      web_search: 'allow',
      web_fetch: 'allow',
      save_memory: 'allow',
    }),
```

**Step 3: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add tests/cli.test.ts src/core/config.ts
git commit -m "feat: update tests and config for new tools and permission flags"
```

---

## Phase 3: Plan Mode

### Task 13: Plan Mode Foundation — /plan Slash Command + Tool Filtering

**Files:**
- Modify: `src/commands/chat.ts` (add mode state, /plan command)
- Modify: `src/mcp/registry.ts` (add mode-based tool filtering)
- Create: `tests/commands/plan.test.ts`

**Step 1: Write the failing test**

Create `tests/commands/plan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS } from '../src/core/tools.js';

describe('plan mode tool filtering', () => {
  const READ_ONLY_TOOLS = new Set([
    'read_file', 'list_dir', 'search_files', 'find_files',
    'ask_user', 'read_project_docs', 'web_search', 'web_fetch',
  ]);

  const WRITE_TOOLS = new Set([
    'edit_file', 'write_file', 'multi_edit', 'delete_file',
    'run_command', 'save_memory',
  ]);

  it('all tools are classified as read or write', () => {
    for (const schema of TOOL_SCHEMAS) {
      const name = schema.function.name;
      const isRead = READ_ONLY_TOOLS.has(name);
      const isWrite = WRITE_TOOLS.has(name);
      expect(isRead || isWrite, `Tool "${name}" is not classified`).toBe(true);
    }
  });
});
```

**Step 2: Run test**

Run: `npm test -- tests/commands/plan.test.ts`
Expected: PASS (this validates tool categorization)

**Step 3: Add mode state and /plan to chat.ts**

In `src/commands/chat.ts`, add mode state variable after session initialization:

```typescript
  type OptaMode = 'normal' | 'plan' | 'auto-accept';
  let currentMode: OptaMode = opts.plan ? 'plan' : 'normal';
  if (opts.dangerous || opts.yolo) currentMode = 'normal'; // dangerous handled by config mode
  if (opts.auto) currentMode = 'auto-accept';
```

Add mode indicator to the prompt:

```typescript
  function getPromptMessage(): string {
    switch (currentMode) {
      case 'plan': return chalk.magenta('[PLAN]') + ' ' + chalk.cyan('you:');
      case 'auto-accept': return chalk.yellow('[AUTO]') + ' ' + chalk.cyan('you:');
      default: return chalk.cyan('you:');
    }
  }
```

Replace the `input({ message: chalk.cyan('you:') })` call with:

```typescript
  userInput = await input({ message: getPromptMessage() });
```

Add `/plan` case to the slash command handler:

```typescript
    case '/plan': {
      if (arg === 'off' || (currentMode === 'plan' && !arg)) {
        currentMode = 'normal';
        console.log(chalk.green('✓') + ' Exited plan mode');
      } else {
        currentMode = 'plan';
        console.log(chalk.magenta('✓') + ' Entered plan mode — read-only exploration');
        console.log(chalk.dim('  Tools: read, search, list, find, ask, web_search, web_fetch'));
        console.log(chalk.dim('  Type /plan off to exit'));
      }
      return 'handled';
    }
```

Update help text to include /plan.

**Step 4: Add mode filtering to registry**

In `src/mcp/registry.ts`, modify `buildToolRegistry` signature and filtering:

```typescript
export async function buildToolRegistry(
  config: OptaConfig,
  mode: string = 'normal'
): Promise<ToolRegistry> {
```

After building `allSchemas`, add filtering:

```typescript
  const WRITE_TOOL_NAMES = new Set([
    'edit_file', 'write_file', 'multi_edit', 'delete_file',
    'run_command', 'save_memory',
  ]);

  let filteredSchemas = allSchemas;
  if (mode === 'plan') {
    filteredSchemas = allSchemas.filter(s => !WRITE_TOOL_NAMES.has(s.function.name));
  }

  return {
    schemas: filteredSchemas,
    // ... rest unchanged
  };
```

**Step 5: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/commands/chat.ts src/mcp/registry.ts tests/commands/plan.test.ts
git commit -m "feat: plan mode with /plan command and tool filtering"
```

---

### Task 14: Plan Mode System Prompt Injection

**Files:**
- Modify: `src/core/agent.ts` (add mode parameter, inject plan prompt)

**Step 1: Add mode to agentLoop and buildSystemPrompt**

Add `mode` to `AgentLoopOptions`:

```typescript
export interface AgentLoopOptions {
  existingMessages?: AgentMessage[];
  sessionId?: string;
  silent?: boolean;
  mode?: string;
}
```

In `buildSystemPrompt`, add plan mode instructions when mode is 'plan':

```typescript
export async function buildSystemPrompt(config: OptaConfig, cwd?: string, mode?: string): Promise<string> {
  // ... existing code ...

  if (mode === 'plan') {
    prompt += `\n\nYou are in PLAN MODE. You are a software architect helping design an implementation approach.

CRITICAL CONSTRAINTS:
- You are READ-ONLY. You MUST NOT call edit_file, write_file, multi_edit, delete_file, or run_command.
- You CAN use: read_file, list_dir, search_files, find_files, read_project_docs, ask_user, web_search, web_fetch
- Your goal is to explore the codebase and produce a clear implementation plan.

PLANNING PROCESS:
1. Understand the request — ask ONE clarifying question at a time if needed
2. Explore the codebase — read relevant files, search for patterns
3. Propose 2-3 approaches with trade-offs, lead with your recommendation
4. Present the plan in sections, checking after each
5. Conclude with: critical files to modify, estimated scope, risks

When your plan is complete, say: "Plan complete. Ready to implement?"`;
  }

  return prompt;
}
```

Pass mode to `buildToolRegistry`:

```typescript
  const registry = await buildToolRegistry(config, options?.mode);
```

And to `buildSystemPrompt`:

```typescript
  { role: 'system', content: await buildSystemPrompt(config, undefined, options?.mode) },
```

In `src/commands/chat.ts`, pass mode to agentLoop:

```typescript
      const result = await agentLoop(userInput, config, {
        existingMessages: session.messages,
        sessionId: session.id,
        silent: jsonMode,
        mode: currentMode === 'plan' ? 'plan' : undefined,
      });
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/agent.ts src/commands/chat.ts
git commit -m "feat: plan mode system prompt injection and tool registry filtering"
```

---

## Phase 4: Multimodal + QoL

### Task 15: Extend AgentMessage for Multimodal Content

**Files:**
- Modify: `src/core/agent.ts:14-23` (extend AgentMessage type)
- Create: `tests/core/multimodal.test.ts`

**Step 1: Write the failing test**

Create `tests/core/multimodal.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { AgentMessage, ContentPart } from '../src/core/agent.js';

describe('multimodal message format', () => {
  it('accepts string content', () => {
    const msg: AgentMessage = { role: 'user', content: 'hello' };
    expect(msg.content).toBe('hello');
  });

  it('accepts content array with text and image', () => {
    const parts: ContentPart[] = [
      { type: 'text', text: 'What is this?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
    ];
    const msg: AgentMessage = { role: 'user', content: parts };
    expect(Array.isArray(msg.content)).toBe(true);
    expect((msg.content as ContentPart[])[0]!.type).toBe('text');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/multimodal.test.ts`
Expected: FAIL (ContentPart not exported)

**Step 3: Update AgentMessage type**

In `src/core/agent.ts`, replace the `AgentMessage` interface:

```typescript
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}
```

Update `estimateTokens` to handle content arrays:

```typescript
function estimateTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, m) => {
    let contentLen = 0;
    if (typeof m.content === 'string') {
      contentLen = m.content.length;
    } else if (Array.isArray(m.content)) {
      contentLen = m.content.reduce((s, p) => {
        if (p.type === 'text') return s + p.text.length;
        if (p.type === 'image_url') return s + 1000; // estimate image tokens
        return s;
      }, 0);
    }
    const toolCallsStr = m.tool_calls ? JSON.stringify(m.tool_calls) : '';
    return sum + Math.ceil((contentLen + toolCallsStr.length) / 4);
  }, 0);
}
```

**Step 4: Run test**

Run: `npm test -- tests/core/multimodal.test.ts`
Expected: PASS

**Step 5: Run full suite**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/agent.ts tests/core/multimodal.test.ts
git commit -m "feat: extend AgentMessage for multimodal content arrays"
```

---

### Task 16: /image Slash Command + Image File Detection

**Files:**
- Modify: `src/commands/chat.ts` (add /image command, file path detection)

**Step 1: Add /image slash command**

In the slash command handler in `chat.ts`, add:

```typescript
    case '/image': {
      if (!arg) {
        console.log(chalk.dim('  Usage: /image <path> [question]'));
        return 'handled';
      }

      const parts = arg.split(/\s+/);
      const imagePath = parts[0]!;
      const question = parts.slice(1).join(' ') || 'What is in this image?';

      try {
        const { readFile: readFs } = await import('node:fs/promises');
        const { resolve: resolvePath, extname } = await import('node:path');
        const fullPath = resolvePath(imagePath);
        const data = await readFs(fullPath);
        const base64 = data.toString('base64');
        const ext = extname(fullPath).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;

        // Set title from first image
        if (!session.title) {
          session.title = generateTitle(question);
        }

        const result = await agentLoop(question, config, {
          existingMessages: session.messages,
          sessionId: session.id,
          silent: jsonMode,
          mode: currentMode === 'plan' ? 'plan' : undefined,
          imageBase64: `data:image/${mime};base64,${base64}`,
        });

        session.messages = result.messages;
        session.toolCallCount += result.toolCallCount;
        await saveSession(session);

        console.log(chalk.green('✓') + ` Image analyzed: ${imagePath}`);
      } catch (err) {
        console.error(chalk.red('✗') + ` Failed to read image: ${err instanceof Error ? err.message : err}`);
      }
      return 'handled';
    }
```

Add `imageBase64` to `AgentLoopOptions`:

```typescript
export interface AgentLoopOptions {
  existingMessages?: AgentMessage[];
  sessionId?: string;
  silent?: boolean;
  mode?: string;
  imageBase64?: string;
}
```

In the agentLoop, when building the user message, include image if present:

```typescript
  const userMessage: AgentMessage = options?.imageBase64
    ? {
        role: 'user',
        content: [
          { type: 'text', text: task },
          { type: 'image_url', image_url: { url: options.imageBase64 } },
        ],
      }
    : { role: 'user', content: task };

  const messages: AgentMessage[] = options?.existingMessages
    ? [...options.existingMessages, userMessage]
    : [
        { role: 'system', content: await buildSystemPrompt(config, undefined, options?.mode) },
        userMessage,
      ];
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/commands/chat.ts src/core/agent.ts
git commit -m "feat: add /image slash command for multimodal input"
```

---

### Task 17: Version Bump + Final Validation

**Files:**
- Modify: `package.json` (bump version)
- Modify: `tests/cli.test.ts` (ensure all new features appear in help)

**Step 1: Update version**

Bump version in `package.json` from `0.2.0-alpha.3` to `0.3.0-alpha.1`.

**Step 2: Update help tests**

In `tests/cli.test.ts`, update the expected tools/commands list to verify new flags appear in help output.

**Step 3: Run full validation**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

Expected: All pass

**Step 4: Commit**

```bash
git add package.json tests/cli.test.ts
git commit -m "chore: bump to v0.3.0-alpha.1 with V2 features"
```

---

## Summary

| Phase | Tasks | New/Modified Files | Tools Added |
|-------|-------|-------------------|-------------|
| 1: Context + Safety | 1-6 | 8 files | — |
| 2: Tool Expansion | 7-12 | 4 files | web_search, web_fetch, delete_file, multi_edit, save_memory |
| 3: Plan Mode | 13-14 | 4 files | — |
| 4: Multimodal | 15-17 | 3 files | /image command |

**Total new tools:** 5 (9 → 14 built-in)
**Total new files:** ~6 created, ~8 modified
**Estimated tasks:** 17 TDD tasks with ~80 steps
