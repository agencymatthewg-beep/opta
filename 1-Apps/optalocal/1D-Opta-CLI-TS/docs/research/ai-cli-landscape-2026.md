# AI Coding CLI Landscape Research — Early 2026

## 1. Aider

**Architecture:** Diff-based (NOT tool-use). Model outputs structured text diffs, client parses them.
**6 edit formats:** whole, diff, diff-fenced, udiff, editor-diff, editor-whole. Auto-selected per model.
**Architect mode:** Dual-model — reasoning model describes solution, editor model applies diffs. Hit 85% on benchmark.
**Repo map:** Tree-sitter ASTs + PageRank-style graph ranking. Sends only top-ranked symbols.
**Local models:** LiteLLM under the hood. Ollama, OpenAI-compatible APIs.
**Unique:** Watch mode (`AI!` comments in any IDE trigger edits), lint/test auto-fix loop, git auto-commit.

## 2. OpenCode

**Architecture:** Go TUI + JS (Bun) backend. Tool-use agent via Vercel AI SDK `streamText`. Client/server (HTTP + SSE).
**20+ tools:** bash, read, write, edit, patch, grep, glob, list, lsp, todowrite/read, webfetch, websearch, skill, question, task.
**Permission model:** allow/deny/ask per tool. Wildcard support.
**Agents:** Build (full access), Plan (read-only), General subagent, Explore subagent. Hidden: compaction, title, summary.
**Unique:** LSP feedback loop (diagnostics after edits), git snapshots per step, SKILL.md loader, GitHub Actions mode.

## 3. Kimi K2.5 / Kimi Code CLI

**Architecture:** Python + TS. Agent loop with swarm parallelism.
**Agent Swarm:** Up to 100 sub-agents, 1,500 tool calls, 4.5x faster. Self-orchestrated.
**Model:** MoE — 1T total params, 32B active. 256K context.
**Protocols:** MCP + ACP (only CLI supporting both).
**Unique:** Visual agentic intelligence (multimodal), self-directed swarm without predefined workflows.

## 4. Claude Code

**Architecture:** Single-threaded tool-use loop (codenamed `nO`). h2A async message queue for mid-task steering.
**Tools:** Read, LS, Glob, Grep, Edit, Write, NotebookEdit, Bash, WebFetch, WebSearch, TodoWrite, Agent (Task), BatchTool.
**Sub-agents:** Agent tool dispatches child agents. Max 1 concurrent. Depth-limited.
**Memory:** CLAUDE.md hierarchy (global → project → directory). Compressor at ~92% context.
**Local models:** None. Anthropic-only.
**Unique:** h2A real-time steering, risk-classified Bash, hooks system, VS Code + Web UI integration.

## 5. Continue.dev

**Architecture:** TypeScript core + VS Code/JetBrains extension + React GUI. Message-passing protocol.
**Tools:** read_file, edit_file, list_dir, run_terminal_command, search_files, create_file, create_plan, commit_plan_item.
**Tool lifecycle:** generating → generated → calling → done/errored/canceled. Provider capability auto-detection.
**Context providers:** 3 types (normal, query, submenu). Codebase search via embeddings + tree-sitter + ripgrep.
**Model roles:** Separate models for chat, autocomplete, edit, apply, embed, rerank.
**Unique:** Multi-IDE, context provider plugins, model role separation, configuration merging (local + remote + cloud).

## 6. Cline / Roo Code

**Architecture:** VS Code extension. Tool-use agent with massive system prompt (~59K chars, ~12.5K tokens).
**12 tools:** execute_command, read_file, write_to_file, replace_in_file, search_files, list_files, list_code_definition_names, browser_action, ask_followup_question, attempt_completion, use_mcp_tool, access_mcp_resource.
**Roo Code additions:** Custom modes with 5 tool groups (read/edit/browser/command/mcp), file regex restrictions, orchestrator/boomerang pattern.
**Unique:** Puppeteer browser automation, boomerang multi-agent delegation, MCP marketplace.

## Key Patterns Worth Incorporating

1. **Aider's dual-model architect/editor** — Separates reasoning from editing
2. **OpenCode's LSP feedback loop** — Self-correcting after edits
3. **Claude Code's h2A steering** — Mid-task instruction injection
4. **Roo Code's mode-based permissions** — Tool groups + file restrictions
5. **Kimi's self-orchestrated swarm** — Autonomous parallel sub-agents
6. **Aider's watch mode** — IDE-agnostic AI comments
7. **OpenCode's git snapshots** — Auto-rollback on failure
8. **Continue's model role separation** — Different models per task type
9. **Aider's tree-sitter repo map** — PageRank symbol ranking
10. **OpenCode's SKILL.md** — Loadable per-task instructions

## Sources

- [Aider](https://aider.chat/) | [Edit Formats](https://aider.chat/docs/more/edit-formats.html) | [Architect Mode](https://aider.chat/2024/09/26/architect.html)
- [OpenCode](https://opencode.ai/) | [Tools](https://opencode.ai/docs/tools/) | [Agents](https://opencode.ai/docs/agents/) | [Deep Dive](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/)
- [Kimi K2.5](https://www.kimi.com/blog/kimi-k2-5.html) | [CLI](https://github.com/MoonshotAI/kimi-cli) | [Swarm Guide](https://www.datacamp.com/tutorial/kimi-k2-agent-swarm-guide)
- [Claude Code](https://code.claude.com/docs/en/overview) | [Agent Loop](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [Continue.dev](https://github.com/continuedev/continue) | [Plugin Arch](https://deepwiki.com/continuedev/continue/5.2-plugin-architecture) | [Tool Calling](https://deepwiki.com/continuedev/continue/4.5-tool-calling)
- [Cline](https://github.com/cline/cline) | [Roo Code Custom Modes](https://docs.roocode.com/features/custom-modes) | [Boomerang](https://docs.roocode.com/features/boomerang-tasks)
