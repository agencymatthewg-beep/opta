# Desktop to CLI Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the advanced orchestration capabilities of the Opta CLI daemon (MCP, Model Management, Secrets, Voice, Browser Replay, Permissions, and Git Diffs) directly into the Opta Code Desktop UI to create a premium, full-featured visual control surface.

**Architecture:** We will extend the existing `SettingsModal.tsx` and `App.tsx` layout with new tabs and panels. Data will be fetched via the existing `useOperations.ts` hook which acts as a bridge to the daemon's `protocol/v3/operations.ts` endpoints. Tauri APIs will be used for native notifications where necessary, and React state will hold the operational data.

**Tech Stack:** React 18, Vite, Tauri v2, Tailwind CSS, Framer Motion, `@opta/daemon-client`, `@opta/protocol-shared`.

---

### Task 1: Visual MCP (Model Context Protocol) Hub

**Goal:** Create a UI to list, add, remove, and test MCP servers.

**Files:**
- Create: `1P-Opta-Code-Universal/src/components/settings/SettingsTabMcp.tsx`
- Modify: `1P-Opta-Code-Universal/src/components/SettingsModal.tsx`
- Modify: `1P-Opta-Code-Universal/src/types.ts` (if needed for Tab ID)

**Step 1: Write the basic component structure**

```tsx
import React, { useEffect, useState } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { RefreshCw, Plus, Trash2, Activity } from "lucide-react";

export function SettingsTabMcp({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation } = useOperations(connection);
  const [servers, setServers] = useState<any[]>([]);

  const fetchServers = async () => {
    // Stub implementation
  };

  useEffect(() => { fetchServers(); }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-white">MCP Integrations</h2>
      <div className="glass-subtle p-4 rounded-xl">
         {/* List servers here */}
      </div>
    </div>
  );
}
```

**Step 2: Wire up the operations**

Update `fetchServers` to use `runOperation('mcp.list', {})`.
Add handlers for:
- `mcp.add` (Name, Command, Env)
- `mcp.remove` (Name)
- `mcp.test` (Name)

**Step 3: Register the tab in SettingsModal**

Modify `SettingsModal.tsx` to include `"mcp"` in the `SettingsTabId` type and add a navigation button for "MCP Hub".
Render `<SettingsTabMcp connection={connection} />` when the active tab is `"mcp"`.

**Step 4: Commit**

```bash
git add 1P-Opta-Code-Universal/src/components/settings/SettingsTabMcp.tsx 1P-Opta-Code-Universal/src/components/SettingsModal.tsx
git commit -m "feat(desktop): add visual MCP management hub"
```

---

### Task 2: Advanced Model & Hardware Fleet Management

**Goal:** Create a dashboard for monitoring the inference hardware and managing models.

**Files:**
- Create: `1P-Opta-Code-Universal/src/components/settings/SettingsTabFleet.tsx`
- Modify: `1P-Opta-Code-Universal/src/components/SettingsModal.tsx`

**Step 1: Write the Fleet component**

```tsx
import React, { useEffect, useState } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";

export function SettingsTabFleet({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation, lastResult } = useOperations(connection);
  
  const fetchHealth = async () => {
    await runOperation("doctor", {});
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-white">Fleet & Model Dashboard</h2>
      <button onClick={fetchHealth} className="bg-primary px-4 py-2 rounded-lg text-white">
        Run Diagnostics
      </button>
      {/* Display doctor results from lastResult */}
    </div>
  );
}
```

**Step 2: Add Model Browsing capabilities**

Add calls to `runOperation('models.browse.local', {})` and `runOperation('models.dashboard', {})` to show loaded models and RAM/VRAM usage (if provided by dashboard).

**Step 3: Register in SettingsModal**

Add `"fleet"` tab to `SettingsModal.tsx` and the corresponding sidebar item "Fleet Health".

**Step 4: Commit**

```bash
git add 1P-Opta-Code-Universal/src/components/settings/SettingsTabFleet.tsx 1P-Opta-Code-Universal/src/components/SettingsModal.tsx
git commit -m "feat(desktop): add fleet and model management dashboard"
```

---

### Task 3: Vault & Secret Management UI

**Goal:** A secure UI for managing API keys and secrets via the daemon's keychain operations.

**Files:**
- Create: `1P-Opta-Code-Universal/src/components/settings/SettingsTabSecrets.tsx`
- Modify: `1P-Opta-Code-Universal/src/components/SettingsModal.tsx`

**Step 1: Write the component**

```tsx
import React, { useEffect, useState } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";

export function SettingsTabSecrets({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation } = useOperations(connection);
  
  const fetchStatus = async () => {
    await runOperation("keychain.status", {});
  };

  useEffect(() => { fetchStatus(); }, []);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-white">Secrets & Vault</h2>
      {/* Forms for setting Anthropic/OpenAI/LMX keys */}
    </div>
  );
}
```

**Step 2: Implement Save/Delete Handlers**

Add forms with `type="password"` for Anthropic, LMX, Gemini, OpenAI, etc.
When submitted, call `runOperation('keychain.set-anthropic', { apiKey: '...' })`.
Add a "Sync Vault" button that calls `runOperation('vault.pull', {})`.

**Step 3: Register in SettingsModal**

Add `"secrets"` tab to `SettingsModal.tsx` and the corresponding sidebar item "Secrets".

**Step 4: Commit**

```bash
git add 1P-Opta-Code-Universal/src/components/settings/SettingsTabSecrets.tsx 1P-Opta-Code-Universal/src/components/SettingsModal.tsx
git commit -m "feat(desktop): add secure vault and keychain management UI"
```

