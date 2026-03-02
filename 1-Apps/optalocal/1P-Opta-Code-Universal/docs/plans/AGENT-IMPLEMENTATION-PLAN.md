# Agent Implementation Plan for Opta Code (1P-Opta-Code-Universal)

This plan divides the remaining crucial work for `1P-Opta-Code-Universal` into distinct, autonomous sub-plans designed to be executed by specialized agent workflows. The goal is to optimize the current state, improve maintainability, and ensure cross-platform resilience.

---

## Sub-Plan 1: Frontend Refactoring & Modularization
**Target Files:** 
- `src/components/SetupWizard.tsx` (~1400 lines)
- `src/hooks/useDaemonSessions.ts` (~900 lines)

**Objective:** Reduce complexity, improve readability, and increase testability of the most complex frontend components.
**Agent Instructions:**
1. **Analyze `SetupWizard.tsx`:** The file contains multiple inline components (`StepWelcome`, `StepConnection`, `StepPreferences`, `StepReady`) and is extremely large.
2. **Extract Components:** Break the wizard down by moving these inline step components into a new `src/components/setup/` directory. Create a main controller component that manages the wizard state and transitions.
3. **Analyze `useDaemonSessions.ts`:** Identify the different responsibilities currently packed into this hook (e.g., WebSocket connection management, session state management, polling, message parsing). It currently contains multiple `useEffect` hooks and inline utilities.
4. **Extract Hooks/Services:** Split the hook into smaller, focused hooks (e.g., `useDaemonSocket`, `useSessionState`, `useSessionPoller`) or extract pure logic into service functions in `src/lib/`.
5. **Verify:** Ensure all existing unit tests (`useDaemonSessions.test.tsx`) pass. Add unit tests for newly extracted components where appropriate.

---

## Sub-Plan 2: Protocol Synchronization & Types
**Target Files:**
- `package.json`
- `src/types/`
- `src/lib/daemonClient.ts`
- `src/hooks/useModels.ts` (and other hooks referencing daemon types)

**Objective:** Ensure strict alignment with the latest Opta CLI daemon protocol and eliminate technical debt related to outdated or mocked API calls.
**Agent Instructions:**
1. **Audit Dependencies:** Check the workspace `1D-Opta-CLI-TS` for the latest `@opta/protocol-shared` exports and changes.
2. **Sync Types:** Update all interfaces in `src/types` to match the exact schema expected by the daemon.
3. **Audit Client Implementation:** Review `daemonClient.ts` to ensure it fully supports all currently documented daemon endpoints (e.g., connection probes, session creation, timeline retrieval, LMX model management). 
4. **Fix TODOs:** Address the `TODO/FIXME` tags found in `src/lib/daemonClient.ts` and `src/hooks/useModels.ts` (especially around `lmxLoad` options and model unloading logic).
5. **Verify:** Run a full type check (`npm run check:desktop`) and execute the local test suite.

---

## Sub-Plan 3: Resiliency & Error Handling
**Target Files:**
- `src/components/ErrorBoundary.tsx`
- `src/lib/connectionProbe.ts` (if applicable) or connection logic inside hooks.
- `src/App.tsx`

**Objective:** Ensure the application gracefully degrades or informs the user when the local Opta Daemon crashes, disconnects, or fails to start.
**Agent Instructions:**
1. **Review Error Boundaries:** Analyze `ErrorBoundary.tsx`. It currently provides a generic fallback. Ensure it provides actionable feedback to the user (e.g., "The local daemon crashed") and a way to quickly retry or re-launch the setup wizard.
2. **Improve Connection Probing:** Ensure the application proactively detects when the daemon connection is lost (via WebSocket disconnects or failed HTTP polling). 
3. **State Recovery:** Implement a seamless reconnect loop. If the daemon goes down, the UI should lock or show an overlay, and automatically restore the session view once the daemon is back up.
4. **Test Edge Cases:** Manually simulate a daemon crash while the app is running and verify the user experience.

---

## Sub-Plan 4: Cross-Platform & CI Validation
**Target Files:**
- `src-tauri/src/`
- `docs/WINDOWS-COMPATIBILITY.md`
- `docs/MACOS-COMPATIBILITY.md` (Update)
- `docs/LINUX-COMPATIBILITY.md` (Create)
- `.github/workflows/`

**Objective:** Validate that the native Rust shell and desktop integrations behave consistently across Windows, macOS, and Linux.
**Agent Instructions:**
1. **Audit Native Code:** Review `src-tauri/src/` for any OS-specific behaviors, path resolution logic, or native commands that might fail on non-Windows platforms.
2. **Document Compatibility:** Create a `LINUX-COMPATIBILITY.md` file detailing the support matrix for Linux (e.g., AppImage/deb requirements, Wayland vs X11 caveats). Update the existing `MACOS-COMPATIBILITY.md` if necessary.
3. **CI Expansion:** Review the existing `.github/workflows/opta-code-macos-build.yml` and `opta-code-parity.yml` to ensure they are functioning correctly. Propose a new workflow for Linux (`ubuntu-latest`) that builds the Tauri app and runs basic smoke tests.
4. **Verify:** Build the app locally (`npm run tauri build`) to ensure there are no platform-specific compilation errors on the host OS.
