---
title: "Opta CLI V2 Features Design: Git, Repo Awareness, MCP, OPIS Integration"
status: approved
created: 2026-02-15
author: Matthew Byrden + Claude Opus 4.6
scope: V2 feature set — 4 capabilities + 1 command
reference: docs/plans/2026-02-12-opta-cli-v1-design.md
---

# Opta CLI V2 — Feature Design

## Context

Opta CLI V1 delivers agentic chat, tool-use, and LMX connectivity. V2 closes the gap with leading AI coding CLIs (Claude Code, Codex, Aider) by adding four capabilities that the competitive landscape has proven essential, plus native integration with the OPIS documentation system.

### Competitive Analysis (Feb 2026)

| Feature | Claude Code | Codex CLI | Aider | Gemini CLI | Opta CLI V1 | Opta CLI V2 |
|---------|-------------|-----------|-------|------------|-------------|-------------|
| Git integration | Commits, branches, PRs | Sandbox + approval | Auto-commit per edit | Basic | None | Checkpoint + commit |
| Repo awareness | Subagents (Explore, Plan) | Repo structure | Tree-sitter + PageRank | File operations | Reactive tools only | OPIS + export map |
| MCP support | Native (hundreds of servers) | Native | No | Native | Stub | Config + OPIS hints |
| Project docs | CLAUDE.md | AGENTS.md | None | GEMINI.md | .opta/memory.md | Full OPIS scaffold |

### Design Decisions Summary

| Feature | Decision | Alternatives Rejected | Reasoning |
|---------|----------|----------------------|-----------|
| OPIS injection | Hybrid (summary + tool) | Full injection, on-demand only | Balances always-on identity with token efficiency |
| Git integration | Checkpoint snapshots + task commit | Auto-commit per edit, auto-commit per task | Clean history AND granular undo |
| MCP discovery | Config-based + OPIS hints | Auto-discovery, config-only | Security-first with intelligent suggestions |
| Repo awareness | File tree + export map | File tree only, tree-sitter | OPIS covers architecture; export map covers symbols; no native deps |
| `opta init` | Structured command flow | Agent-driven OPIS | Deterministic questions, reliable on any model size |

---

## Feature 1: OPIS Integration

### What

Opta CLI becomes OPIS-aware — reading project documentation at session start and injecting structured context into the system prompt. Replaces `.opta/memory.md` with the richer OPIS scaffold.

### System Prompt Injection (Hybrid Approach)

At session start, the CLI reads the project's OPIS docs and injects a compressed summary (~500 tokens) into the system prompt:

```
Project identity:
  Name: {APP.md frontmatter: title}
  Type: {APP.md frontmatter: type}
  Status: {APP.md frontmatter: status}
  Purpose: {APP.md section 2, first sentence}

Guardrails (never violate):
  {GUARDRAILS.md — all G-XX rules, one line each}

Recent decisions:
  {DECISIONS.md — last 5 entries, one line each}

For full project docs, use: read_project_docs(file)
Available: APP.md, ARCHITECTURE.md, GUARDRAILS.md, DECISIONS.md,
           ECOSYSTEM.md, KNOWLEDGE.md, WORKFLOWS.md, ROADMAP.md
```

### `read_project_docs` Tool

