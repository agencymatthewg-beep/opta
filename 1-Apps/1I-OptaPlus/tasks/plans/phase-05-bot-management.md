# Phase 5: Bot Management UI Completion

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1I-OptaPlus/tasks/plans/phase-05-bot-management.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Coding rules
2. `macOS/OptaPlusMacOS/BotProfileSheet.swift` — Current 531-line bot sheet (partially expanded)
3. `Shared/Sources/OptaMolt/Networking/OpenClawClient.swift` — Has configGet(), gatewayHealth(), modelsList(), gatewayRestart()
4. `Shared/Sources/OptaMolt/Networking/OpenClawProtocol.swift` — Has GatewayConfig, GatewayHealth, GatewayModel types
5. `Shared/Sources/OptaMolt/Networking/ChatViewModel.swift` — Has generic call() method
6. `iOS/OptaPlusIOS/Views/SettingsView.swift` — Current iOS settings

The protocol layer is COMPLETE. All 10 RPC methods exist on OpenClawClient. This phase wires them into the UI.
</context>

<instructions>
Complete the Bot Management UI on BOTH platforms.

### macOS: BotProfileSheet.swift

Verify and complete these sections (some may already exist from prior work):

1. **Model Picker Section**
   - On appear: `let models = try await client.modelsList()`
   - Dropdown/Picker showing all available models
   - Current model highlighted
   - "Apply" button → `client.configPatch(raw: "{agents:{defaults:{model:\"\(selected)\"}}}", baseHash: hash, note: "Model changed from OptaPlus")`
   - Show loading spinner during patch

2. **Thinking Level Picker**
   - Segmented control: Off / Low / High / Stream
   - Maps to `config.patch` with `agents.defaults.thinking` key

3. **Health Status Display**
   - On appear: `let health = try await client.gatewayHealth()`
   - Show: status badge (🟢/🟡/🔴), uptime, version, active sessions count, cron jobs count
   - Auto-refresh every 30s

4. **Action Buttons**
   - "Restart Gateway" → confirmation alert → `client.gatewayRestart(raw: currentRaw, note: "Restart from OptaPlus")`
   - "Compact Context" → `client.sessionsPatch(sessionKey: current, patch: ["compact": true])`
   - "Refresh Health" → re-fetch health

### iOS: New BotManagementSheet.swift

Create a new sheet (presented from bot header tap or settings):

1. Same features as macOS but adapted for iOS:
   - `NavigationStack` with sections
   - `Picker` for model (wheel style)
   - `Picker` for thinking level
   - Health info in a `Section`
   - Action buttons as `Button` rows with destructive styling for restart
2. Wire into existing iOS navigation:
   - From `SettingsView`: "Bot Management" row → presents sheet
   - From bot header tap in `ChatView`: also presents this sheet

### Both Platforms

- Use `.task {}` for async loading on appear
- Handle errors gracefully (show inline error text, don't crash)
- All animations use `.optaSpring` or `.optaGentle`
- Glass surface background for sections (existing pattern in codebase)
</instructions>

<constraints>
- Pure SwiftUI, zero deps
- All types must be Sendable
- Gateway token NEVER logged
- Spring physics for all animations
- Both platforms must build with 0 errors
</constraints>

<output>
After implementation:
1. Verify macOS BotProfileSheet shows model picker, thinking picker, health, actions
2. Verify iOS BotManagementSheet shows same features
3. Build both targets — 0 errors

When completely finished, run:
```bash
openclaw system event --text "Done: Phase 5 — Bot Management UI complete on both platforms" --mode now
```
</output>
