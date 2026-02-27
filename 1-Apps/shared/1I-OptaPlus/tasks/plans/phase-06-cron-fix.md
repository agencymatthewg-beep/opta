# Phase 6: Cron Job Creation Fix

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-06-cron-fix.md`

---

<context>
Read these files:
1. `CLAUDE.md` — Coding rules
2. `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — Has cronAdd(job:) method
3. `Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift` — Has CronJobCreate, CronScheduleCreate, CronPayloadCreate, CronDeliveryCreate types
4. `iOS/OptaPlusIOS/Views/AutomationsView.swift` — iOS cron UI
5. `iOS/OptaPlusIOS/Views/BotAutomationsPage.swift` — iOS bot-specific cron page
6. `macOS/OptaPlusMacOS/AutomationsView.swift` — macOS cron UI

The gateway's cron.add schema requires EXACTLY:
```json
{
    "name": "string (optional)",
    "schedule": {
        "kind": "at|every|cron",
        "at": "ISO-8601 (for kind=at)",
        "everyMs": 60000 (for kind=every),
        "expr": "0 9 * * * (for kind=cron)",
        "tz": "Australia/Melbourne (optional)"
    },
    "sessionTarget": "main|isolated",
    "payload": {
        "kind": "systemEvent|agentTurn",
        "text": "... (for systemEvent)",
        "message": "... (for agentTurn)"
    },
    "delivery": {
        "mode": "none|announce",
        "channel": "telegram (optional)",
        "to": "user_id (optional)"
    },
    "enabled": true
}
```

CRITICAL CONSTRAINTS:
- sessionTarget="main" REQUIRES payload.kind="systemEvent"
- sessionTarget="isolated" REQUIRES payload.kind="agentTurn"
- Default for isolated agentTurn: delivery.mode="announce"
</context>

<instructions>
### 1. Verify CronJobCreate types match gateway schema

Check `OpenClawProtocol.swift` types against the schema above. Fix any mismatches:
- `CronScheduleCreate` must have: kind, at?, everyMs?, expr?, tz?
- `CronPayloadCreate` must have: kind, text?, message?
- `CronDeliveryCreate` must have: mode, channel?, to?

### 2. Fix iOS CreateJobSheet / AutomationsView

Verify the create flow:
1. User picks schedule type (one-time / recurring / cron expression)
2. User picks session target (main / isolated)
3. Based on target, show correct payload field:
   - main → "System Event Text" (systemEvent)
   - isolated → "Agent Prompt" (agentTurn)
4. Optional: delivery mode (none/announce) — only show for isolated
5. Submit calls `client.cronAdd(job:)` with correctly structured params
6. On success: dismiss sheet, refresh job list

### 3. Add macOS Create Flow (if missing)

Check if macOS `AutomationsView.swift` has a create button/sheet. If not, add:
- "+" button in toolbar
- Sheet with same fields as iOS
- Uses same `cronAdd` method

### 4. Add schedule presets for common patterns

Add quick-pick buttons/chips:
- Every 1h / Every 6h / Every 24h (everyMs)
- Daily at 9am / Daily at 6pm (cron)
- One-time in 30min / 1h / tomorrow 9am (at)

### 5. Validation

Before sending cron.add:
- If sessionTarget == "main" && payload.kind != "systemEvent" → show error
- If sessionTarget == "isolated" && payload.kind != "agentTurn" → show error
- If schedule.kind == "cron" && expr is empty → show error
- If schedule.kind == "at" && at is empty → show error
- If schedule.kind == "every" && everyMs <= 0 → show error
</instructions>

<constraints>
- Pure SwiftUI, zero deps
- Spring physics for animations
- Both platforms must build with 0 errors
- Timezone defaults to "Australia/Melbourne"
</constraints>

<output>
Test checklist:
1. Create a cron job from iOS → verify it appears in gateway `cron list`
2. Create a cron job from macOS → verify it appears
3. Try invalid combos (main + agentTurn) → verify error shown
4. Use each schedule type (at, every, cron) → verify correct params sent

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 6 — Cron creation fixed on both platforms" --mode now
```
</output>
