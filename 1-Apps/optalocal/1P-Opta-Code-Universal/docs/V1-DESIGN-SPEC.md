# Opta Code Desktop — Feature Specifications

*Design brief for frontend implementation via the Opta Frontend Design Skill*  
*Date: 2026-03-04 · Authored from user brief*

---

## Context: Reference Design

The user referenced **Codex (macOS app)** as the UX model for several features. Key elements from Codex to reference:

- Left sidebar: workspace/project tree with expandable groups
- Center: full-width AI chat panel (the primary surface)
- Right side: contextual panel (previously absent in Opta Code)
- Top bar: agent/run status indicators
- Chat messages are the primary UI — everything else is peripheral

The **Opta aesthetic** takes priority over Codex's aesthetic. All components must use:

- Background: `#09090b` (OLED void black)
- Primary: `#a855f7` (Electric Violet)
- Fonts: `Sora` (UI), `JetBrains Mono` (stats/code/data)
- Glass panels: `backdrop-filter: blur(16–24px)` + `rgba(24,24,27,0.55)` backgrounds
- Animations: Framer Motion spring physics only

### Finalised Aesthetic Additions (V3)

- **Blended Widgets**: Widgets use `rgba(255,255,255,0.02)` backgrounds with a delicate `0.04` border that fades into the OLED background.
- **Ambient Glow**: Large, very blurred (`120px`) positional color blobs (e.g. Violet and Cyan) sit beneath the layout z-index to provide subtle environmental lighting.
- **Auto-expanding Center**: The widget panes must seamlessly collapse when empty, allowing the chat (`flex: 1`) to take the full width dynamically.
- **Retro Branding**: The "OPTA CODE" title uses a pixel-art block font (`'Press Start 2P'`) with a stacked wireframe `text-shadow` (alternating black and primary violet) to create an intricate retro-tech drop shadow, positioned prominently at the top center of the UI.

---

## Feature 1: Project Folders System

### Overview

A Codex-style project management system that lets users create project containers with individual settings, AI context notes, and per-project behaviour overrides. Projects are the primary organisational unit above sessions.

### Data Model

```typescript
interface OptaProject {
  id: string;                        // UUID
  name: string;                      // Display name
  color: string;                     // Accent color (CSS hex/hsl)
  icon?: string;                     // Lucide icon name
  rootPath?: string;                 // Filesystem root (optional)
  createdAt: string;                 // ISO timestamp
  updatedAt: string;
  
  // AI Behaviour Overrides
  aiConfig: {
    systemPrompt?: string;           // Project-specific system context
    preferredModel?: string;         // e.g. "Qwen2.5-Coder-32B"
    autonomyLevel?: 1 | 2 | 3 | 4 | 5;  // Overrides global autonomy
    autonomyMode?: "execution" | "ceo";
    allowedTools?: string[];         // Tool whitelist (null = all)
    blockedTools?: string[];         // Tool blacklist
    maxTurnsPerSession?: number;     // Circuit breaker override
    temperature?: number;            // 0–2 inference temperature
  };
  
  // Project Notes (AI Context)
  notes: {
    id: string;
    title: string;
    body: string;                    // Markdown
    pinned: boolean;
    tags: string[];
  }[];
  
  // Project Settings
  settings: {
    defaultWorkspace?: string;       // Pre-fill workspace on new sessions
    sessionRetention?: "all" | "recent-10" | "recent-30";
    autoCommit?: boolean;
    checkpointsEnabled?: boolean;
    gitBranch?: string;              // Expected branch for this project
  };
}
```

### UI Components

#### Left Sidebar: Project Tree

- **Structure**: Three-tier tree: Projects → Workspaces → Sessions
- **Project header row**: Color swatch dot + project name + session count badge + expand chevron
- **Add project**: `+ New Project` button at top of sidebar (opens creation modal)
- **Active project**: highlighted row with violet left border accent, glow
- **Context menu** (right-click): Rename, Edit Settings, Duplicate, Archive, Delete

```
▾ 🟣 opta-core          (12 sessions)
    ▾ Workspaces
        ├ auth-refactor     ● streaming
        ├ daemon-protocol   ○ idle  
        └ test-suite        ○ idle
▸ 🔵 opta-lmx            (4 sessions)
▸ 🟡 opta-home           (2 sessions)
+ New Project
```

#### Project Creation Modal

Full-screen modal overlay with glassmorphism panel. Fields:

