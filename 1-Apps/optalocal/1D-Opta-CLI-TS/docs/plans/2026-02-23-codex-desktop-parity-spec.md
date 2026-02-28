---
status: review
---

# Codex Desktop Parity Spec (macOS Enforcement)

**Date:** 2026-02-23  
**Owner:** Codex (Desktop parity ownership)  
**Scope:** Desktop/TUI parity enforcement for macOS CI and local verification  
**Primary upstream inputs:**
- `docs/plans/2026-02-17-opencode-ux-parity-master.md`
- `docs/plans/2026-02-17-ux-phase1a-input-editor.md`
- `docs/plans/2026-02-17-ux-phase1b-rendering.md`
- `docs/plans/2026-02-17-ux-phase1c-session-workflow.md`
- `docs/plans/2026-02-17-ux-phase2-ink-migration.md`
- `docs/plans/2026-02-17-ux-phase3-advanced-tui.md`
- `.github/workflows/parity-macos-codex.yml`

> Note: Requested source file `docs/plans/2026-02-23-codex-macos-parity-enforcement-plan.md` is not present in this repo snapshot. This spec derives canonical parity requirements from the available parity roadmap + enforcement workflow above.

---

## 1) P0/P1 Scenario Matrix (Canonical IDs)

### Priority definitions
- **P0:** Release-blocking parity scenarios. Any failure blocks merge/release.
- **P1:** Important parity depth scenarios. Failures do not block immediate release but must be triaged before parity completion sign-off.

| ID | Pri | Scenario | Parity Gaps / Risk | Primary Automated Coverage | Gate Type |
|---|---|---|---|---|---|
| `P0-01` | P0 | Build, lint, typecheck on macOS Node 20/22 | Build/system drift, type/interface regressions | `npm run build`, `npm run typecheck`, `npm run lint` via workflow matrix | Hard gate |
| `P0-02` | P0 | Core smoke suite passes in CI mode | Core command/tool/runtime regressions | `npm run test:core -- --run` | Hard gate |
| `P0-03` | P0 | Full-screen alternate buffer enter/exit behavior | Broken TUI shell lifecycle, terminal corruption | `tests/tui/App.test.tsx`, parity TUI run path in workflow | Hard gate |
| `P0-04` | P0 | Input editor correctness (multiline, shell mode, escape, mode indicator) | Input corruption, unsafe shell mode behavior | `tests/ui/input.test.ts` | Hard gate |
| `P0-05` | P0 | Overlay/menu navigation and input-lock semantics | Stuck overlays, key handling regressions, accidental input submission | `tests/tui/App.test.tsx`, `tests/tui/menus-navigation.test.tsx` | Hard gate |
| `P0-06` | P0 | LMX connection + reconnect continuity + stream sanitization | Session continuity loss, reconnection instability, control-char leakage | `tests/lmx/connection.test.ts`, `tests/core/agent-streaming.test.ts`, `tests/core/insights.test.ts` | Hard gate |
| `P0-07` | P0 | Permission race handling is conflict-safe and fail-closed | Double-apply permission decisions, unsafe grants | `tests/daemon/permission-coordinator.test.ts`, `tests/core/permissions.test.ts` | Hard gate |
| `P0-08` | P0 | Scroll + viewport + resize stability in message surfaces | Unreadable chat history, clipping, rendering corruption | `tests/tui/ScrollView.test.tsx`, `tests/tui/useTerminalSize.test.ts` | Hard gate |
| `P0-09` | P0 | Visual golden parity for chat/scan/model/help surfaces at target widths | Silent UI regressions on key user flows | `tests/tui/visual-snapshots.test.tsx` + snapshot diff review | Hard gate |
| `P0-10` | P0 | Model/session workflow parity (picker + export paths) | Workflow dead-ends, incompatible model/session UX | `tests/tui/ModelPicker.test.tsx`, `tests/commands/share.test.ts` | Hard gate |
| `P1-01` | P1 | Tool card detail fidelity (states + truncation) | Reduced observability, incorrect tool summaries | `tests/tui/ToolCard.test.tsx`, `tests/ui/toolcards.test.ts` | Non-blocking parity depth |
| `P1-02` | P1 | Thinking collapse/expand semantics | Poor reasoning transparency UX | `tests/tui/ThinkingBlock.test.tsx`, `tests/ui/thinking.test.ts` | Non-blocking parity depth |
| `P1-03` | P1 | Theme + markdown/diff rendering quality | Readability/visual consistency regressions | `tests/ui/theme.test.ts`, `tests/ui/markdown.test.ts`, `tests/ui/diff.test.ts` | Non-blocking parity depth |
| `P1-04` | P1 | Keybinding override + discoverability | Accessibility/workflow degradation | `tests/tui/keybindings.test.ts`, `tests/tui/HelpOverlay.test.tsx` | Non-blocking parity depth |
| `P1-05` | P1 | Fuzzed interaction robustness under random keys/resizes/streams | Rare rendering bugs missed by deterministic cases | `tests/tui/interaction-fuzz.test.tsx` | Non-blocking parity depth |
| `P1-06` | P1 | Server-mode and workflow command completeness | Partial command-surface parity | `tests/commands/server.test.ts` (add/maintain), workflow command tests | Non-blocking parity depth |

