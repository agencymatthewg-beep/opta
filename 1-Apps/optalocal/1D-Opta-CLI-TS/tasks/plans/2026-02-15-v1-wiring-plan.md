# V1 Wiring Plan — 2026-02-15

## Overview
Wire up the 5 remaining CLI commands using the existing agent loop, tools, and config infrastructure.

## Execution Order

### Step 1: Session Store (`src/memory/store.ts`)
- Session interface + CRUD (create, load, save, list, delete, export)
- Storage: `~/.config/opta/sessions/<id>.json`
- IDs: nanoid, titles: first user message truncated to 60 chars
- Dependencies: nanoid, node:fs/promises

### Step 2: Agent Loop Multi-Turn (`src/core/agent.ts`)
- Add `AgentLoopOptions` type with optional `existingMessages` and returned `messages`
- Refactor `agentLoop()` to accept existing message history
- Return the final messages array so chat.ts can persist them
- Keep changes minimal — don't break existing `do.ts` usage

### Step 3: Interactive Chat (`src/commands/chat.ts`)
- Load config, create/resume session
- Readline loop with `@inquirer/prompts` input()
- Slash commands: /exit, /model, /history, /compact, /clear, /help
- Call modified agentLoop with existing messages
- Save session after each turn

### Step 4: Sessions Command (`src/commands/sessions.ts`)
- Table-formatted session list (ID, Title, Model, Date, Messages)
- Subcommands: resume (delegates to chat), delete, export
- --json flag for machine-readable output

### Step 5: Config Command (`src/commands/config.ts`)
- Subcommands: list, get, set, reset
- Dot-notation for nested keys (connection.host, permissions.edit_file)
- Uses getConfigStore() for persistence

### Step 6: Shell Completions (`src/commands/completions.ts`)
- bash/zsh/fish completion scripts
- Includes commands, global flags, command-specific flags

### Step 7: Tests
- `tests/memory/store.test.ts` — Session CRUD
- `tests/commands/config.test.ts` — get/set/list/reset
- Verify all 44 existing tests still pass

### Step 8: Final Verification
- `npm run typecheck` — clean
- `npm run lint` — clean (or fix)
- `npm test` — all pass
