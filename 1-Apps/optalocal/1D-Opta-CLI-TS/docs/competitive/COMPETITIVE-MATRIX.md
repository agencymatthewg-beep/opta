# Opta CLI — Competitive Feature Matrix

**Last scanned:** 2026-03-01
**Scanner:** Opta Max (automated)
**Competitors:** Claude Code, OpenCode, Kimi Code, Aider, Gemini CLI, Codex CLI

---

## Legend

- ✅ = Implemented
- 🔄 = In Progress
- 📋 = Planned (design exists)
- ⬜ = Not Started
- ❌ = Not Planned
- 🟣 = Best-in-class (competitor leads)

---

## Matrix

| # | Feature | Opta CLI | Claude Code | OpenCode | Kimi Code | Aider | Gemini CLI | Priority | Gap Score |
|---|---------|----------|-------------|----------|-----------|-------|------------|----------|-----------|
| **Core Tools** | | | | | | | | | |
| 1 | File read | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 2 | File write | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 3 | File edit (surgical) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 4 | Shell/Bash execution | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 5 | File search (grep) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 6 | File find (glob) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 7 | Directory listing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 8 | Multi-file edit (batch) | ⬜ | ⬜ | ✅ patch+multiedit | ⬜ | ✅ | ⬜ | HIGH | 3 |
| 9 | Web fetch | ⬜ | ✅ WebFetch | ✅ webfetch | ⬜ | ⬜ | ✅ Google Search | HIGH | 3 |
| 10 | Notebook/scratchpad | ⬜ | ✅ Notebook tool | ⬜ | ⬜ | ⬜ | ⬜ | LOW | 1 |
| **Agent Architecture** | | | | | | | | | |
| 11 | Sub-agents / parallel | ⬜ | 🟣 Agent Teams (Plan/Explore/Task + custom) | 2 modes (Build/Plan) | 🟣 Agent Swarm (100 parallel) | ⬜ | ✅ Async tools | CRITICAL | 5 |
| 12 | Custom subagent definitions | ⬜ | ✅ YAML frontmatter in .md files | ⬜ | ⬜ | ⬜ | ⬜ | HIGH | 3 |
| 13 | Thinking / reasoning display | ⬜ | 🟣 Extended Thinking (budget control) | Model-dependent | ✅ K2.5 thinking mode | ⬜ | ✅ Thinking display | MEDIUM | 2 |
| 14 | Auto-compact / summarize | ⬜ | ✅ Auto-compact | ✅ Auto-compact at 95% | ⬜ | ⬜ | ⬜ | HIGH | 3 |
| **Context & Project Awareness** | | | | | | | | | |
| 15 | Project docs system | ✅ OPIS (8-18 files) | CLAUDE.md (1 file) | AGENTS.md (/init) | Skills (SKILL.md) | .aider (conventions) | GEMINI.md | — | 0 (we lead) |
| 16 | Project docs injection | 🔄 context/opis.ts | ✅ Auto-read at start | ✅ /init generates | ✅ Auto-inject skills | ⬜ | ✅ Auto-read | — | 0 (in progress) |
| 17 | Export map / symbol index | 📋 V2 designed | ⬜ (uses Grep) | ✅ LSP integration | ⬜ | ✅ tree-sitter | ⬜ | HIGH | 3 |
| 18 | Context window management | ⬜ | ✅ Auto-compact + token display | ✅ Auto-compact + token % | ⬜ | ✅ Summary mode | ⬜ | HIGH | 3 |
| **Integrations** | | | | | | | | | |
| 19 | MCP (Model Context Protocol) | 📋 V2 stub | 🟣 Native (hundreds of servers) | ✅ Config-based + permission wrapping | ✅ Auto-discovers MCPs | ⬜ | ⬜ | CRITICAL | 5 |
| 20 | LSP (Language Server Protocol) | ⬜ | ⬜ | 🟣 Auto-detects TS/Py/Go/Rust | ⬜ | ⬜ | ⬜ | MEDIUM | 2 |
| 21 | Git integration | 📋 V2 checkpoint design | ✅ Via bash | 🟣 /undo + file change tracking | ✅ Via bash | 🟣 Auto-commit per edit | ✅ Via bash | HIGH | 3 |
| 22 | IDE extension | ⬜ | ✅ VS Code extension | ✅ VS Code + desktop app | ✅ VSCode/Cursor/Zed | ✅ VS Code | ✅ VS Code | MEDIUM | 2 |
| **Input / Output** | | | | | | | | | |
| 23 | Vision / image input | ⬜ | ✅ Image drag-drop | ✅ Image drag-drop | 🟣 Native (screenshot/video/Figma → code) | ⬜ | ✅ | MEDIUM | 2 |
| 24 | Streaming output | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 25 | Markdown rendering | ✅ marked-terminal | ✅ | ✅ | ✅ | ✅ | ✅ | — | 0 |
| 26 | Non-interactive mode | ✅ `opta do` | ✅ `claude -p` | ✅ `opencode -p` | ✅ | ⬜ | ✅ | — | 0 |
| 27 | JSON output | ⬜ | ✅ --output-format json | ✅ -f json | ⬜ | ⬜ | ✅ `-o/--output-format json` | HIGH | 3 |
| **Model Management** | | | | | | | | | |
| 28 | Local model support | ✅ Native LMX | ❌ Anthropic only | ✅ Any endpoint | Partial | ✅ | ⬜ | — | 0 (we lead) |
| 29 | Model load/unload/swap | ✅ LMX admin API | ❌ | ❌ | ❌ | ❌ | ❌ | — | 0 (unique) |
| 30 | Model health monitoring | ✅ `opta status` | ❌ | ❌ | ❌ | ❌ | ❌ | — | 0 (unique) |
| 31 | Multi-provider support | ✅ OpenAI-compatible | ❌ Anthropic only | ✅ 7+ providers | Partial | ✅ Multiple | ✅ Google | — | 0 |
| 32 | Model routing aliases | ✅ LMX routing | ❌ | ❌ | ❌ | ❌ | ❌ | — | 0 (unique) |
| **UX & Session** | | | | | | | | | |
| 33 | Interactive TUI | REPL + slash cmds | REPL + permissions | 🟣 Full TUI (Bubble Tea) | REPL | REPL | REPL | LOW | 1 |
| 34 | Session persistence | ✅ JSON store | ✅ Auto-save | ✅ SQLite | ✅ | ⬜ | ⬜ | — | 0 |
| 35 | Shell completions | ✅ Bash/Zsh/Fish | ❌ | ❌ | ❌ | ❌ | ❌ | — | 0 (unique) |
| 36 | Permissions system | ✅ ask_user | 🟣 Granular per-tool | ✅ Per-tool config | ✅ Human-in-loop | ⬜ | ⬜ | MEDIUM | 2 |
| 37 | Hooks / lifecycle events | ⬜ | 🟣 PreToolUse/PostToolUse/Stop/Notification | ✅ Plugin hooks | ⬜ | ⬜ | ✅ RuntimeHook functions | HIGH | 3 |
| 38 | Custom tools (user-defined) | ⬜ | ✅ Via hooks | 🟣 JS/TS files in .opencode/tools/ | ✅ Skills | ⬜ | ⬜ | HIGH | 3 |
| 39 | Undo/rollback | ⬜ | ⬜ | 🟣 /undo command | ⬜ | ✅ Git-based | ⬜ | HIGH | 3 |
| 40 | Token usage display | ⬜ | ✅ Status bar | ✅ Token % display | ⬜ | ✅ | ⬜ | MEDIUM | 2 |
| 41 | Todo/task tracking | ⬜ | ✅ TodoWrite tool | ⬜ | ⬜ | ⬜ | ⬜ | LOW | 1 |
| 42 | Diff view | ✅ `opta diff` | ⬜ | ✅ File change view | ⬜ | ✅ | ⬜ | — | 0 |
| 43 | Multi-root workspace context | ⬜ | ✅ `--add-dir` | ⬜ | ✅ `--add-dir` + `/add-dir` | ⬜ | ✅ `/dir add` support | HIGH | 3 |
| 44 | HTTP hooks / webhook callbacks | ⬜ | ✅ HTTP hooks (POST JSON) | ✅ Plugin hooks (scriptable) | ⬜ | ⬜ | ✅ Runtime hooks | HIGH | 3 |
| 45 | Plan mode (read-only planning) | ⬜ | ✅ `--permission-mode plan` | ✅ Plan mode | ✅ Plan mode | ⬜ | ✅ Plan mode w/ constraints | CRITICAL | 5 |