---

## 2) Gherkin Acceptance Scenarios (All P0 IDs)

### `P0-01` Build/Lint/Typecheck Matrix
```gherkin
Feature: macOS build health parity
  Scenario Outline: Build and static validation pass for required Node versions
    Given a pull request branch with parity workflow enabled
    When job "P0 matrix" runs on macOS with Node <node_version> and track "build_lint_typecheck"
    Then npm run build succeeds
    And npm run typecheck succeeds
    And npm run lint succeeds

    Examples:
      | node_version |
      | 20.x         |
      | 22.x         |
```

### `P0-02` Core Smoke
```gherkin
Feature: Core runtime parity
  Scenario Outline: Core smoke suite passes on required Node versions
    Given a pull request branch with parity workflow enabled
    When job "P0 matrix" runs on macOS with Node <node_version> and track "core_smoke"
    Then npm run test:core -- --run exits 0
    And no tests are skipped due to missing terminal/runtime assumptions

    Examples:
      | node_version |
      | 20.x         |
      | 22.x         |
```

### `P0-03` Alternate Buffer Lifecycle
```gherkin
Feature: Full-screen TUI lifecycle parity
  Scenario: Enter and exit alternate buffer safely
    Given the TUI app starts in an interactive terminal
    When the chat command enters desktop/full-screen mode
    Then the terminal enters alternate buffer mode
    And header, message area, input area, and status bar render
    When the user exits via configured exit key
    Then the terminal leaves alternate buffer mode
    And no raw control characters are printed to the terminal transcript
```

### `P0-04` Input Editor Correctness
```gherkin
Feature: Input editor parity
  Scenario: Multiline, shell mode, and escape behavior are deterministic
    Given an empty input editor in multiline-capable mode
    When the user inserts text with newline input
    Then the buffer preserves line breaks and cursor line/column tracking
    When the buffer starts with "!"
    Then shell mode is active and shell command extraction excludes the prefix
    When Escape is pressed while shell/multiline state is active
    Then shell mode exits and multiline transient state clears
    And prompt mode indicators reflect the final mode
```

### `P0-05` Overlay/Menu Navigation and Input Lock
```gherkin
Feature: Overlay interaction parity
  Scenario: Menus are dismissible and do not leak keystrokes into main input
    Given the user opens the command browser or menu overlay
    When the user presses Escape, Left, or Backspace in the configured close context
    Then the overlay closes deterministically
    And the main input editor does not receive buffered overlay keystrokes
    And submitting after close does not emit unintended text
```

### `P0-06` Reconnect + Sanitized Stream Continuity
```gherkin
Feature: Connection continuity parity
  Scenario: Reconnect and stream sanitization preserve user-visible continuity
    Given LMX health/ready probes can return connected, degraded, or disconnected states
    When the connection transitions through reconnecting to connected
    Then reconnect insight events are emitted with attempt metadata
    And streamed token chunks are sanitized before display/storage
    And abort signals fail fast without hanging stream collectors
```

### `P0-07` Permission Race Safety
```gherkin
Feature: Permission arbitration parity
  Scenario: Concurrent permission decisions are conflict-safe and fail-closed
    Given a pending permission request with a timeout policy
    When two resolve attempts race for the same request id
    Then exactly one decision is accepted
    And subsequent decisions are rejected as conflicts
    And unresolved requests default to deny after timeout
```

### `P0-08` Scroll/Resize/Viewport Stability
```gherkin
Feature: Scroll and viewport parity
  Scenario: Message viewport behaves correctly under content pressure and resize events
    Given message content exceeds the viewport height
    When the user scrolls with arrow/page controls
    Then visible rows update without clipping half-rendered entries
    And scrollbar visibility/position are proportional to content length
    When terminal dimensions change
    Then layout recomputes using resolved terminal size
    And frame integrity remains valid (no undefined, NaN, control garbage)
```