New tool added to the 8 existing tools (becomes tool #9):

```typescript
{
  name: 'read_project_docs',
  description: 'Read an OPIS project document. Available files: APP.md, ARCHITECTURE.md, GUARDRAILS.md, DECISIONS.md, ECOSYSTEM.md, KNOWLEDGE.md, WORKFLOWS.md, ROADMAP.md, INDEX.md',
  parameters: {
    type: 'object',
    properties: {
      file: { type: 'string', description: 'Document filename (e.g., ARCHITECTURE.md)' },
    },
    required: ['file'],
  },
}
```

The executor searches for the file in this order:
1. `./docs/{file}` (project docs directory)
2. `./{file}` (project root — for APP.md, CLAUDE.md)
3. `./ARCHITECTURE.md` (root-level architecture doc)

Returns the file contents, or a clear message if the project has no OPIS docs (with suggestion to run `opta init`).

### Fallback: Non-OPIS Projects

If no OPIS scaffold is found, fall back to:
1. `.opta/memory.md` (current behavior)
2. `CLAUDE.md` (if it exists)
3. No project context (with a one-time suggestion: "Run `opta init` to set up project docs")

### Implementation

**New file:** `src/context/opis.ts` (~80 lines)

```typescript
export interface OpisContext {
  summary: string;       // Compressed text for system prompt
  hasOpis: boolean;      // Whether OPIS scaffold was found
  docsDir: string;       // Path to docs directory
}

export async function loadOpisContext(cwd: string): Promise<OpisContext>;
export async function readProjectDoc(cwd: string, file: string): Promise<string>;
```

**Modified file:** `src/core/agent.ts` — `buildSystemPrompt()` calls `loadOpisContext()` and appends the summary.

**Modified file:** `src/core/tools.ts` — Add `read_project_docs` tool schema and executor.

---

## Feature 2: Git Integration

### What

Automatic git checkpoint snapshots during the agent loop, with a single clean commit when the task completes. Plus `/undo` support for mid-task rollback.

### Checkpoint System

**During the agent loop**, after each successful `edit_file` or `write_file`:

1. Generate a patch: `git diff -- <changed-file>`
2. Write to `.opta/checkpoints/<session-id>/<n>.patch`
3. Metadata file: `.opta/checkpoints/<session-id>/index.json`

```json
{
  "session": "abc123",
  "checkpoints": [
    { "n": 1, "tool": "edit_file", "path": "src/auth.ts", "timestamp": "..." },
    { "n": 2, "tool": "write_file", "path": "src/auth.test.ts", "timestamp": "..." }
  ]
}
```

Patches are lightweight (just diffs), don't touch git history, and can be applied in reverse.

### Task Commit

When the agent loop completes (model response with no tool calls):

1. Check if any files were modified during the session
2. If yes, stage all changed files: `git add <list of modified files>`
3. Generate commit message: send the session summary to the model with prompt "Generate a concise git commit message for these changes"
4. Commit: `git commit -m "<generated message>"`
5. Clean up: remove `.opta/checkpoints/<session-id>/`

### `/undo` Slash Command

In chat mode, the user can type `/undo` to reverse the last edit:

```
/undo         → Reverse the most recent checkpoint
/undo 3       → Reverse checkpoint #3 specifically
/undo list    → Show all checkpoints with descriptions
```

Implementation: `git apply -R .opta/checkpoints/<session>/<n>.patch`

After undo, inform the model what was reversed so it adjusts its approach.

### `opta diff` Command

New top-level command showing all uncommitted changes from the current or most recent session:

```bash
opta diff              # Show current session's changes
opta diff --session <id>  # Show specific session's changes
```

### Flags

- `--no-commit` — Disable auto-commit at task end (for manual control)
- `--no-checkpoints` — Disable checkpoint creation (lightweight mode)

### Implementation

**New file:** `src/git/checkpoints.ts` (~100 lines)

```typescript
export async function createCheckpoint(
  sessionId: string, n: number, tool: string, path: string
): Promise<void>;

export async function undoCheckpoint(
  sessionId: string, n?: number
): Promise<{ undone: string; path: string }>;

export async function listCheckpoints(
  sessionId: string
): Promise<Checkpoint[]>;

export async function cleanupCheckpoints(sessionId: string): Promise<void>;
```

**New file:** `src/git/commit.ts` (~60 lines)

```typescript
export async function generateCommitMessage(
  messages: AgentMessage[], client: OpenAI, model: string
): Promise<string>;

export async function commitSessionChanges(
  sessionId: string, message: string
): Promise<void>;
```

**New file:** `src/commands/diff.ts` (~40 lines)

**Modified files:**
- `src/core/agent.ts` — After tool execution, call `createCheckpoint()` for edit/write tools
- `src/commands/chat.ts` — Handle `/undo` slash command
- `src/index.ts` — Register `diff` command

### Git Safety

- Never force-push, reset --hard, or destructive operations
- Warn if working tree is dirty at session start (uncommitted changes from outside Opta)
- `.opta/checkpoints/` added to `.gitignore`
- If not in a git repo, skip all git features silently (no errors)

---

## Feature 3: MCP Integration

### What

Connect to external MCP servers (GitHub, databases, documentation, etc.) and expose their tools alongside the built-in tool set. MCP servers are explicitly configured, with OPIS-driven suggestions during `opta init`.

### Configuration

In `.opta/config.json` (or `~/.config/opta/config.json` for global MCPs):

```json
{
  "mcp": {
    "servers": {
      "github": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
      },
      "postgres": {
        "transport": "http",
        "url": "http://localhost:3100/mcp"
      },
      "context7": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@context7/mcp-server"]
      }
    }
  }
}
```

### Transport Support

Two transports (matching the MCP spec):

1. **stdio** — Spawn a child process, communicate via stdin/stdout JSON-RPC. Used for local MCP servers distributed as npm packages.
2. **HTTP (SSE)** — Connect to a remote MCP server via HTTP with Server-Sent Events. Used for hosted/remote MCP servers.

### Tool Schema Merging

At session start:

1. Connect to each configured MCP server
2. Call `tools/list` to fetch available tools
3. Convert MCP tool schemas to OpenAI function-call format
4. Merge with built-in tools (8 + 1 OPIS tool = 9)
5. Pass unified tool list to model

The model sees all tools uniformly. The agent loop routes tool calls:
- Built-in tool name → execute locally (existing behavior)
- MCP tool name → forward to the originating MCP server via `tools/call`

### Tool Count Budget

Local LLMs handle tools well up to a point:

| Model | Comfortable | Degraded | Max |
|-------|-------------|----------|-----|
| Qwen2.5-72B | 10-15 | 15-25 | ~30 |
| GLM-4.7-Flash | 10-20 | 20-30 | ~40 |

With 9 built-in + OPIS tool and 3-5 MCP tools, we're at 12-14 total — well within the comfortable range. If a user configures too many MCPs, warn at startup: "23 tools configured — local models may struggle. Consider reducing MCP servers."

### Error Handling

- MCP server fails to connect → warn, continue without it (don't block session)
- MCP tool call fails → return error to model (it can try alternatives)
- MCP server crashes mid-session → log error, mark server unavailable, continue with remaining tools

### Implementation

**New file:** `src/mcp/client.ts` (~150 lines)

```typescript
export interface McpServer {
  name: string;
  transport: 'stdio' | 'http';
  tools: McpTool[];
  call(toolName: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

export async function connectMcpServer(
  name: string, config: McpServerConfig
): Promise<McpServer>;
```

**New file:** `src/mcp/registry.ts` (~60 lines)

```typescript
export async function buildToolRegistry(
  config: OptaConfig
): Promise<{
  schemas: ToolSchema[];
  execute: (name: string, args: string) => Promise<string>;
}>;
```

**Modified files:**
- `src/core/config.ts` — Add `mcp.servers` to Zod schema
- `src/core/agent.ts` — Use `buildToolRegistry()` instead of hardcoded `TOOL_SCHEMAS`
- `src/core/tools.ts` — Export `executeTool` for registry to wrap

### CLI Commands

```bash
opta mcp list              # Show configured MCP servers and their tools
opta mcp add <name> <cmd>  # Add stdio MCP server to config
opta mcp remove <name>     # Remove MCP server from config
opta mcp test <name>       # Test connection to an MCP server
```

---

## Feature 4: Repo Awareness (Export Map)

### What

At session start, scan source files for top-level exports and inject a concise symbol map (~500-1K tokens) into the system prompt. Combined with OPIS docs, this gives the model both architectural understanding and code-level awareness.

### Export Map Format

```
src/index.ts: program (Command)
src/core/agent.ts: agentLoop(), buildSystemPrompt(), AgentMessage, AgentLoopResult
src/core/config.ts: loadConfig(), saveConfig(), OptaConfig, DEFAULT_CONFIG
src/core/tools.ts: TOOL_SCHEMAS, executeTool(), resolvePermission()
src/core/errors.ts: OptaError, EXIT, formatError(), die()
src/lmx/client.ts: LmxClient, lookupContextLimit(), LmxHealthResponse, LmxModelDetail
src/commands/chat.ts: startChat()
src/commands/models.ts: models()
src/commands/status.ts: status()
src/memory/store.ts: createSession(), loadSession(), saveSession(), Session
```

### Scanner Design

Regex-based, no external dependencies. Patterns per language:

**TypeScript/JavaScript:**
```
export (async )?(function|class|const|let|type|interface|enum) (\w+)
export default (class|function) (\w+)
export \{ (.+) \} from
```

**Python:**
```
^(def|class|async def) (\w+)
^(\w+)\s*=     (top-level assignments)
```

**Swift:**
```
^(public |open )?(func|class|struct|enum|protocol|actor) (\w+)
```

The scanner auto-detects language from file extensions and applies the appropriate patterns.

### File Filtering

Only scan files that matter:
- Respect `.gitignore` (skip node_modules, dist, build, etc.)
- Skip test files (`*.test.ts`, `*.spec.ts`, `__tests__/`)
- Skip generated files (dist/, .next/, DerivedData/)
- Limit to source directories (src/, lib/, app/)
- Cap at 100 files (for very large repos, truncate with "... and 47 more files")

### Context Budget

Target: 500-1000 tokens for the export map. If the scan produces more:
1. Prioritize files modified in the last 7 days (most likely relevant)
2. Truncate older/deeper files with summary: `src/utils/ (12 files, 34 exports)`

### Implementation

**New file:** `src/context/exports.ts` (~80 lines)

```typescript
export interface ExportMap {
  entries: ExportEntry[];
  truncated: boolean;
  fileCount: number;
}

export interface ExportEntry {
  path: string;
  exports: string[];  // Symbol names
}

export async function scanExports(cwd: string): Promise<ExportMap>;
export function formatExportMap(map: ExportMap): string;  // For system prompt
```

**Modified file:** `src/core/agent.ts` — `buildSystemPrompt()` calls `scanExports()` and appends the formatted map.

---

## Feature 5: `opta init` (OPIS Runner)

### What

A structured CLI command that runs the OPIS process: detects project mode, asks targeted questions, generates the full documentation scaffold. The CLI drives the stages; the model only generates the scaffold files.

### Command Flow

```
$ opta init [--mode <mode>] [--force]

Flags:
  --mode     Override auto-detected mode (greenfield, brownfield, companion, migration, ecosystem, fork)
  --force    Overwrite existing OPIS docs (otherwise skip if APP.md exists)
```

### Stage Implementation

**Stage 0: Mode Detection + Analysis** (CLI-driven, no model)

```typescript
async function detectMode(cwd: string): Promise<OpisMode> {
  const hasSourceFiles = await glob('**/*.{ts,js,py,swift}', { cwd }).length > 0;
  const hasAppMd = await fileExists(join(cwd, 'APP.md'));
  const hasParentApp = /* check for --companion flag or sibling APP.md */;

  if (!hasSourceFiles && !hasAppMd) return 'greenfield';
  if (hasSourceFiles && !hasAppMd) return 'brownfield';
  if (hasParentApp) return 'companion';
  return 'brownfield'; // default for existing code
}
```

For non-greenfield modes, run automated analysis:
- Count files, lines, languages
- Read package.json / Cargo.toml / Package.swift for deps
- Read existing README.md, CLAUDE.md
- Summarize findings for the user

**Stage 1: Questions** (CLI-driven via @inquirer/prompts)

Load the 10 mode-specific questions from the OPIS spec. Ask them one at a time using inquirer's `input()` prompt. Collect all answers into a structured object.

```typescript
const answers = [];
for (const question of OPIS_QUESTIONS[mode]) {
  const answer = await input({ message: question });
  answers.push({ question, answer });
}
```

**Stage 4: Scaffold Generation** (Model-driven, one shot)

Send everything to the model in a single agent loop turn:
- Analysis summary (from Stage 0)
- All question-answer pairs (from Stage 1)
- OPIS template instructions (what each file should contain)
- Instruction: "Generate each OPIS file using the write_file tool"

The model calls `write_file` for each scaffold file. The agent loop handles execution.

**Stage 5: MCP Suggestions** (CLI-driven)

If the generated `KNOWLEDGE.md` mentions MCPs, parse them and offer to add to config:

```typescript
const mcps = parseMcpSuggestions(knowledgeMd);
for (const mcp of mcps) {
  const add = await confirm({ message: `Add ${mcp.name} MCP server? (${mcp.description})` });
  if (add) await addMcpToConfig(mcp);
}
```

### Implementation

**New file:** `src/commands/init.ts` (~200 lines)

**New file:** `src/opis/questions.ts` (~80 lines) — Mode-specific question sets from OPIS spec

**New file:** `src/opis/templates.ts` (~60 lines) — Template instructions for scaffold generation

**Modified files:**
- `src/index.ts` — Register `init` command

---

## File Inventory (V2)

### New Files (11)

| File | Lines (est) | Purpose |
|------|-------------|---------|
| `src/context/opis.ts` | ~80 | OPIS loader + summary builder |
| `src/context/exports.ts` | ~80 | Export map scanner |
| `src/git/checkpoints.ts` | ~100 | Checkpoint patch system |
| `src/git/commit.ts` | ~60 | Auto-commit with model messages |
| `src/mcp/client.ts` | ~150 | MCP transport (stdio + HTTP) |
| `src/mcp/registry.ts` | ~60 | Tool schema merger |
| `src/commands/init.ts` | ~200 | OPIS runner |
| `src/commands/diff.ts` | ~40 | Show session changes |
| `src/opis/questions.ts` | ~80 | OPIS question sets |
| `src/opis/templates.ts` | ~60 | OPIS scaffold templates |
| **Total new** | **~910** | |

### Modified Files (6)

| File | Change |
|------|--------|
| `src/core/agent.ts` | Use `buildToolRegistry()`, call `createCheckpoint()` after edits, OPIS context in system prompt |
| `src/core/tools.ts` | Add `read_project_docs` tool, export `executeTool` for registry |
| `src/core/config.ts` | Add `mcp.servers` and `git.autoCommit`/`git.checkpoints` to schema |
| `src/commands/chat.ts` | Handle `/undo` slash command, git commit on session end |
| `src/index.ts` | Register `init`, `diff` commands; update `mcp` command |
| `src/commands/completions.ts` | Add `init`, `diff` to shell completion scripts |

### New Test Files (5)

| File | Tests |
|------|-------|
| `tests/context/opis.test.ts` | OPIS loading, summary building, fallback behavior |
| `tests/context/exports.test.ts` | Export scanning, language detection, truncation |
| `tests/git/checkpoints.test.ts` | Patch creation, undo, cleanup |
| `tests/mcp/registry.test.ts` | Schema merging, tool routing |
| `tests/commands/init.test.ts` | Mode detection, question flow |

---

## Implementation Order

### Phase 1: OPIS + Export Map (foundation)

These two features change how the system prompt is built. Everything else builds on top.

1. `src/context/opis.ts` — OPIS loader
2. `src/context/exports.ts` — Export map scanner
3. `src/core/tools.ts` — Add `read_project_docs` tool
4. `src/core/agent.ts` — Enhanced `buildSystemPrompt()`
5. Tests for context layer

### Phase 2: Git Integration

Checkpoint system wraps around the agent loop.

1. `src/git/checkpoints.ts` — Patch creation + undo
2. `src/git/commit.ts` — Auto-commit
3. `src/commands/diff.ts` — Diff command
4. `src/core/agent.ts` — Checkpoint hooks after tool execution
5. `src/commands/chat.ts` — `/undo` slash command
6. Tests for git layer

### Phase 3: MCP

MCP extends the tool system.

1. `src/mcp/client.ts` — Transport layer
2. `src/mcp/registry.ts` — Tool schema merger
3. `src/core/config.ts` — MCP config schema
4. `src/core/agent.ts` — Use merged tool registry
5. `src/commands/mcp.ts` — Rewrite from stub to real commands
6. Tests for MCP layer

### Phase 4: `opta init`

Requires OPIS + MCP to be working.

1. `src/opis/questions.ts` — Question sets
2. `src/opis/templates.ts` — Scaffold templates
3. `src/commands/init.ts` — Full OPIS runner
4. Tests for init command

---

## Token Budget Analysis

System prompt overhead with all V2 features active:

| Component | Tokens | Source |
|-----------|--------|--------|
| Base system prompt | ~200 | Existing (agent instructions + cwd) |
| OPIS summary | ~500 | APP.md frontmatter + guardrails + decisions |
| Export map | ~500-1K | Top-level exports from source files |
| Built-in tool schemas (9) | ~1.7K | 8 existing + read_project_docs |
| MCP tool schemas (~4) | ~1K | External MCP tools |
| **Total** | **~4-4.5K** | |

Context remaining for conversation:

| Model | Context | Available | Turns (~500t/turn) |
|-------|---------|-----------|-------------------|
| Qwen2.5-72B | 32K | ~27.5K | ~55 turns |
| GLM-4.7-Flash | 128K | ~123.5K | ~247 turns |
| DeepSeek-R1-Distill | 32K | ~27.5K | ~55 turns |

Comfortable on all target models.

---

## Success Criteria

### OPIS Integration
- [x] `buildSystemPrompt()` includes OPIS summary when scaffold exists — _agent-setup.ts:115-129 loads OPIS via loadOpisContext()_
- [x] `read_project_docs` tool returns correct file contents — _tools/executors.ts:564-568, context/opis.ts:178-191_
- [x] Fallback to `.opta/memory.md` when no OPIS scaffold — _context/opis.ts:268-297 loadFallbackContext()_
- [x] Non-OPIS projects get one-time suggestion to run `opta init` — _agent-setup.ts:125 injects tip into system prompt_

### Git Integration
- [x] Checkpoint patches created after each edit_file/write_file — _agent-execution.ts:220-230, git/checkpoints.ts_
- [x] `/undo` reverses the correct patch — _commands/slash/workflow.ts:117-281, git apply -R_
- [x] Task completion creates one clean commit — _agent.ts:862-880, git/commit.ts generateCommitMessage()_
- [x] `--no-commit` flag disables auto-commit — _index.ts:106,180; config-helpers.ts:25-30 → git.autoCommit: false_
- [x] Dirty working tree warning at session start — _agent-setup.ts:145-153 (injected into system prompt, not console)_
- [x] No git features in non-git directories (graceful skip) — _all git ops guarded by isGitRepo(cwd)_

### MCP Integration
- [x] stdio transport connects and lists tools — _mcp/client.ts:89-98 StdioClientTransport, tested_
- [x] HTTP transport connects and lists tools — _mcp/client.ts:99-105 StreamableHTTPClientTransport_
- [x] MCP tools appear in model's tool list — _mcp/registry.ts:121-148 namespaced as mcp\_\_server\_\_tool_
- [x] MCP tool calls route to correct server — _mcp/registry.ts:249-259 mcpRoutes lookup_
- [x] Failed MCP server doesn't block session — _registry.ts:115 Promise.allSettled, failures logged as warnings_
- [x] `opta mcp list` shows configured servers — _commands/mcp.ts:42-67_
- [x] Tool count warning at >20 tools — _registry.ts:196-203 (threshold is contextLimit/256, not hardcoded 20)_

### Repo Awareness
- [x] Export map generated in <500ms — _context/exports.ts uses fast-glob + regex, no AST; fast by design but no timing enforcement_
- [ ] Respects .gitignore — _uses hardcoded IGNORED_DIRS list, not gitignore: true in fast-glob_
- [x] Handles TypeScript, Python, Swift — _exports.ts EXTENSION_MAP covers .ts/.tsx/.js/.py/.swift_
- [x] Truncation works for large repos (>100 files) — _MAX_FILES=100, truncated flag, tested with 110 files_
- [x] Map included in system prompt — _agent-setup.ts:131-143 (gated by config.context.exportMap)_

### `opta init`
- [ ] Mode auto-detection works for greenfield and brownfield — _init.ts:250-264 detects project type only, no OPIS mode detection_
- [ ] 10 questions asked via inquirer prompts — _only 3 prompts (name, description, doc selection); src/opis/questions.ts absent_
- [ ] Model generates valid OPIS scaffold files — _uses hardcoded DOC_TEMPLATES, no model invocation_
- [ ] MCP suggestions parsed from KNOWLEDGE.md — _parseMcpSuggestions not implemented_
- [x] Existing OPIS docs not overwritten without --force — _init.ts:275-293 checks APP.md existence, prompts or skips_

---

## References

- [Tembo: 2026 Guide to Coding CLI Tools Compared](https://www.tembo.io/blog/coding-cli-tools-comparison)
- [Aider: Repository Map with Tree-Sitter](https://aider.chat/docs/repomap.html)
- [Aider: Git Integration](https://aider.chat/docs/git.html)
- [OpenAI Codex CLI Features](https://developers.openai.com/codex/cli/features/)
- [OpenAI Codex Security (Sandboxing)](https://developers.openai.com/codex/security/)
- [Claude Code MCP Docs](https://code.claude.com/docs/en/mcp)
- [Gemini CLI Documentation](https://geminicli.com/docs/)
- [OPIS Spec](../../docs/OPIS/OPIS.md)
- [OPIS Skill Integration Map](../../docs/OPIS/SKILL-INTEGRATION-MAP.md)
