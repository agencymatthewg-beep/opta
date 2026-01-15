# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-15)

**Core value:** One tool to replace them all — eliminates chaos of multiple conflicting optimizers, detects conflicts, explains optimizations, delivers measurable gains.
**Current focus:** Phase 5 — Local LLM Integration (In Progress)

## Current Position

Phase: 5 of 10 (Local LLM Integration)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-01-15 — Completed 05-02-PLAN.md

Progress: █████████░ 52% (15/29 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 13 min
- Total execution time: 3.3 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3/3 | 51 min | 17 min |
| 2. Hardware Telemetry | 3/3 | 60 min | 20 min |
| 3. Process Management | 2/2 | 11 min | 5.5 min |
| 3.1 Design System | 3/3 | 55 min | 18 min |
| 4. Conflict Detection | 2/2 | 17 min | 8.5 min |
| 5. Local LLM Integration | 2/3 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 14, 3, 3, 3 min
- Trend: Fast execution with established patterns

## Accumulated Context

### Decisions

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01-01 | Changed identifier from com.opta.app to com.opta.optimizer | Avoids macOS .app bundle extension conflict |
| 01-02 | CSS variables over CSS-in-JS | Keeps foundation simple, enables easy theme switching |
| 01-02 | State-based routing with useState | Sufficient for MVP with 3 pages, can add router later |
| 01-02 | Neon green accent (#00ff88) | Gaming aesthetic inspired by Discord/GeForce Experience |
| 01-03 | Used official tauri-apps/tauri-action for CI | Well-maintained, consistent cross-platform builds |
| 01-03 | macOS minimum version 10.13 | Balances compatibility with modern features |
| 01-03 | Release profile: LTO + stripping enabled | Smaller, faster production binaries |
| 02-01 | Used uv for package management | Faster, more reliable than pip for Python packages |
| 02-01 | GPUtil as optional dependency | Not all systems have NVIDIA GPUs |
| 02-01 | 3-layer GPU fallback strategy | GPUtil -> pynvml -> macOS system_profiler -> graceful fallback |
| 02-03 | Mock data until 02-02 completes | Allows UI development to proceed independently |
| 02-03 | SVG rings for CPU/GPU meters | Better animation control than CSS-only |
| 02-03 | Color thresholds 60/85% | Standard warning/danger thresholds |
| 02-02 | Subprocess per-request for Python | Simpler than persistent MCP for MVP, can optimize in Phase 10 |
| 02-02 | Nullable telemetry fields | Graceful handling when hardware detection fails |
| 03-01 | 3-second polling for processes | Less frequent than telemetry, reduces system load |
| 03-01 | Top 100 processes limit | Keeps payload manageable, shows most intensive |
| 03-01 | Process categorization patterns | Name + username based for cross-platform compatibility |
| 03-02 | Graceful termination first (0.5s) then force kill | Safer for applications needing cleanup |
| 03-02 | Confirmation modal before termination | Human-in-the-loop safety |
| 03-02 | Auto-dismiss results after 5 seconds | Reduce user friction while showing feedback |
| 03.1-01 | Tailwind CSS v3.4.17 over v4 | v4 has breaking changes, v3 has better shadcn/ui compatibility |
| 03.1-01 | New York style for shadcn | Cleaner, more minimal aesthetic matches futuristic theme |
| 03.1-01 | Manual component installation | More control over component code, avoids CLI dependencies |
| 03.1-01 | CSS variables for colors | Easy theming, shadcn/ui standard, enables runtime theme changes |
| 03.1-02 | SVG inline icons over emoji | Cleaner, more professional futuristic aesthetic |
| 03.1-02 | Button variant="ghost" for sidebar nav | Subtle default state, proper hover/active transitions |
| 03.1-02 | Active nav: border-l-2 border-primary | Clear visual indicator without being heavy |
| 03.1-02 | Delete all custom CSS files | Consistent approach, 100% Tailwind-only for maintainability |
| 03.1-02 | TelemetryCard typed icon props | Type safety, prevents invalid icon names |
| 03.1-03 | CSS variable colors for meters | Enables consistent theming and easy color changes |
| 03.1-03 | shadcn Table with ScrollArea | Better accessibility and consistent scrollbar styling |
| 03.1-03 | Hero button with pulse glow | StealthMode should feel POWERFUL as the main action |
| 03.1-03 | shadcn Dialog for modals | Accessible, animated, consistent with design system |
| 04-01 | 10-second polling for conflicts | Competitor tools don't start/stop frequently |
| 04-01 | Case-insensitive contains matching | Process names vary by OS/version, contains is robust |
| 04-01 | Severity-sorted results | High severity conflicts appear first for user attention |
| 04-02 | Alert component with info variant for low severity | Consistent design system, blue/primary for informational |
| 04-02 | Per-session dismissible banner | Non-intrusive but doesn't hide permanently |
| 04-02 | Acknowledged state for ConflictCards | Users can mark as "seen" without hiding |
| 04-02 | Small dot indicator on Settings nav | Subtle attention without being aggressive |
| 05-01 | Ollama over llama.cpp | Simpler setup, built-in model management, good Python SDK |
| 05-01 | Non-streaming first | Keep 05-01 focused, add streaming in 05-02 |
| 05-01 | Status check on mount only | LLM service checks are expensive, no continuous polling |
| 05-01 | Default model llama3:8b | Good balance of quality and speed for 8GB+ RAM systems |
| 05-02 | Collapsible drawer over side panel | More flexible for different screen sizes |
| 05-02 | localStorage persistence for chat open state | Maintains UX preference across sessions |
| 05-02 | Non-streaming with typing indicator | Keeps MVP simple, streaming in 05-03 |
| 05-02 | Floating toggle button | Always accessible without cluttering main UI |

### Deferred Issues

None yet.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-15
Stopped at: Completed 05-02-PLAN.md
Resume file: None
