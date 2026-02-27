---
title: External Knowledge Base
purpose: References, APIs, research, external resources
updated: 2026-02-15
---

# Opta CLI — External Knowledge Base

This document points to external resources, APIs, and research that informs Opta CLI development.

When you're working on Opta CLI and need to understand something external, check this document first.

---

## Opta-LMX API Reference

**Note:** Opta-LMX exposes an OpenAI-compatible API on port 1234. The endpoints below follow the OpenAI `/v1/` convention.

### Key Endpoints Used by Opta CLI

#### List Models
```bash
GET /v1/models

Response:
{
  "object": "list",
  "data": [
    {
      "id": "Qwen2.5-72B-Instruct-4bit",
      "object": "model",
      "owned_by": "opta-lmx",
      "state": "loaded" | "available"
    }
  ]
}
```

**Usage in Opta CLI:** `src/commands/models.ts` — lists loaded + available models

#### Chat Completions (Streaming)
```bash
POST /v1/chat/completions

Request:
{
  "model": "Qwen2.5-72B",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "tools": [{ "type": "function", "function": { ... } }],
  "tool_choice": "auto",
  "stream": true
}

Response (streaming):
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"tool_calls":[{"id":"1","function":{"name":"read_file"}}]}}]}
data: [DONE]
```

**Usage in Opta CLI:** `src/core/agent.ts` — main agent loop, streaming responses

#### Load Model
```bash
POST /v1/models/load

Request:
{
  "model": "Qwen2.5-72B"
}

Response:
{
  "id": "Qwen2.5-72B",
  "state": "loaded"
}
```

**Usage in Opta CLI:** V2+ feature (model auto-loading)

---

## OpenAI Function Calling Specification

**Official docs:** https://platform.openai.com/docs/guides/function-calling

### Tool Schema Format

```json
{
  "type": "function",
  "function": {
    "name": "read_file",
    "description": "Read a file's contents",
    "parameters": {
      "type": "object",
      "properties": {
        "path": {
          "type": "string",
          "description": "Path to file"
        },
        "offset": {
          "type": "integer",
          "description": "Starting line (optional)"
        }
      },
      "required": ["path"]
    }
  }
}
```

**Key rules:**
- Name: 64 chars max, alphanumeric + underscores only
- Description: Keep under 500 chars
- Parameters: Always `type: "object"` for top level
- Required: List of required parameters

**Opta CLI usage:** `src/core/tools.ts` — defines all 8 tools

### Tool Call Response Format

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    {
      "id": "call_1234",
      "type": "function",
      "function": {
        "name": "read_file",
        "arguments": "{\"path\": \"src/index.ts\"}"
      }
    }
  ]
}
```

**Arguments are JSON string (not object).** Must parse as JSON.

**Opta CLI usage:** `src/core/agent.ts` — parses tool calls from responses

### Tool Result Format

```json
{
  "role": "tool",
  "tool_call_id": "call_1234",
  "content": "file contents here"
}
```

**Opta CLI usage:** `src/core/agent.ts` — sends results back to model

---

## OpenAI SDK (v4.x)

**NPM:** `npm install openai@4.77.0`

**Docs:** https://github.com/openai/node-sdk

### Key Methods Used by Opta CLI

```typescript
import OpenAI from 'openai';

// Create client pointing to Opta-LMX
const client = new OpenAI({
  apiKey: 'any-value',  // Opta-LMX doesn't authenticate
  baseURL: 'http://192.168.188.11:1234/v1',
});

// Chat completions with streaming
const stream = await client.chat.completions.create({
  model: 'Qwen2.5-72B',
  messages: [...],
  tools: [...],
  tool_choice: 'auto',
  stream: true,
});

// Iterate over stream
for await (const event of stream) {
  const delta = event.choices[0]?.delta;
  if (delta?.content) {
    // Streaming token
    process.stdout.write(delta.content);
  }
  if (delta?.tool_calls) {
    // Tool call fragment
  }
}
```

**Opta CLI usage:** `src/lmx/client.ts` — creates OpenAI client for Opta-LMX

---

## Zod Validation

**NPM:** `npm install zod@3.24.0`

**Docs:** https://zod.dev

### Used in Opta CLI

```typescript
import { z } from 'zod';

// Config validation
const ConfigSchema = z.object({
  connection: z.object({
    host: z.string().default('192.168.188.11'),
    port: z.number().default(1234),
  }),
  model: z.object({
    name: z.string(),
    contextLimit: z.number().positive(),
  }),
});

// Parse and validate
const config = ConfigSchema.parse(rawConfig);