1. **Name** — text input, Sora font, large
2. **Color** — 8-swatch color picker (using Opta neon palette)
3. **Icon** — searchable Lucide icon picker (16 presets shown)
4. **Root Path** — optional filesystem path picker (Tauri: folder dialog)
5. **AI Context Notes** — multi-line textarea (`CONTEXT.md` section placeholder)
6. **Quick AI Config**: autonomy level slider, preferred model dropdown

#### Project Detail Panel / Settings Drawer

Accessible from sidebar context menu or project header gear icon. Slides in from the right. Tabs:

- **Overview** — name, color, icon, root path, created date, session stats
- **AI Behaviour** — all `aiConfig` fields as form controls
- **Notes** — pinnable markdown notes (the "AI considers these" context)
- **Settings** — session retention, auto-commit, git branch expectations

#### Project Notes: "AI Context" Editor

- Rich markdown editor with preview toggle
- Pinned notes appear above all others with a 📌 indicator
- Tags: `#architecture`, `#constraints`, `#style`, `#dependencies`
- Notes are automatically injected into the system prompt for all sessions in this project (configurable per note)
- "Include in AI context" toggle per note

#### Implementation Notes

- **Storage**: Project metadata persists via `localStorage` + optional daemon config sync
- **Session linking**: Sessions get a `projectId` field; default project = `"default"` (uncategorised)
- **Tauri**: Root path uses `invoke("open_folder_dialog")` for native folder picker
- **Icon in topbar**: Active project name + color dot shown in topbar breadcrumb

---

## Feature 2: Opta App Logo Buttons

### Overview

Replace raw text links (e.g. "ACCOUNTS") with branded logo buttons for each Opta property. Clicking opens the respective URL in the system browser.

### Logo Button Spec

Each Opta app button should display:

- The app's canonical **SVG logo mark** (24–32px)
- The app name beneath in `Sora 500` at 10px, `--text-muted` color
- Hover state: logo glows with the app's accent color; name transitions to `--text-soft`
- Active/pressed: brief scale(0.95) spring animation

### App Inventory

| App | URL | Accent Colour |
|-----|-----|---------------|
| Opta Accounts | accounts.optalocal.com | `#a855f7` |
| Opta Home | optalocal.com | `#a855f7` |
| Opta Help | help.optalocal.com | `#06b6d4` |
| Opta Learn | learn.optalocal.com | `#22c55e` |
| Opta Status | status.optalocal.com | `#f59e0b` |
| LMX Dashboard | lmx.optalocal.com | `#06b6d4` |

### Placement in UI

**Primary: Left Sidebar Bottom**

- `Accounts` user profile strip at the very bottom of the left sidebar, showing avatar and username.
- Clicking opens a context menu or navigates to `accounts.optalocal.com`.

**Secondary: Settings Modal → "Opta Ecosystem" tab**

- Full-sized grid of all Opta apps with logo, name, description, and "Open →" link.

### Component: `<OptaAppButton>`

```tsx
interface OptaAppButtonProps {
  app: "accounts" | "home" | "help" | "learn" | "status" | "lmx";
  size?: "sm" | "md";   // sm = topbar, md = popover/grid
  showLabel?: boolean;
}
```

### Component: `<OptaAppsPopover>`

- Triggered by `⊞` icon button in topbar
- Framer Motion `AnimatePresence` scale + opacity enter from `0.95`
- 3-column grid of `<OptaAppButton size="md">` components
- Uses Tauri `open_url` on native; `window.open(url, '_blank')` on web

---

## Feature 3: Sidebar Agent Status

### Overview

Instead of a full-width horizontal bar, active agent statuses are displayed at the very top of the Left Pane, under an `AGENTS` header. This frees up vertical space for the central chat and branding.

### Layout

- **Header**: Mini `AGENTS` label in the left sidebar.
- **Agent Pill**: Dark pill with green pulsing dot, session name, project tag, and elapsed time.
- Clicking the pill jumps to that session.

### Data Derivation

Derived from existing `streamingBySession`, `pendingPermissionsBySession`, and `sessions` state — no new API calls required.

```typescript
type AgentBarItem = {
  sessionId: string;
  sessionTitle: string;
  projectName?: string;
  state: "streaming" | "awaiting-review" | "blocked" | "completed";
  elapsedMs: number;
  completedAt?: number;  // for auto-fade
};
```

**"Awaiting review" trigger**: `isStreaming` transitions `true → false` for a session that was previously streaming. Clears when user scrolls to bottom of that session's timeline.

**Overflow**: Max 6 pills, then `+N more` pill appears. Pills are horizontally scrollable.

---

## Feature 4: Modular Widget Tile System

