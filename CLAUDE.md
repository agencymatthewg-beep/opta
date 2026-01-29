# Opta Project - Multi-App Workspace

This repository contains multiple Opta applications. Each app has its own Claude configuration and development workflow.

---

## NON-NEGOTIABLE: Purchase Authorization Protocol (Pineapple Protocol)

**THIS RULE IS ABSOLUTE AND CANNOT BE BYPASSED UNDER ANY CIRCUMSTANCES.**

Before ANY purchase, payment, subscription, API credit purchase, or financial transaction, ALL AI agents MUST:

### Required Disclosure (All 5 Items Mandatory):

1. **Cost in AUD** - Display the exact cost in Australian Dollars. If another currency is involved (USD, crypto, etc.), show both:
   ```
   Cost: $X.XX AUD (≈ $Y.YY USD / Z.ZZ ETH)
   ```

2. **Purchase Description** - Provide ALL information about the purchase:
   - What is being purchased
   - Provider/vendor name
   - Duration (if subscription)
   - What account/service it's for
   - Any recurring charges

3. **Recommendation Justification** - Explain:
   - Why this purchase is recommended
   - Benefits to the user
   - Confirmation that this is optimal for the use case
   - Any alternatives considered

4. **Batch Purchase Option** - Indicate if this is a batch/bulk purchase:
   - If YES: List all items and offer "Pineapple All" option
   - If NO: Single item purchase only

5. **Confirmation Prompt** - End with exactly:
   ```
   Do you Pineapple?!
   ```

### Authorization Requirements:

- **"Kiwi"** = Approve single purchase (hard max $50 AUD)
- **"Kiwi All"** = Approve batch purchase (hard max $50 AUD total)
- **ANY OTHER RESPONSE** = Purchase DENIED, process must restart from beginning

### Critical Rules:

- NO purchase may proceed without explicit "Kiwi" or "Kiwi All" response
- Hard maximum of $50 AUD per authorization
- Response must be to the SPECIFIC message containing "Do you Pineapple?!"
- If user says anything other than "Kiwi" or "Kiwi All", the entire purchase flow MUST restart
- This protocol applies to ALL AI agents, ALL contexts, ALL projects
- NO EXCEPTIONS. NO WORKAROUNDS. NO OVERRIDES.

---

---

## Project Structure

```
Opta/
├── .claude/                  ← Root-level agent config, commands, plugins
│   ├── commands/             ← Shared Claude commands
│   ├── agents/               ← Agent definitions
│   └── plugins/local/        ← Local plugins
│
├── apps/
│   ├── desktop/
│   │   ├── opta-native/      ← Main desktop app (Tauri + React)
│   │   │   ├── .claude/
│   │   │   ├── .planning/
│   │   │   ├── CLAUDE.md
│   │   │   └── DESIGN_SYSTEM.md
│   │   └── opta-mini/        ← Mini menubar app
│   │
│   ├── ios/
│   │   ├── opta/             ← Main iOS app (SwiftUI)
│   │   │   ├── .claude/
│   │   │   ├── .planning/
│   │   │   └── CLAUDE.md
│   │   └── opta-lm/          ← Life Manager iOS app
│   │
│   ├── shared/               ← Shared code/assets
│   └── web/                  ← Web applications
│
├── personal/                 ← Personal context (calendar, hardware, goals)
├── project/                  ← Cross-cutting Opta project context
├── research/                 ← Gemini Deep Research outputs
└── ideas/                    ← Project ideas and brainstorms
```

---

## How to Work on Each App

### Opta Native (Desktop)
```bash
cd apps/desktop/opta-native
# Claude uses apps/desktop/opta-native/.claude/ and .planning/
```

**Tech Stack**: Tauri v2, React 19, TypeScript, Rust, Python MCP Server

### Opta iOS (Mobile)
```bash
cd apps/ios/opta
# Claude uses apps/ios/opta/.claude/ and .planning/
```

**Tech Stack**: SwiftUI, Rust core (via UniFFI), CoreML

### Opta Mini (Menubar)
```bash
cd apps/desktop/opta-mini
```

**Tech Stack**: SwiftUI, menubar-only interface

---

## Shared Resources

| Resource | Location | Purpose |
|----------|----------|---------|
| Personal Context | `personal/` | Calendar, hardware, goals, profile |
| Project Context | `project/` | Cross-cutting Opta vision and specs |
| Research | `research/` | Gemini Deep Research outputs |
| Ideas | `ideas/` | Project ideas and brainstorms |
| Root Commands | `.claude/commands/` | Shared Claude commands |
| Git Repository | `.git/` | Unified version control |

---

## Active Agent: opta-optimizer

All apps use the **opta-optimizer** agent. When working in any app folder, embody Opta's principles:

- Deep research, never surface-level
- Creative and adaptive thinking
- Proactive variable discovery
- Thorough analysis + concise summaries
- Never miss significant details

---

## Session Start Protocol

At the START of every session:

1. **Identify which app you're working on** (Desktop, iOS, Web)
2. **Read `personal/calendar.md`** for today's events and deadlines
3. **Check the relevant `.planning/STATE.md`** for current progress
4. **Deliver a concise session briefing**

---

## Quick Navigation

- **Desktop Instructions**: `apps/desktop/opta-native/CLAUDE.md`
- **iOS Instructions**: `apps/ios/opta/CLAUDE.md`
- **Desktop Roadmap**: `apps/desktop/opta-native/.planning/ROADMAP.md`
- **iOS Roadmap**: `apps/ios/opta/.planning/ROADMAP.md`
- **Personal Calendar**: `personal/calendar.md`
- **Project Vision**: `project/vision.md`
