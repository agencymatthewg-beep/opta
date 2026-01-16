# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-15)

**Core value:** One tool to replace them all — eliminates chaos of multiple conflicting optimizers, detects conflicts, explains optimizations, delivers measurable gains.
**Current focus:** Phase 14 — Educational Enhancement (v1.1 macOS Refinement)

## Current Position

Phase: 14 of 18 (Educational Enhancement)
Plan: 2 of 3 in current phase
Status: Plan complete
Last activity: 2026-01-16 — Completed 14-02-PLAN.md (Learning Visibility)

Progress: ███████▒░░░░░░░░░░░░ 75% (12/16 plans in v1.1)

## Performance Metrics

**Velocity:**
- Total plans completed: 48
- Average duration: 9 min
- Total execution time: 6.88 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Foundation | 3/3 | 51 min | 17 min |
| 2. Hardware Telemetry | 3/3 | 60 min | 20 min |
| 3. Process Management | 2/2 | 11 min | 5.5 min |
| 3.1 Design System | 3/3 | 55 min | 18 min |
| 4. Conflict Detection | 2/2 | 17 min | 8.5 min |
| 5. Local LLM Integration | 3/3 | 10 min | 3 min |
| 6. Cloud LLM Integration | 3/3 | 9 min | 3 min |
| 7. Game Detection | 3/3 | 9 min | 3 min |
| 8. Optimization Engine | 4/4 | 12 min | 3 min |
| 8.1 Adaptive Intelligence | 4/4 | 28 min | 7 min |
| 9. Optimization Score | 3/3 | 32 min | 11 min |
| 10. Polish, Education & Launch | 7/7 | 78 min | 11 min |
| 11. Foundation & Stability | 3/3 | 21 min | 7 min |
| 12. UX Flow Polish | 3/3 | 18 min | 6 min |
| 13. Core Features | 4/4 | 15 min | 4 min |
| 14. Educational Enhancement | 2/3 | 9 min | 5 min |