### Overview

Drag-and-rearrange widgets displayed on the **left and right sides** of the AI chat panel. Apple Widgets-style: 3 sizes, any tile position, saved per-project. The chat centre always gets majority of horizontal space.

### Layout

```
┌──────────┬────────────────────────────┬──────────┐
│  LEFT    │                            │  RIGHT   │
│  PANE    │      AI CHAT (flex 1)      │  PANE    │
│ 280–320px│                            │ 300–340px│
└──────────┴────────────────────────────┴──────────┘
```

Both panes are collapsible via `‹/›` chevron. Below 1200px: right auto-collapses. Below 900px: both collapse.

### Widget Sizes

| Size | Grid Cols | Grid Rows | Use case |
|------|-----------|-----------|----------|
| Small (S) | 1 | 1 | Single stat |
| Medium (M) | 2 | 1 | Stat + sparkline |
| Tall (T) | 2 | 2 | Scrollable content panel |

### 6 Built-in Widgets

#### Widget 1: ATPO Planning (`atpo`, default: Tall)

- Current phase indicator: "Phase 2/5: Execution"
- Numbered phase list with status icons (pending/active/done)
- Thin violet progress bar at bottom
- Data: `timelineItems` filtered for plan events

#### Widget 2: Benchmark Performance (`benchmark`, default: Medium)

- Active model name (JetBrains Mono)
- Score rows: HumanEval, MBPP, MMLU with ▲/▼ delta vs baseline
- 7-run sparkline trend
- Data: `daemonClient.benchmarkResults()` on-mount fetch

#### Widget 3: Runtime Details (`runtime`, default: Medium)

- Circular memory gauge showing unified memory `%` (violet arc fill)
- Throughput `t/s` in neon green
- Context usage bar (prompt / completion / remaining tokens)
- Daemon uptime, PID, worker count
- Data: `daemonClient.lmxStatus()` + `daemonClient.health()`, polled every 3s

#### Widget 4: Opta Next Steps (`next-steps`, default: Tall)

- AI-generated 3–5 prioritised action items for the active project
- Refresh button dispatches `submitMessage("What should I work on next in this project? Give me 3–5 prioritised action items.")`
- Inline `[session link]` buttons for items related to existing sessions
- Loading skeleton while generating; graceful empty state

#### Widget 5: Tool Usage Live Log (`tool-log`, default: Tall)

- Scrolling live log of every tool call by the active agent
- Each row: colour-coded tool icon + tool name + argument summary + status + duration
  - `read_file` → cyan, `edit_file` → violet, `run_command` → amber, `write_file` → green, errors → red
- Auto-scrolls to latest; relative timestamps (`Xs ago`)
- Data: `timelineItems` filtered for `tool_call` + `tool_result` events

#### Widget 6: Plan Completion (`plan-completion`, default: Medium)

- Large animated progress ring with `%` in centre
- Current phase name in Sora
- Horizontal scrollable phase chips (Planning → Execution → Verification) with state coloring
- Estimated turns remaining
- Data: same plan event parsing as Widget 1

#### Widget 7: CLI Terminal Stream (`cli-stream`, default: Tall)

- Imports the aesthetic and functionality of `1D-Opta-CLI-TS`.
- Displays a raw monospace output stream of internal daemon events, tool execution stdout, and LMX routing logs.
- Includes a mini prompt `$` at the bottom to inject raw CLI commands (e.g., `/reset`, `system prune`).
- Styling uses full `JetBrains Mono` and replicates Ink/Chalk colors.

---

## Feature 5: In-Place Settings Transition (Ctrl+S)

### Overview

Instead of a modal overlay, pressing `Ctrl+S` (or `Cmd+S`) triggers an animated Framer Motion layout transition. The central AI Chat panel fades/scales out, and is replaced in-situ by a spacious Settings menu.

### Settings Grid Layout

- A masonry or standard flex grid of settings categories.
- Each category shows a large canonical SVG icon (e.g., General, Connection, Projects, Intelligence, Interface).
- Icons and text are dimmed by default, and illuminate brightly with their respective accent colors on hover.
- Pressing `Ctrl+S` again (or `Escape`) reverses the transition, restoring the chat panel.

---

## Feature 6: Bottom-Left System Health Visualisers

### Overview

A persistent, compact telemetry area pinned to the bottom of the left project tree pane.

### Layout

- **Server Health**: A small pulsing dot (green/amber/red) indicating WebSocket/Daemon connection status.
- **Current Runtime**: Text indicating throughput (`t/s`) or latency (`ms`).
- **Models Loaded**: A pill showing active VRAM usage and the name of the loaded model (e.g., `32B`).

