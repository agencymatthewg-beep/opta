---
status: active
date: 2026-03-03
owner: opta-core-team
---

# Opta Init — Daemon & Background Process Manager Implementation Plan

**Goal:** Integrate a sleek, sliding right-hand drawer into the **Opta Init Desktop Manager** (Tauri) to act as the canonical, out-of-band supervisor for the local Opta Daemon and its spawned background processes.

**Aesthetic Direction:** "Minimalist Pulse" (as seen in `design-init-drawer-3.html`). Characterized by a frameless vertical timeline track, pulsing neon status rings, and action buttons that fade in on hover.

---

## 1. UX & Interaction Spec

- **Access:** The drawer is hidden by default. It can be toggled via a new header icon button (e.g., an Activity/Terminal icon) in `App.tsx` or a global keyboard shortcut (e.g., `Cmd/Ctrl + Shift + P`).
- **Animation:** The drawer slides in from the right (`transform: translateX(100%)` to `0%`) using a physics-based spring easing (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Backdrop:** It uses a heavy glass backdrop (`rgba(12, 12, 18, 0.85)` with `blur(50px)`) to obscure the main App Cluster without fully blocking it.
- **Auto-Close:** Clicking the `&times;` icon, pressing `Esc`, or clicking anywhere outside the drawer closes it.

## 2. Architecture & Data Flow

Opta Init manages the daemon via the `@tauri-apps/api/core` `invoke` calls which map to Rust commands that execute `opta` CLI commands under the hood.

1. **Rust Backend (`desktop-manager/src-tauri/src/main.rs`)**
   - Add a command `get_daemon_jobs` that executes `opta daemon run -- /v3/operations/bg_list` or an equivalent CLI command that returns the JSON list of active processes.
   - Add a command `kill_daemon_job(id)` that executes `opta bg_jobs kill <id>`.
   - Add a command `restart_daemon_job(id)` (if supported by daemon) or map it to a re-execution.

2. **React State (`DaemonDrawer.tsx`)**
   - When the drawer is `isOpen === true`, set up a polling interval (e.g., every 2s) to fetch the latest job list via `invoke("get_daemon_jobs")`.
   - Manage optimistic UI updates when clicking "Kill" so the status ring immediately turns red before the next poll.

## 3. Implementation Steps

### Phase 1: The UI Component
1. Create `1O-Opta-Init/desktop-manager/src/components/DaemonDrawer.tsx`.
2. Port the HTML/CSS from `design-init-drawer-3.html` into React functional components.
3. Map the CSS variables to inline style objects or a dedicated `drawer.css` module to match the existing Init app structure.
4. Implement the slide-in/slide-out animation state logic.

### Phase 2: Mock State Integration
1. Wire the `DaemonDrawer` into `App.tsx` (rendered at the root level so it sits over the `.window-app` container).
2. Add a toggle button to the `.header` area of `App.tsx` (next to the settings/version text).
3. Populate the drawer with a hardcoded list of mock jobs matching the design file to verify the layout, hover states, and scroll behavior.

### Phase 3: Rust Backend Bindings
1. Open `1O-Opta-Init/desktop-manager/src-tauri/src/main.rs`.
2. Implement `#[tauri::command] async fn get_daemon_jobs() -> Result<String, String>` that calls the Opta CLI and captures the JSON output.
3. Implement `#[tauri::command] async fn action_daemon_job(id: String, action: String) -> Result<String, String>` to handle kill/restart signals.
4. Register the new commands in the `tauri::Builder::default().invoke_handler(...)` macro.

### Phase 4: Live Data Wiring
1. In `DaemonDrawer.tsx`, replace the mock data with a `useEffect` that polls `invoke("get_daemon_jobs")` when the drawer is open.
2. Wire the "Kill <kbd>K</kbd>" button to fire `invoke("action_daemon_job", { id: job.id, action: "kill" })`.
3. Add a loading state (e.g., a subtle skeleton loader or spinner) for the first fetch.

## 4. Acceptance Criteria
- [ ] A new Activity icon is visible in the Opta Init main view.
- [ ] Clicking the icon smoothly slides out the Minimalist Pulse drawer from the right.
- [ ] Hovering over a job node reveals the "Logs" and "Kill/Restart" buttons.
- [ ] The drawer accurately reflects the real output of the local Opta Daemon's background process registry.
- [ ] Clicking "Kill" successfully terminates the target process and updates the UI status ring to "stopped".