### `P0-09` Visual Golden Snapshot Parity
```gherkin
Feature: Visual regression parity
  Scenario Outline: Golden snapshots match expected baseline at target widths
    Given deterministic fixture data and a mocked TTY
    When visual snapshot test renders <surface> at width <width> and height <height>
    Then rendered output matches committed snapshot key <snapshot_key>
    And any diff requires explicit reviewer approval before merge

    Examples:
      | surface      | width | height | snapshot_key     |
      | chat         | 72    | 34     | chat-72          |
      | chat         | 96    | 34     | chat-96          |
      | chat         | 128   | 34     | chat-128         |
      | scan         | 72    | 34     | scan-72          |
      | models       | 96    | 30     | models-96        |
      | help-browser | 128   | 30     | help-browser-128 |
```

### `P0-10` Model/Session Workflow Parity
```gherkin
Feature: Model and session workflow parity
  Scenario: Model picker selection and session export formats are stable
    Given model inventory endpoints return loaded and on-disk entries
    When the user selects an on-disk model in the picker
    Then selection metadata includes source="disk" and loaded=false
    And the picker closes after selection
    Given a session with user and assistant turns
    When export format is json or markdown
    Then output contains deterministic role/content ordering and expected metadata fields
```

---

## 3) Visual Golden Capture List and Viewport Sizes

### 3.1 Existing enforced captures (current baseline)

| Capture ID | Surface | Snapshot Key(s) | Viewport(s) (cols x rows) | Fixture Seed | Test Source |
|---|---|---|---|---|---|
| `VG-CHAT` | MessageList chat response card | `chat-72`, `chat-96`, `chat-128` | `72x34`, `96x34`, `128x34` | `CHAT_MESSAGES` | `tests/tui/visual-snapshots.test.tsx` |
| `VG-SCAN` | MessageList system scan output | `scan-72`, `scan-96`, `scan-128` | `72x34`, `96x34`, `128x34` | `SCAN_MESSAGES` | `tests/tui/visual-snapshots.test.tsx` |
| `VG-MODELS` | ModelPicker list panel | `models-72`, `models-96`, `models-128` | `72x30`, `96x30`, `128x30` | mocked `/admin/models*` + `/v1/models` | `tests/tui/visual-snapshots.test.tsx` |
| `VG-HELP` | CommandBrowser command list | `help-browser-72`, `help-browser-96`, `help-browser-128` | `72x30`, `96x30`, `128x30` | `HELP_COMMANDS` | `tests/tui/visual-snapshots.test.tsx` |

### 3.2 Required additions for complete P0 parity closure

| Capture ID | Surface | Required Viewports (cols x rows) | Reason |
|---|---|---|---|
| `VG-APP-IDLE` | Full App shell (header + input + status) | `72x30`, `96x34`, `128x40` | Protect alternate-buffer shell layout (`P0-03`) |
| `VG-APP-SAFE` | App with runtime safe-mode badge enabled | `96x34` | Protect safety-state visibility (`P0-05`) |
| `VG-OVERLAY-MENU` | Opta menu overlay centered alignment | `72x30`, `128x30` | Guard overlay geometry regressions (`P0-05`) |
| `VG-PERMISSION` | Permission prompt rendering with countdown | `96x30` | Guard safety decision UX (`P0-07`) |
| `VG-SCROLL-DEEP` | Long message list + scrollbar thumb state | `96x34` | Guard scroll rendering parity (`P0-08`) |

### 3.3 Visual capture generation command

```bash
npx vitest run tests/tui/visual-snapshots.test.tsx
```

---

## 4) Data Fixtures and Seeding Plan

## 4.1 Deterministic test runtime contract
- Set `CI=true`, `FORCE_COLOR=1`, `TZ=UTC` for all parity jobs.
- Use deterministic terminal dimensions through `MockStdout(columns, rows)` in TUI tests.
- Freeze or constrain clock-sensitive fixtures where timestamps are asserted (`Date.UTC(...)` usage in visual fixtures).
- Enforce sanitized terminal output before snapshot assertions (`sanitizeTerminalText`).

### 4.2 Canonical fixture families