---

## Summary Scores

| CLI | Features Implemented | Best-in-Class | Unique Features | Gap Score (lower = better) |
|-----|---------------------|---------------|-----------------|---------------------------|
| **Opta CLI** | 22/45 (49%) | 0 | 4 (model mgmt, OPIS, shell completions, routing) | 62 |
| **Claude Code** | 34/45 (76%) | 5 | 2 (Agent Teams, hooks) | — |
| **OpenCode** | 37/45 (82%) | 5 | 2 (LSP, /undo) | — |
| **Kimi Code** | 29/45 (64%) | 2 | 1 (Agent Swarm) | — |

## Critical Gaps (Score ≥ 5)

1. **Sub-agents / parallel execution** — Every major competitor has this. Blocks complex multi-file tasks.
2. **MCP support** — Standard protocol, 3/4 competitors have it. Required for ecosystem.

## High-Priority Gaps (Score = 3)

3. Multi-file edit (batch) — OpenCode and Aider have this
4. Web fetch — Claude Code and OpenCode have this
5. Auto-compact / context management — Claude Code and OpenCode have this
6. Export map / symbol index — OpenCode (LSP) and Aider (tree-sitter) have this
7. Git integration (/undo, checkpoints) — OpenCode leads with /undo
8. Hooks / lifecycle events — Claude Code + OpenCode + Gemini now all have this
9. Custom tools (user-defined) — OpenCode leads with JS/TS file tools
10. Undo/rollback — OpenCode has /undo, Aider has git-based
11. JSON output — now standard across Claude, OpenCode, Gemini
12. HTTP hooks / webhook callbacks — now present in Claude + OpenCode + Gemini
13. Plan mode (read-only planning) — now present in Claude + OpenCode + Kimi + Gemini

---

## Scan History

| Date | Scanner | Changes |
|------|---------|---------|
| 2026-02-16 | Opta Max | Initial matrix — 42 features, 6 competitors |
| 2026-03-01 | Opta Max | Monthly deep dive: re-audited docs; marked Claude `--add-dir` + `--permission-mode plan`; escalated plan mode to CRITICAL and multi-root to HIGH; regenerated task plans |