// Type inference
type OptaConfig = z.infer<typeof ConfigSchema>;
```

**Opta CLI usage:** 
- `src/core/config.ts` — validates config schema
- `src/core/tools.ts` — validates tool responses

---

## Commander.js CLI Framework

**NPM:** `npm install commander@13.0.0`

**Docs:** https://github.com/tj/commander.js

### Used in Opta CLI

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .version('0.1.0')
  .description('Opta CLI')
  .option('--verbose', 'verbose output')
  .option('--debug', 'debug logging');

program
  .command('chat')
  .description('Start interactive chat')
  .option('--resume <id>', 'resume session')
  .option('--model <name>', 'use specific model')
  .action(async (opts) => {
    const { startChat } = await import('./commands/chat.js');
    await startChat(opts);
  });

program.parse();
```

**Opta CLI usage:** `src/index.ts` — defines all commands and options

---

## Cosmiconfig (Project Config Discovery)

**NPM:** `npm install cosmiconfig@9.0.0`

**Docs:** https://github.com/davidtheclark/cosmiconfig

### Used in Opta CLI

```typescript
import { cosmiconfigSync } from 'cosmiconfig';

const explorer = cosmiconfigSync('opta');
const result = explorer.search(process.cwd());

if (result?.config) {
  // Found .opta/config.json or .optarc.json or opta.config.js
  console.log(result.config);
}
```

**Use case:** Load `.opta/config.json` from project directory (overrides user config)

**Opta CLI usage:** `src/core/config.ts` — discovers project config

---

## Conf (User Config Persistence)

**NPM:** `npm install conf@13.0.0`

**Docs:** https://github.com/sindresorhus/conf

### Used in Opta CLI

```typescript
import Conf from 'conf';

const config = new Conf({
  projectName: 'opta',
  cwd: '~/.config', // Usually ~/.config/opta/
});

// Store config
config.set('connection.host', '192.168.188.11');
config.set('model.default', 'Qwen2.5-72B');

// Retrieve config
const host = config.get('connection.host');

// Clear everything
config.clear();
```

**Use case:** Persist user settings between sessions

**Opta CLI usage:** `src/core/config.ts` — loads/saves user config

---

## Marked (Markdown Parsing)

**NPM:** `npm install marked@15.0.0`

**Docs:** https://marked.js.org

### Used in Opta CLI

```typescript
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

marked.setOptions({
  renderer: new TerminalRenderer(),
});

const html = marked('# Hello\n\nThis is **bold**.');
console.log(html); // Renders as terminal-friendly output
```

**Use case:** Render model responses (often markdown) to terminal

**Opta CLI usage:** `src/ui/markdown.ts` — renders markdown responses

---

## Ora (Terminal Spinners)

**NPM:** `npm install ora@8.0.0`

**Docs:** https://github.com/sindresorhus/ora

### Used in Opta CLI

```typescript
import ora from 'ora';

const spinner = ora('Reading file...').start();

setTimeout(() => {
  spinner.succeed('File read successfully');
}, 1000);
```

**Use case:** Show activity while reading/writing files, calling models

**Opta CLI usage:** `src/ui/spinner.ts` — wraps ora with non-TTY fallback

---

## Execa (Shell Command Execution)

**NPM:** `npm install execa@9.0.0`

**Docs:** https://github.com/sindresorhus/execa

### Used in Opta CLI

```typescript
import { execa } from 'execa';

const { stdout, stderr, exitCode } = await execa('npm', ['test']);
console.log('stdout:', stdout);
console.log('exit code:', exitCode);
```

**Use case:** Execute `run_command` tool (bash commands)

**Opta CLI usage:** `src/core/tools.ts` — executes commands for `run_command` tool

---

## Fast-Glob (File Search)

**NPM:** `npm install fast-glob@3.3.0`

**Docs:** https://github.com/mrmlnc/fast-glob

### Used in Opta CLI

```typescript
import fg from 'fast-glob';

// Find all .ts files
const files = await fg(['**/*.ts'], {
  cwd: process.cwd(),
  ignore: ['node_modules', '.git'],
});

console.log(files); // ['src/index.ts', 'src/core/agent.ts', ...]
```

**Use case:** `find_files` tool (glob-based file search)

**Opta CLI usage:** `src/core/tools.ts` — implements `find_files` tool

---

## Research Documents (In This Repo)

### Location
`docs/research/`

### Documents

1. **`ai-cli-landscape-2026.md`** (5.3 KB)
   - Survey of AI coding CLI tools
   - Aider, Cursor, Claude Code, OpenCode, Cline, Kimi
   - Patterns and features each tool implements
   - Competitive analysis

2. **`aider-features.md`** (stub)
   - Deep dive on Aider's architecture and features
   - Tool definitions, auto-commit, diff-based editing
   - Add content as needed

3. **`opencode-kimi-features.md`** (stub)
   - OpenCode (MIT) and Kimi's advanced features
   - LSP integration, orchestration patterns
   - Add content as needed

4. **`cursor-continue-features.md`** (stub)
   - IDE integration from Cursor and Continue
   - Real-time feedback, diagnostics
   - Add content as needed

5. **`best-practices.md`** (stub)
   - Best practices from AI CLI design
   - Error handling, permissions, streaming
   - Add content as needed

### How to Use