| Fixture Family | Seed Inputs | Used By | Determinism Rule |
|---|---|---|---|
| `session.chat` | user + assistant markdown response pair (`CHAT_MESSAGES`) | `VG-CHAT`, message rendering tests | Fixed timestamp + static markdown payload |
| `session.scan` | `/scan` command + system block payload (`SCAN_MESSAGES`) | `VG-SCAN` | Fixed timestamp + preformatted box text |
| `model.inventory` | loaded + on-disk model metadata (mocked fetch responses) | ModelPicker tests + `VG-MODELS` | Stub all model endpoints; reject unknown URLs |
| `command.catalog` | static `SlashCommandDef[]` list (`HELP_COMMANDS`) | `VG-HELP`, command browser tests | Stable ordering by category + name |
| `permission.race` | one request id, two decision attempts | permission coordinator tests | First resolution wins, second marked conflict |
| `permission.mode` | config matrices for safe/auto/plan/ci/research | permissions tests | Schema-validated fixed configs |
| `reconnect.probe` | `/healthz` + `/readyz` + `/v1/models` response permutations | reconnect job tests | Explicit mock response ordering |
| `stream.sanitization` | ANSI/control-character token chunks | `agent-streaming` test | Expected visible text strictly normalized |
| `resize.fuzz` | seeded RNG `1337420`, key stream, resize stream, token stream | `interaction-fuzz` | Fixed seed + bounded iteration count |

### 4.3 Fixture storage plan (target layout)

| Path (proposed) | Contents |
|---|---|
| `tests/fixtures/parity/sessions/chat.json` | canonical chat turns for visual baselines |
| `tests/fixtures/parity/sessions/scan.json` | canonical scan/system block payload |
| `tests/fixtures/parity/models/inventory-loaded-and-disk.json` | model picker deterministic inventory |
| `tests/fixtures/parity/permissions/modes.json` | mode-to-tool permission expectations |
| `tests/fixtures/parity/reconnect/probe-cases.json` | connected/degraded/disconnected probe matrix |

### 4.4 Seeding rules for CI
- No live network calls in parity tests; all external calls must be mocked/stubbed.
- No dependency on local machine terminal env vars beyond explicit mock (`COLUMNS`, `LINES`, `stdout.columns`, `stdout.rows`).
- Snapshot updates require explicit reviewer approval and capture diff artifact publication.

---

## 5) CI Mapping Table (Scenarios -> Checks/Jobs)

| Scenario IDs | Workflow | Job Name / Check Context | Command(s) | Required Outcome |
|---|---|---|---|---|
| `P0-01`, `P0-02` | `parity-macos-codex.yml` | `P0 matrix (20.x / build_lint_typecheck)` | `npm run build && npm run typecheck && npm run lint` | pass |
| `P0-01`, `P0-02` | `parity-macos-codex.yml` | `P0 matrix (20.x / core_smoke)` | `npm run test:core -- --run` | pass |
| `P0-01`, `P0-02` | `parity-macos-codex.yml` | `P0 matrix (22.x / build_lint_typecheck)` | `npm run build && npm run typecheck && npm run lint` | pass |
| `P0-01`, `P0-02` | `parity-macos-codex.yml` | `P0 matrix (22.x / core_smoke)` | `npm run test:core -- --run` | pass |
| `P0-09` | `parity-macos-codex.yml` | `Visual regression` | `npx vitest run tests/tui/visual-snapshots.test.tsx` | pass + snapshot integrity |
| `P0-06` | `parity-macos-codex.yml` | `Reconnect parity` | `npx vitest run tests/lmx/connection.test.ts tests/core/agent-streaming.test.ts tests/core/insights.test.ts` | pass |
| `P0-07` | `parity-macos-codex.yml` | `Permission race parity` | `npx vitest run tests/daemon/permission-coordinator.test.ts tests/core/permissions.test.ts` | pass |
| `P0-01..P0-10` | `parity-macos-codex.yml` | `Strict parity gate` | needs-check aggregator | all upstream jobs must be `success` |

### Required branch protection checks
- `P0 matrix (20.x / build_lint_typecheck)`
- `P0 matrix (20.x / core_smoke)`
- `P0 matrix (22.x / build_lint_typecheck)`
- `P0 matrix (22.x / core_smoke)`
- `Visual regression`
- `Reconnect parity`
- `Permission race parity`
- `Strict parity gate`

---

## 6) Sign-off Checklist

> **Verification audit: 2026-02-27** — All P0 test files exist and most pass locally. CI workflow exists but no remote configured. Key gaps: 5 required visual snapshot additions, TODO stubs in workflow for reconnect e2e and permission fuzz.
>
> **Update: 2026-02-28** — P0-03 alternate buffer lifecycle assertions added to `tests/tui/App.test.tsx` (cursor-hide/show lifecycle via ink direct render). P0-09 all 8 VG- snapshots captured: VG-APP-IDLE ×3 widths, VG-APP-SAFE, VG-OVERLAY-MENU ×2 widths, VG-PERMISSION, VG-SCROLL-DEEP.

