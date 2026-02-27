# Claude Code Prompt — Protocol Expansion + Bot Management + Smart Reactions

Copy everything below the line into Claude Code after `cd ~/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`

---

<context>
You are working on OptaPlus, a native macOS + iOS chat client for OpenClaw bots.

Read these files for full context:
- `APP.md` — Product identity, v1.0 = complete Telegram replacement
- `SHARED.md` — Cross-platform architecture, Section 7: Smart Reaction Protocol, Section 8: Notification types
- `CLAUDE.md` — Coding rules (pure SwiftUI, zero deps, iOS 17+, macOS 14+)
- `docs/GUARDRAILS.md` — Non-negotiable constraints
- `docs/ARCHITECTURE.md` — Data flow, current file structure
- `tasks/2026-02-15-protocol-expansion.md` — Full task spec with code snippets, Gateway RPC reference, testing checklist

Current state:
- OpenClawClient.swift (619 lines) has: chat.send, chat.history, chat.abort, sessions.list
- OpenClawProtocol.swift has: frame types, connect params, chat params, session types
- ReactionBar.swift has: local-only emoji reactions (never sent to bot)
- BotProfileSheet.swift (293 lines): read-only bot display (no config editing)
- AutomationsView.swift (macOS + iOS): has cron.list/update/run/delete but cron.add may have wrong params
- ChatViewModel.swift has: generic `call()` method for any RPC
</context>

<instructions>
Develop a PLAN (not execute) to implement the Protocol Expansion task across 4 phases.

**Phase 1: Protocol Layer** — Add 10+ new RPC convenience methods to OpenClawClient.swift and ~100 lines of new types to OpenClawProtocol.swift. Methods: config.get, config.patch, config.apply, health, status, models.list, cron.add, cron.runs, sessions.patch. Follow the exact same pattern as existing chatHistory/chatSend methods.

**Phase 2: Bot Management UI** — Transform BotProfileSheet.swift from read-only display into a config editor. Add: model picker (from models.list), thinking level picker, health status display, restart button, compact context button. Create iOS equivalent.

**Phase 3: Smart Reaction Dispatch** — Replace local-only ReactionBar with bot-command reactions. 8 emojis (👍❓👎🔄⏸️▶️📋🔍), each maps to a command text sent via chat.send. Show visual reaction on bubble + dispatch command. Spec in SHARED.md Section 7.

**Phase 4: Cron Job Creation** — Verify and fix cron.add params on both platforms to match the exact Gateway schema:
```json
{
    "name": "...",
    "schedule": { "kind": "cron|at|every", "expr": "...", "tz": "..." },
    "sessionTarget": "main|isolated",
    "payload": { "kind": "systemEvent|agentTurn", "text|message": "..." },
    "enabled": true
}
```

For each phase, the plan must specify:
1. Exact files to modify with line-level changes
2. New types/methods with full signatures
3. How new code integrates with existing patterns
4. Testing approach (what to verify)
5. Sub-agents to spawn for parallel work (e.g. Phase 1 protocol + Phase 3 reactions can run simultaneously)
</instructions>

<constraints>
- Pure SwiftUI — no UIKit/AppKit wrappers
- Zero external dependencies
- NWConnection for networking (not URLSession)
- Spring physics for ALL animations (.optaSpring, .optaSnap, .optaGentle)
- Use Cinematic Void design tokens from Colors.swift for any new UI
- Gateway token must NEVER be logged or printed
- All new types must be Sendable
- Both platforms must build with 0 errors after changes
- config.patch requires baseHash from config.get (concurrency guard)
- Follow existing code patterns exactly (ChatViewModel.call() for UI, OpenClawClient.request() for protocol)
</constraints>

<output>
Write the plan to: `tasks/plans/2026-02-15-protocol-expansion-plan.md`

Include:
1. Phase breakdown with file-level diffs
2. Dependency graph (what blocks what)
3. Sub-agent assignments (which phases can parallelize)
4. Risk assessment (what could break existing functionality)
5. Testing matrix (feature × platform)
6. Estimated time per phase
</output>
</context>
