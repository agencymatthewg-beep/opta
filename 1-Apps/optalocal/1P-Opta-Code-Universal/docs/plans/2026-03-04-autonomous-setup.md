# Autonomous Guided Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the Opta Code Desktop setup wizard to automatically configure secrets, hardware settings, and MCP tools via the CLI daemon for a zero-touch "ready-to-use" first-run experience.

**Architecture:** 
1. **Daemon Connection State:** Elevate the instantiated `connection` state in `SetupWizard.tsx` so all steps can communicate with the daemon during the flow.
2. **Zero-Touch Secrets (Vault Pull):** Add a `StepLogin.tsx` (or integrate it) and upon successful `launch` in `StepReady.tsx`, chain a `vault.pull` operation.
3. **Auto-Doctor:** Run `doctor` during the wizard to automatically suggest or set the `autonomyLevel` based on the system's capabilities.
4. **Starter Pack:** After `onboard.apply` and `vault.pull`, run `mcp.list`. If empty, run `mcp.add-playwright` and other default `mcp.add` operations to equip the AI out of the box.

**Tech Stack:** React 18, `@opta/daemon-client`, Tauri v2.

---

### Task 1: Elevate Daemon Connection State in SetupWizard

**Goal:** Allow all steps of the SetupWizard to perform daemon operations by storing the discovered connection in state.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/components/SetupWizard.tsx`

**Step 1: Add connection state**
```tsx
const [connection, setConnection] = useState<DaemonConnectionOptions | null>(null);
```

**Step 2: Update `prefillFromDiscovery`**
When `connection` is created inside `prefillFromDiscovery`, call `setConnection(connection)` before returning, so it is saved in state.

**Step 3: Pass connection to steps**
Update `stepContent` to pass `connection` down to `StepReady` (and later steps).

**Step 4: Commit**
```bash
git add 1P-Opta-Code-Universal/src/components/SetupWizard.tsx
git commit -m "refactor(desktop): elevate daemon connection state in setup wizard"
```

---

### Task 2: Auto-Doctor hardware profiling in Preferences

**Goal:** Run `doctor` in the background when `connection` is available to pre-fill the `autonomyLevel` in `StepPreferences`.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/components/setup/StepPreferences.tsx`
- Modify: `1P-Opta-Code-Universal/src/components/SetupWizard.tsx`

**Step 1: Pass `connection` to `StepPreferences`**
Pass `connection={connection}` in `stepContent` array in `SetupWizard.tsx`.

**Step 2: Add useEffect in StepPreferences**
Inside `StepPreferences.tsx`, add an effect that depends on `connection`.
If `connection` exists, use `daemonClient.runOperation(connection, "doctor", {})`.
If the doctor returns successfully and the system has high resources (e.g., memory), set `form.autonomyLevel` to 3 (Autonomous) automatically if it's currently at the default. If low resources, keep it at 1 or 2. For simplicity, just successfully calling `doctor` and defaulting `autonomyLevel` to 2 or 3 based on presence of a connection is fine, or simply showing a badge "Hardware Profiled: Safe Defaults Applied".

**Step 3: Commit**
```bash
git add 1P-Opta-Code-Universal/src/components/setup/StepPreferences.tsx 1P-Opta-Code-Universal/src/components/SetupWizard.tsx
git commit -m "feat(desktop): run auto-doctor to profile hardware during setup"
```

---

### Task 3: Zero-Touch Secrets (Vault Pull)

**Goal:** After applying the onboarding profile in `StepReady`, automatically pull the user's secrets from the Opta Cloud Vault.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/components/setup/StepReady.tsx`

**Step 1: Add `vault.pull` to `launch` function**
In `StepReady.tsx`, inside `launch()`, immediately after a successful `onboard.apply`, add:
```tsx
try {
  await daemonClient.runOperation(connection, "vault.pull", {});
} catch (e) {
  console.warn("Failed to pull vault secrets during setup", e);
}
```

**Step 2: Commit**
```bash
git add 1P-Opta-Code-Universal/src/components/setup/StepReady.tsx
git commit -m "feat(desktop): auto-pull vault secrets during onboarding"
```

---

### Task 4: The Starter Pack for MCP Servers

**Goal:** Equip the AI with standard tools if the MCP list is empty during setup completion.

**Files:**
- Modify: `1P-Opta-Code-Universal/src/components/setup/StepReady.tsx`

**Step 1: Add `mcp` provisioning to `launch` function**
After `vault.pull` in `launch()`, add:
```tsx
try {
  const mcpListRes = await daemonClient.runOperation(connection, "mcp.list", {});
  const operations = (mcpListRes as any)?.result?.operations || [];
  // If no servers exist, add standard ones
  if (operations.length === 0 || !mcpListRes.ok) {
     await daemonClient.runOperation(connection, "mcp.add-playwright", { input: { name: "browser", mode: "isolated" } });
  }
} catch (e) {
  console.warn("Failed to provision MCP starter pack", e);
}
```

**Step 2: Update Launch status text**
Update the UI text in `launching` state to say "Applying onboarding, syncing vault, and provisioning tools..."

**Step 3: Commit**
```bash
git add 1P-Opta-Code-Universal/src/components/setup/StepReady.tsx
git commit -m "feat(desktop): provision mcp starter pack during setup"
```