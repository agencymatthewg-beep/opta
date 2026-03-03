---
status: active
date: 2026-03-03
owner: opta-core-team
---

# Opta Production-Grade Holistic Optimization & Parity Plan

**Goal:** Elevate both Opta CLI (`1D-Opta-CLI-TS`) and Opta Code (`1P-Opta-Code-Universal`) from high-functioning prototypes to robust, resilient, and highly polished production-grade applications. This plan identifies critical architectural gaps, performance bottlenecks, UX inconsistencies, and missing testing gates required to get the apps "as good as they should be."

---

## 1. Architectural Integrity & Capability Parity

**Current State:** The CLI acts as the core engine (daemon + TUI + agent logic) while Opta Code is a Tauri/React interface consuming the daemon API. However, Opta Code lags behind the CLI in exposing advanced features.

**Optimization Targets:**
- **Strict Client-Daemon Contract:** Enforce that Opta Code is a *strict consumer* of the `v3` daemon API. Logic must never be duplicated in the React client.
- **Close the Capability Gaps:**
  - **Advanced Model Management:** Expose the full `opta models` suite (history, aliases, autotune, quantize, skills) inside the Opta Code UI.
  - **Chat Modes:** The desktop composer currently only supports `chat` and `do`. It must be updated to support the CLI's advanced modes (`--plan`, `--review`, `--research`).
  - **Background Jobs Console:** The daemon supports background job execution (`list`, `start`, `kill`), but Opta Code lacks a UI for this. Build a dedicated Background Jobs page.
  - **Diagnostic UI:** Expose the CLI `opta doctor` output as a beautiful, interactive health-report page in Opta Code.
- **CI Parity Gate:** Implement an automated build check that parses the shared `/v3/operations` contract and fails the PR if a CLI feature is not mapped to an Opta Code component.

---

## 2. Performance & Speed

**Current State:** High Time-to-First-Token (TTFT) and unoptimized streaming buffers hold back the feeling of instantaneous responsiveness.

**Optimization Targets:**
- **Model Pre-loading (Zero-TTFT):** Configure the daemon to automatically warm/pre-load the default LMX model upon startup in the background, eliminating the ~2s cold start penalty.
- **Connection Pooling:** Implement HTTP keep-alive and connection pooling between the daemon and the local inference server to reduce TCP handshake overhead on every turn.
- **Streaming Buffer Optimization:** Refactor token streaming logic to handle high-throughput local models (aiming for 25+ tok/s). Ensure UI paint latency (keypress to render) remains under 50ms during heavy streaming.
- **Desktop App Bundle Size:** Audit `1P-Opta-Code-Universal` for unused dependencies and enforce aggressive tree-shaking and lazy-loading of heavy components (e.g., code highlighters, markdown parsers) to optimize app launch time.

---

## 3. Reliability, Error Recovery & State Sync

**Current State:** Network drops, daemon crashes, and mid-turn cancellations need bulletproof recovery mechanisms.

**Optimization Targets:**
- **Reconnect SLO:** Ensure that if the daemon restarts or the WebSocket drops, the Desktop UI recovers the session within < 2 seconds and accurately replays cursor state without duplicate rendering.
- **Cancellation Propagation:** (Partially complete in CLI) Ensure that when a user clicks "Cancel" in Opta Code, the abort signal propagates flawlessly through the daemon, killing LLM inference, active bash commands, and network scraping tools instantly.
- **Seamless Cloud Failover:** If the local LMX server dies mid-generation, smoothly transition the request to the configured cloud fallback (e.g., Anthropic) with a non-intrusive UI warning, rather than hard-failing the turn.
- **24-Hour Soak Test:** Mandate a continuous 24h automated stress test of the daemon + desktop app to root out memory leaks and unrecovered disconnects.

---

## 4. UX & Visual Consistency

**Current State:** The TUI and the Desktop App occasionally feel like separate products due to divergent design patterns and keybindings.

**Optimization Targets:**
- **Unified Design Tokens:** Standardize visual elements (like the specific "purple border" for AI responses, standard padding, and typography) across both the terminal UI and the Tauri app.
- **Interaction Parity:** Ensure keyboard shortcuts map 1:1. If `Ctrl+C` cancels in the TUI, the exact same interaction paradigm should be respected and visible in the desktop app.
- **Onboarding Polish:** The Desktop app's setup wizard must achieve 100% parity with the CLI's detailed TTY onboarding, including hardware capability detection and automated tool-fetching.
- **Telemetry & Insight Engine:** Expose a "Nerd Stats" overlay in the Desktop app (mirroring CLI capabilities) that shows live VRAM usage, token speed, and context window compression events.

---

## 5. Platform & Distribution Readiness

**Current State:** Heavily optimized for macOS/Linux. Windows support is fragmented.

**Optimization Targets:**
- **Platform Abstraction:** Replace all hardcoded macOS shell commands (e.g., `pbcopy`, `launchctl`, `open`) with cross-platform Node/Rust equivalents.
- **Secure Credentials:** Implement standard OS Keychain / Windows Credential Manager adapters for storing API keys securely on all platforms.
- **Native Packaging:** Finalize the Tauri v2 packaging pipeline to output standard `.dmg` (macOS), `.deb` (Linux), and `.msi` (Windows) installers, complete with auto-update infrastructure.

---

## Next Steps for Execution

- [ ] Integrate the **Background Jobs Console** into Opta Code.
- [ ] Implement **Model Pre-loading** in the `1D-Opta-CLI-TS` daemon lifecycle.
- [ ] Hook up the **CI Parity Gate** to enforce architectural hygiene going forward.