**Recent Trend:**
- Last 5 plans: 4, 3, 4, 4, 5 min
- Trend: Consistent fast execution

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
| 05-03 | Quick actions in welcome state only | Keeps chat interface clean once conversation starts |
| 05-03 | System prompt with optimization expertise | GPU, games, processes, hardware focus areas |
| 05-03 | Context-aware chat with telemetry | Includes current system state in prompts |
| 08.1-01 | Timestamps in milliseconds | JavaScript-compatible format for frontend |
| 08.1-01 | Case conversion in Python layer | Snake_case storage, camelCase API for convention compliance |
| 08.1-01 | Atomic file writes | Temp file + rename prevents corruption |
| 08.1-01 | GPU detection fallback chain | GPUtil -> pynvml -> system_profiler -> null |
| 08.1-02 | JSONL for choice log | Append-only, crash-safe, easy streaming reads |
| 08.1-02 | Minimum 3 samples for patterns | Balances responsiveness with accuracy |
| 08.1-02 | 70%/30% threshold for preference/aversion | Clear signal without being too strict |
| 08.1-02 | Fire-and-forget choice recording | Non-blocking, never impacts UX |
| 08.1-03 | Top 5 recommendation limit | Prevents overwhelming users, shows highest confidence first |
| 08.1-03 | 0.5 confidence threshold for recommendations | Only show recommendations we're reasonably sure about |
| 08.1-03 | Session-scoped dismissal | Dismissed recommendations return after app restart |
| 08.1-04 | Inline select elements | Used native HTML select with glass styling since shadcn Select not installed |
| 08.1-04 | Profile section after Privacy | Logical flow: privacy info -> user data control |
| 09-01 | 40/35/25 dimension weights | Performance most important for gamers, Experience second, Competitive third |
| 09-01 | Statistical percentile estimation | Use tier-based distributions until real community data available |
| 09-01 | Money saved thresholds (40/25/15/10/5%) | Mapped to typical hardware upgrade costs ($600/$400/$250/$150/$50) |
| 09-01 | VRAM + RAM for hardware tier | Simple heuristic correlating well with system capability |
| 09-01 | Millisecond timestamps | JavaScript Date compatibility for frontend |
| 09-01 | Preserve v1 functions | Backwards compatibility for existing score displays |
| 09-02 | Separate color classes in WowFactorsDisplay | Avoid dynamic Tailwind class issues |
| 09-02 | Empty state in ScoreTimeline | Better UX when no history exists |
| 09-02 | Award icon for Score nav | Matches score/achievement theme |
| 09-03 | LucideIcon dynamic loading via keyof typeof pattern | Safer type handling for dynamic icons |
| 09-03 | Badge progress persisted to ~/.opta/badges/ | Cross-session progress tracking |
| 09-03 | Four filter modes: similar, price, performance, global | From MUST_HAVE flexible comparison requirements |
| 09-03 | Two-column layout for leaderboard and badges | Desktop-optimized Score page layout |
| 10-03 | Two-stage onboarding (platform then preferences) | Separates concerns, allows independent skip |
| 10-03 | Three preference questions: priority, expertise, gameType | Minimal questions for effective personalization |
| 10-03 | Preferences saved to localStorage | Local-first approach, available for future recommendations |
| 10-06 | Investigation Mode toggle in Privacy | Settings is natural home for transparency features |
| 10-06 | Client-side report generation | Backend MCP tool ready for production, client demo for now |
| 10-06 | Slide-in panel from right | Non-modal, easy to dismiss, preserves main context |
| 10-02 | Lazy load all pages via React.lazy() | Reduces initial bundle from 1.2MB to ~235KB, improves startup |
| 10-02 | Vendor chunk splitting (react, motion, radix) | Better caching, separate update cycles for framework vs app code |
| 10-02 | useReducedMotion hook | Respects prefers-reduced-motion for accessibility |
| 10-02 | role=meter with ARIA for telemetry | Semantic HTML, screen reader compatible |
| 10-01 | PYTHONPATH over editable install | More reliable across different Python versions and CI environments |
| 10-01 | Platform-specific conflict tools | Better UX by only showing relevant conflicts per OS |
| 10-01 | Separate CI jobs for MCP/frontend/Tauri | Faster feedback and clearer failure identification |
| 10-01 | macOS Intel + ARM builds | Support both legacy Macs and Apple Silicon |
| 10-04 | Floating toggle positioned bottom-left | Not buried in Settings, always accessible |
| 10-04 | localStorage for Learn Mode state | Session continuity, persists across refresh |
| 10-04 | Three explanation types: info, tip, how-it-works | Visual distinction by purpose |
| 10-04 | Technical details in expandable sections | Avoid overwhelming casual users |
| 10-05 | Lucide icons for pipeline stages | Design system compliance over emojis |
| 10-05 | Integrated into existing pages | Visualizations appear in context rather than separate view |
| 10-05 | Mock data for demo | Will connect to real optimization data in future |
| 10-07 | Weighted composite scoring (70/30) | Technical behaviors more indicative of expertise than raw usage time |
| 10-07 | Three levels with 30/65 thresholds | Clear separation between beginner, regular, and advanced users |
| 10-07 | Fire-and-forget signal recording | Never impact UI responsiveness for non-critical tracking |
| 10-07 | ExpertiseTracking as invisible component | Clean separation of concerns, easy to test and maintain |
| 10-07 | Manual override with 100% confidence | Respect explicit user choice completely |
| 11-01 | ErrorBoundary wraps Layout only | Ensures providers remain accessible during error recovery |
| 11-01 | closingGame state for exit animation | Allows AnimatePresence to animate out before clearing selectedGame |
| 11-01 | Cancel during loading shows confirmation | Prevents accidental cancellation during launch |
| 11-02 | Steam → primary, Epic → muted-foreground, GOG → accent | Visual distinction while maintaining design system compliance |
| 11-02 | Glass-subtle for modal headers | Design system mandates glass effects over solid backgrounds |
| 11-03 | localStorage for dismissed recommendations | Simple, browser-native, persists across sessions without backend |
| 11-03 | URL params for game selection | Enables link sharing, browser back/forward, survives refresh |
| 11-03 | Typed "DELETE" confirmation | Industry standard for destructive actions, prevents accidents |
| 12-01 | Guide users from Optimize to Games | Keeps Optimize page accessible while providing clear path forward |
| 12-01 | Mobile back button with ChevronLeft | Industry standard mobile navigation pattern |
| 12-01 | Spring stiffness 200, damping 25 | Softer, less jarring animation while maintaining responsive feel |
| 12-02 | Conditional skeleton over component loading | More control over skeleton design for specific context |
| 12-02 | Always reset retry in finally block | Ensures loading state never gets stuck even on errors |
| 12-02 | Warning Alert for conflict errors | Semantic variant for non-critical graceful degradation |
| 12-02 | Disable with tooltip vs hide buttons | Users know feature exists but isn't ready yet |
| 12-03 | Use callbacks in launchGame for stealth mode results | Allows decoupled tracking without storing in hook state |
| 12-03 | Keep last 50 sessions in history | Balances useful history with localStorage limits |
| 12-03 | Use ref for sessionMetrics | Ensures summary captures latest values during async operations |
| 13-01 | Provider wraps Layout not App | Keeps provider close to where it's rendered, easier testing |
| 13-01 | Four message types with glow effects | Semantic colors for instant recognition of state |
| 13-01 | Optional indicator with direction | Supports both positive (up) and negative (down) trends |
| 13-01 | 20-step interval for CountUp | Smooth animation without performance overhead |
| 13-02 | Default to informative style | Most users benefit from learning, can opt into concise |
| 13-02 | 100 char truncation with Learn more | Keeps concise mode brief while allowing expansion |
| 13-02 | Dynamic system prompt for LLM | Explicitly instructs LLM on response verbosity |
| 13-02 | Technical details hidden in concise | Expandable on demand, not shown by default |
| 13-03 | Built-in presets marked with isBuiltIn flag | Prevents accidental deletion of default presets |
| 13-03 | Custom preset IDs use timestamp | Ensures uniqueness without external dependency |
| 13-03 | Clear active preset when deleted | Prevents orphaned active preset reference |
| 13-03 | Icon map pattern for dynamic icons | Type-safe way to render Lucide icons from string names |
| 13-04 | Six-step wizard flow | Goal, game, analyze, review, apply, results - clear progression with back navigation |
| 13-04 | Four optimization goals | Max FPS, Min Latency, Reduce Heat, Battery Life - covers primary needs |
| 13-04 | Mock recommendation generation | Using goal-specific mock data until backend engine integration |
| 13-04 | Impact percentage predictions | Shows estimated improvement for each recommendation |
| 14-01 | Export WELCOME_CONTENT for reuse | Enables reuse in other welcome/intro screens |
| 14-01 | Function-based explanations | Allows game name interpolation in explanation text |
| 14-01 | LearnModeTopic component | Simplifies usage of pre-defined content in components |
| 14-01 | 6 pre-defined Learn Mode topics | Covers all major features with full/short versions per expertise level |
| 14-02 | State-based tabs for learning section | No existing Tabs component, useState approach matches existing patterns |
| 14-02 | Native HTML range slider | No Slider component exists, styled with glass classes |
| 14-02 | localStorage for preference persistence | Fast, simple persistence without backend changes |
| 14-02 | Show all preferences in list | Full visibility (enabled and disabled) for user transparency |

### Deferred Issues

None yet.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Roadmap Evolution

- Milestone v1.1 created: Integration & Windows polish, 5 phases (Phase 11-15)
- Milestone v1.1 restructured: macOS Refinement focus, Windows deferred to v2.0
- v1.1 phases now: Foundation & Stability, UX Flow Polish, Core Features, Educational Enhancement, Performance & Launch
- v2.0 created: Windows Platform, Social Features, Chess Integration (Phases 16-18)

## Session Continuity

Last session: 2026-01-16
Stopped at: Completed 14-02-PLAN.md (Learning Visibility)
Resume file: None
Next action: Execute 14-03-PLAN.md (Smart Error Recovery)