---

## Feature 7: Composer Mode Cycling (Shift+Tab)

### Overview

The chat composer box clearly displays the current agent input mode, and allows rapid keyboard cycling.

### UI & Interaction

- **Indicator**: A prominent pill inside the composer (e.g., left-aligned or above the text area) showing the mode name (Code, Plan, Review, Chat).
- **Styling**: Each mode has a distinct color code (e.g., Plan = Blue, Code = Violet, Review = Amber).
- **Shortcut**: Pressing `Shift+Tab` while focused in the composer cycles through the available modes sequentially with a snappy spring animation.

---

### Widget Architecture

```typescript
interface WidgetLayout {
  projectId: string;
  leftPane: WidgetSlot[];
  rightPane: WidgetSlot[];
}
interface WidgetSlot {
  id: string;
  widgetId: WidgetId | null;    // null = empty slot
  size: "S" | "M" | "T";
  column: 0 | 1;                // 2-col pane
  row: number;
}
type WidgetId = "atpo" | "benchmark" | "runtime" | "next-steps" | "tool-log" | "plan-completion";
```

**Persistence**: `localStorage` key `opta:widget-layout:${projectId}`  
**Drag-and-drop**: `@dnd-kit/core` (new dependency)

### Widget Edit Mode

- `⊞ Customise` button at top of each pane enters edit mode
- Widgets get Apple-style **wiggle animation** (`@keyframes wiggle: transform rotate(±1.5deg)`)
- `–` remove buttons appear on occupied slots
- `+ Add Widget` on empty slots opens widget picker (2-col grid with preview + size selector)
- Click outside or press `Escape` to exit edit mode

### Default Widget Layout (new project)

- Left: Runtime (M, row 0) + ATPO (T, row 1)
- Right: Tool Log (T, row 0) + Plan Completion (M, row 2)

---

## Files to Create / Modify

### New

```
src/components/ProjectManager/
  ProjectSidebar.tsx      ← Tree: Projects → Workspaces → Sessions
  ProjectModal.tsx        ← Creation/edit modal
  ProjectDrawer.tsx       ← Settings drawer (AI config, notes, settings)
  ProjectNoteEditor.tsx   ← Pinnable markdown notes

src/components/AgentBar/
  AgentBar.tsx            ← Fixed 36px bar between topbar and body
  AgentPill.tsx           ← Individual pill component

src/components/widgets/
  WidgetAtpo.tsx
  WidgetBenchmark.tsx
  WidgetRuntime.tsx
  WidgetNextSteps.tsx
  WidgetToolLog.tsx
  WidgetPlanCompletion.tsx
  WidgetShell.tsx         ← Shared wrapper (size, edit mode controls)

src/components/WidgetPane/
  WidgetPane.tsx          ← Pane container with 2-col tile grid + collapse
  WidgetCustomiser.tsx    ← Edit mode overlay + widget picker

src/components/OptaAppsPopover/
  OptaAppButton.tsx
  OptaAppsPopover.tsx

src/hooks/
  useProjects.ts          ← CRUD + localStorage
  useWidgetLayout.ts      ← Widget slot state + persistence
  useAgentBar.ts          ← Derived agent bar items from session state

src/lib/
  projectStorage.ts       ← LocalStorage read/write helpers
```

### Modified

- `src/App.tsx` — Wire in `AgentBar`, `ProjectSidebar`, `WidgetPane` (left + right), `OptaAppsPopover`
- `src/types.ts` — Add `OptaProject`, `WidgetLayout`, `AgentBarItem`
- `src/opta.css` — Widget grid vars, pane collapse CSS, agent bar styles, project tree styles

---

## Prototype Targets for Design Skill

Generate 3 HTML prototypes **each showing all 4 features simultaneously**:

1. **"Wide Command"** — Both panes open, agent bar active (1 streaming + 1 awaiting review), project tree fully expanded, all 6 widgets visible with populated mock data
2. **"Compact Focus"** — Left pane collapsed (just `›` strip), right pane showing tool-log + runtime, agent bar with 1 pill, project tree minimal
3. **"Gear Shift"** — Widget Edit Mode active on right pane (wiggling tiles, `+ Add` slots visible), project creation modal overlaid on top

Each prototype **must** include:

- At least 2 running agents in the agent bar
- At least 3 projects in the sidebar tree
- All widgets showing realistic mock data
- Opta App buttons in topbar (Accounts logo + `⊞ Apps` button)