---

### Task 4: Continuous Voice Mode (Walkie-Talkie)

**Goal:** Upgrade the existing microphone recording hook to support two-way continuous voice via `audio.transcribe` and `audio.tts`.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/hooks/useAudioRecorder.ts`
- Modify: `1P-Opta-Code-Universal/src/components/Composer.tsx`

**Step 1: Add TTS Playback utility**

Create a helper inside the hook or alongside it to decode the base64 audio returned by `audio.tts` and play it via the Web Audio API.

**Step 2: Extend useAudioRecorder**

Add a `continuousMode` toggle. When active, upon silence detection (or button release), automatically send the buffer to `runOperation('audio.transcribe', { audioBase64: '...' })`.
Receive the text and submit it to the chat session automatically.

**Step 3: Handle TTS on AI Response**

Listen to incoming messages from the daemon session. If `continuousMode` is active, when the AI finishes a message, call `runOperation('audio.tts', { text: messageContent })` and play the audio.

**Step 4: Commit**

```bash
git add 1P-Opta-Code-Universal/src/hooks/useAudioRecorder.ts 1P-Opta-Code-Universal/src/components/Composer.tsx
git commit -m "feat(desktop): implement two-way continuous voice walkie-talkie mode"
```

---

### Task 5: Browser Automation Replay & Visual Approval

**Goal:** Enhance the Live Browser View with play/pause controls and visual diffing.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/components/LiveBrowserView.tsx`

**Step 1: Wire up Browser Operations**

Add buttons for Play, Pause, Stop utilizing `runOperation('browser.runtime', { action: 'pause' })` and `runOperation('browser.host', { action: 'status' })`.

**Step 2: Add Evidence Diff View**

Create a sub-component within `LiveBrowserView` that can fetch and display screenshot artifacts. Since artifacts are generated by the daemon, we may need to load them via HTTP from the daemon's static asset server or via a new `browser.evidence` operation.

**Step 3: Commit**

```bash
git add 1P-Opta-Code-Universal/src/components/LiveBrowserView.tsx
git commit -m "feat(desktop): add browser runtime controls and visual replay"
```

---

### Task 6: Interactive Permission & Policy Escalation

**Goal:** Intercept dangerous operations and display a Tauri Native Notification or rich Modal.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/hooks/daemonSessions/useSessionSockets.ts`
- Create: `1P-Opta-Code-Universal/src/components/PermissionModal.tsx`
- Modify: `1P-Opta-Code-Universal/src/App.tsx`

**Step 1: Intercept Permission Requests**

In `useSessionSockets.ts`, when a message of type `agent:permission_request` (or similar, depending on the v3 protocol) arrives, dispatch it to a global React context or state.

**Step 2: Create PermissionModal**

Build a component that displays:
- The tool name
- The requested arguments/command
- "Blast Radius" warning
- [Approve] / [Deny] buttons

```tsx
export function PermissionModal({ request, onApprove, onDeny }) {
  if (!request) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="glass p-6 rounded-xl border border-red-500/50 max-w-lg">
         <h3 className="text-red-400 font-bold">Permission Required</h3>
         <pre className="bg-void p-3 rounded mt-4 text-sm font-mono text-gray-300">
           {JSON.stringify(request.command, null, 2)}
         </pre>
         <div className="flex gap-4 mt-6">
           <button onClick={onDeny} className="bg-gray-800 text-white px-4 py-2 rounded">Deny</button>
           <button onClick={onApprove} className="bg-red-600 text-white px-4 py-2 rounded">Approve</button>
         </div>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add 1P-Opta-Code-Universal/src/hooks/daemonSessions/useSessionSockets.ts 1P-Opta-Code-Universal/src/components/PermissionModal.tsx 1P-Opta-Code-Universal/src/App.tsx
git commit -m "feat(desktop): add interactive permission and policy escalation modal"
```

---

### Task 7: Git Checkpoint Time-Travel & Visual Diffs

**Goal:** Show what code changed in a session natively.

**Files:**
- Create: `1P-Opta-Code-Universal/src/components/widgets/WidgetGitDiff.tsx`
- Modify: `1P-Opta-Code-Universal/src/components/WidgetPane.tsx`

**Step 1: Create WidgetGitDiff**

Use `useOperations` to call `diff` operation: `runOperation('diff', { session: currentSessionId })`.

**Step 2: Render the Diff**

Format the stdout from the diff output. Use a library like `react-diff-viewer` (if allowed, else render simple text with green/red line coloring based on `+` / `-`).

```tsx
export function WidgetGitDiff({ connection, sessionId }) {
  const { runOperation, lastResult } = useOperations(connection);
  
  useEffect(() => {
    if (sessionId) {
      runOperation("diff", { session: sessionId });
    }
  }, [sessionId]);

  const stdout = (lastResult?.result as any)?.stdout || "";

  return (
    <div className="bg-void border border-white/10 rounded-lg p-3 overflow-y-auto">
      <h3 className="text-sm font-semibold text-white/70 mb-2">Session Diff</h3>
      <pre className="text-xs font-mono text-gray-400">
        {stdout || "No changes."}
      </pre>
    </div>
  );
}
```

**Step 3: Register Widget**

Add `<WidgetGitDiff />` to `WidgetPane.tsx` layout.

**Step 4: Commit**

```bash
git add 1P-Opta-Code-Universal/src/components/widgets/WidgetGitDiff.tsx 1P-Opta-Code-Universal/src/components/WidgetPane.tsx
git commit -m "feat(desktop): add git diff visualization widget"
```