When designing a feature:
1. Check if Aider/Cursor/OpenCode has something similar
2. Look in `ai-cli-landscape-2026.md` for comparison
3. Note what patterns work well
4. Decide if Opta CLI should adopt or differ

Example: "Should Opta auto-commit changes?"
- Aider: Yes, with `--auto-commit` flag
- Claude Code: No (user controls)
- Opta decision: V1 no, V2+ optional with `--auto-commit`

---

## AIALL Skills Location

**Path:** `~/Synced/AIALL/1-Skills/`

### Available Skills

Skills provide reusable tools and utilities for Opta CLI:

| Skill | Purpose | Opta CLI Use |
|-------|---------|------------|
| (check AIALL directory) | ... | ... |

### How to Load Skills in V2+

```typescript
// In src/skills/loader.ts (currently a stub)
import { loadSkillsFromDirectory } from 'aiall-sdk';

const skills = await loadSkillsFromDirectory('~/.openclaw/skills/');
// Extend tool definitions from skills
```

---

## Token Counting

**Resource:** Understanding token limits

For Opta CLI, token counting matters because:
1. Opta-LMX serves models with finite context windows (8K, 16K, 32K, 128K depending on model)
2. System prompt + conversation history must fit
3. Context compaction triggers at 70% of limit

### Token Count Estimates

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt (tools) | ~1.5K | 8 tool schemas |
| Base instructions | ~500 | Who you are, what you do |
| Project memory | 200-500 | `.opta/memory.md` |
| Recent turns (5) | 500-1K | Recent user + assistant messages |
| Tool results | Variable | Can be large (file contents) |

### Rough Formula

```
Total tokens = System (2.5K) + Conversation (Variable)

For an 8K model:
- Safe zone: < 5.5K (leaves 2.5K buffer)
- Compaction triggers at 5.6K (70% of 8K)

For a 32K model:
- Safe zone: < 22.4K (leaves 9.6K buffer)
- Compaction triggers at 22.4K (70% of 32K)
```

### Implementation

In Opta CLI, use `src/core/agent.ts` `tokenCount()` function (or Tiktoken library):

```typescript
import { encoding_for_model } from 'js-tiktoken';

const enc = encoding_for_model('gpt-3.5-turbo'); // Fallback encoding
const tokens = enc.encode(text);
const count = tokens.length;
```

---

## Streaming Response Handling

**Pattern:** Collect tokens and tool calls from streaming API response

```typescript
let fullText = '';
let toolCalls: ToolCall[] = [];

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  
  if (delta?.content) {
    fullText += delta.content;
    process.stdout.write(delta.content); // Stream to terminal
  }
  
  if (delta?.tool_calls) {
    for (const toolCall of delta.tool_calls) {
      // Accumulate tool call fragments
      if (!toolCalls[toolCall.index]) {
        toolCalls[toolCall.index] = {
          id: toolCall.id,
          function: { name: '', arguments: '' },
        };
      }
      if (toolCall.function?.name) {
        toolCalls[toolCall.index].function.name = toolCall.function.name;
      }
      if (toolCall.function?.arguments) {
        toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
      }
    }
  }
}

return { text: fullText, toolCalls };
```

---

## When to Search These Resources

| Task | Search | Resource |
|------|--------|----------|
| Adding a new tool | Tool schemas | OpenAI Function Calling Spec |
| Debugging streaming | Token parsing | Opta-LMX API (OpenAI-compatible) |
| Validation errors | Type checking | Zod Docs |
| Config loading | Project discovery | Cosmiconfig Docs |
| Performance issues | Token limits | This KNOWLEDGE.md (Token Counting) |
| Competitive features | What others do | `docs/research/ai-cli-landscape-2026.md` |
| CLI command design | Best practices | Commander.js + AIALL skills |

---

## Quick Reference Links

| Resource | URL | When to Use |
|----------|-----|-----------|
| Opta-LMX API | OpenAI-compatible (port 1234) | Implementing model features |
| OpenAI SDK | https://github.com/openai/node-sdk | Using OpenAI client |
| OpenAI function-calling | https://platform.openai.com/docs/guides/function-calling | Defining tools |
| Zod | https://zod.dev | Validating config/responses |
| Commander.js | https://github.com/tj/commander.js | Adding commands |
| Marked | https://marked.js.org | Rendering markdown |
| Ora | https://github.com/sindresorhus/ora | Showing spinners |
| Execa | https://github.com/sindresorhus/execa | Running commands |
| Fast-Glob | https://github.com/mrmlnc/fast-glob | File searching |
| Cosmiconfig | https://github.com/davidtheclark/cosmiconfig | Project config |
| Conf | https://github.com/sindresorhus/conf | User config |

---

## Keeping This Updated

When you:
- **Use a new library:** Add it to this document with NPM version + docs link
- **Discover a pattern:** Document it here for future reference
- **Add research:** Put it in `docs/research/` and link from here
- **Learn something:** Write it down

**Future developers will thank you.**