## 6.1 Release-blocking sign-off (must all be true)
- [ ] All `P0-01` through `P0-10` scenarios marked `PASS` in the parity report. — _P0-03 ✓ (cursor lifecycle assertions added); P0-09 ✓ (all 8 VG- snapshots captured); remaining gaps: P0-06 reconnect e2e, P0-07 permission stress_
- [ ] All required workflow checks in `parity-macos-codex.yml` are green on the merge commit. — _Workflow exists and is correct; TODO stubs remain in reconnect + permission-race jobs; no remote to run_
- [ ] No unresolved visual diffs in `tests/tui/__snapshots__/visual-snapshots.test.tsx.snap`. — _All 8 VG- snapshots now captured: VG-APP-IDLE ×3, VG-APP-SAFE, VG-OVERLAY-MENU ×2, VG-PERMISSION, VG-SCROLL-DEEP_
- [ ] Reconnect and permission-race suites pass without retries/flakes. — _Both test files pass; stress/fuzz scenario not yet added (TODO in workflow)_
- [x] No live-network dependency in parity test path. — _All tests use mocks; chat integration test is skipIf(!ANTHROPIC_API_KEY)_
- [ ] Strict parity gate job result is `success`. — _Cannot verify — no remote configured_

### 6.2 Evidence package required for sign-off
- [ ] CI run URL(s) for all required checks. — _No remote; blocked_
- [ ] Snapshot diff artifact links (or explicit “no diff” record). — _Snapshot file exists but artifact upload TODO in workflow_
- [x] List of scenario IDs executed and their corresponding test files. — _Mapped below in Section 6.4_
- [ ] If any P1 scenario is deferred: issue ID, owner, due date, and risk note.

### 6.3 P1 closure checklist (parity completion milestone)
- [x] `P1-01` Tool card parity validated. — _tests/tui/ToolCard.test.tsx + tests/ui/toolcards.test.ts_
- [x] `P1-02` Thinking-block parity validated. — _tests/tui/ThinkingBlock.test.tsx + tests/ui/thinking.test.ts_
- [x] `P1-03` Theme/markdown/diff parity validated. — _tests/ui/theme.test.ts (5 themes) + markdown.test.ts + diff.test.ts_
- [x] `P1-04` Keybinding parity validated. — _tests/tui/keybindings.test.ts + HelpOverlay.test.tsx_
- [x] `P1-05` Interaction fuzz parity validated. — _tests/tui/interaction-fuzz.test.tsx (seeded RNG)_
- [x] `P1-06` Server/workflow command parity validated. — _tests/commands/server.test.ts_

### 6.4 Scenario-to-test file mapping (added 2026-02-27)

| Scenario | Primary Test File(s) |
|----------|---------------------|
| P0-01 | `npm run build && npm run typecheck && npm run lint:budget` |
| P0-02 | `tests/core/`, `tests/utils/`, `tests/ui/` via `test:parity:core-smoke` |
| P0-03 | `tests/tui/App.test.tsx` via `test:parity:desktop-path` |
| P0-04 | `tests/tui/InputBox.test.tsx`, `tests/ui/input.test.ts` |
| P0-05 | `tests/tui/menus-navigation.test.tsx`, `tests/tui/App.test.tsx` |
| P0-06 | `tests/lmx/connection.test.ts`, `tests/core/agent-streaming.test.ts`, `tests/core/insights.test.ts` |
| P0-07 | `tests/daemon/permission-coordinator.test.ts`, `tests/core/permissions.test.ts` |
| P0-08 | `tests/tui/ScrollView.test.tsx`, `tests/tui/useTerminalSize.test.ts` |
| P0-09 | `tests/tui/visual-snapshots.test.tsx` |
| P0-10 | `tests/tui/ModelPicker.test.tsx`, `tests/commands/share.test.ts` |

---

## 7) Execution Notes
- Canonical scenario IDs above are intended to replace placeholder TODO selectors in parity enforcement workflow and release criteria docs.
- Any future parity expansion must add scenario IDs first, then map them to concrete tests/checks in Section 5 before enabling hard-gate enforcement.
- **2026-02-27 audit:** All P1 scenarios have test coverage and pass. P0 gaps are: alternate buffer assertions (P0-03), 5 visual snapshot additions (P0-09), daemon reconnect e2e (P0-06 TODO), permission stress test (P0-07 TODO). CI workflow cannot be verified without git remote.
- **2026-02-28 update:** P0-03 resolved — 2 cursor-lifecycle assertions added using `inkRender` (debug:false) to capture raw ANSI output. P0-09 resolved — 8 VG- snapshot tests added covering all required golden captures at all specified widths. All 39 visual-snapshots tests pass.
