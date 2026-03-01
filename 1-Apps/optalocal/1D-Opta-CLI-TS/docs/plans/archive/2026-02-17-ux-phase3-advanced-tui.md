---
status: archived
---

# Phase 3: Advanced TUI — Split Panes, Focus & Keybindings

> **Status: SUPERSEDED** — Goals achieved via Sidebar, BrowserManagerRail, keybindings.ts/useKeyboard.ts, OptaMenuOverlay. Tab navigation (G32) remains open. Verified 2026-02-27.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add split-pane layout with sidebar, focus management system, scrollable message history, tab navigation between panels, and customizable keybindings — completing all remaining UX gaps for full OpenCode parity.

**Architecture:** Build on Phase 2's Ink component tree. Add a `<SplitPane>` layout component that divides the terminal into main content + sidebar using Ink's `<Box>` flex layout. Implement a focus context provider for tab navigation. Add a keybinding config layer loaded from `.opta/keybindings.json`.

**Tech Stack:** Ink 5, React 18 (useContext for focus), conf (existing)

**Gaps Closed:** G03, G05, G07, G08, G31, G32

**Prerequisites:** Phase 2 complete (Ink migration, full-screen TUI working)

---

### Task 1: Create SplitPane layout component (G03)

**Files:**
- Create: `src/tui/SplitPane.tsx`
- Test: `src/__tests__/tui/SplitPane.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/SplitPane.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { SplitPane } from '../../tui/SplitPane.js';
import { Text } from 'ink';

describe('SplitPane', () => {
  it('should render main and sidebar', () => {
    const { lastFrame } = render(
      <SplitPane
        main={<Text>Main content</Text>}
        sidebar={<Text>Sidebar</Text>}
        sidebarWidth={20}
      />
    );
    expect(lastFrame()).toContain('Main content');
    expect(lastFrame()).toContain('Sidebar');
  });

  it('should hide sidebar when collapsed', () => {
    const { lastFrame } = render(
      <SplitPane
        main={<Text>Main content</Text>}
        sidebar={<Text>Sidebar</Text>}
        sidebarWidth={20}
        sidebarVisible={false}
      />
    );
    expect(lastFrame()).toContain('Main content');
    expect(lastFrame()).not.toContain('Sidebar');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/SplitPane.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// src/tui/SplitPane.tsx
import React from 'react';
import { Box } from 'ink';

interface SplitPaneProps {
  main: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarWidth?: number;
  sidebarVisible?: boolean;
  sidebarPosition?: 'left' | 'right';
}

export function SplitPane({
  main,
  sidebar,
  sidebarWidth = 28,
  sidebarVisible = true,
  sidebarPosition = 'right',
}: SplitPaneProps) {
  if (!sidebarVisible) {
    return <Box flexGrow={1}>{main}</Box>;
  }

  const mainPane = <Box flexGrow={1} flexDirection="column">{main}</Box>;
  const sidePane = (
    <Box
      width={sidebarWidth}
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {sidebar}
    </Box>
  );

  return (
    <Box flexDirection="row" width="100%">
      {sidebarPosition === 'left' ? (
        <>{sidePane}{mainPane}</>
      ) : (
        <>{mainPane}{sidePane}</>
      )}
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/SplitPane.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/SplitPane.tsx src/__tests__/tui/SplitPane.test.tsx
git commit -m "feat(cli): create SplitPane layout component (G03)"
```

---

### Task 2: Create Sidebar component (G05)

**Files:**
- Create: `src/tui/Sidebar.tsx`
- Test: `src/__tests__/tui/Sidebar.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/Sidebar.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Sidebar } from '../../tui/Sidebar.js';

describe('Sidebar', () => {
  it('should show session info', () => {
    const { lastFrame } = render(
      <Sidebar
        model="Qwen2.5-72B"
        sessionId="abc12345"
        tokens={{ prompt: 1000, completion: 500, total: 1500 }}
        tools={3}
        cost="$0.00"
        mode="normal"
        elapsed={12.5}
      />
    );
    expect(lastFrame()).toContain('Qwen2.5-72B');
    expect(lastFrame()).toContain('abc12345');
    expect(lastFrame()).toContain('1.5K');
  });

  it('should show mode', () => {
    const { lastFrame } = render(
      <Sidebar
        model="test"
        sessionId="abc"
        tokens={{ prompt: 0, completion: 0, total: 0 }}
        tools={0}
        cost="$0.00"
        mode="plan"
        elapsed={0}
      />
    );
    expect(lastFrame()).toContain('plan');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/Sidebar.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// src/tui/Sidebar.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface SidebarProps {
  model: string;
  sessionId: string;
  tokens: { prompt: number; completion: number; total: number };
  tools: number;
  cost: string;
  mode: string;
  elapsed: number;
  speed?: number;
  title?: string;
}

function fmtTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function Sidebar({
  model, sessionId, tokens, tools, cost, mode, elapsed, speed, title,
}: SidebarProps) {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">Session</Text>
      <Box marginTop={1} flexDirection="column">
        <Row label="Model" value={model} />
        <Row label="Session" value={sessionId.slice(0, 8)} />
        {title && <Row label="Title" value={title.slice(0, 20)} />}
        <Row label="Mode" value={mode} color={mode === 'plan' ? 'magenta' : mode === 'auto' ? 'yellow' : undefined} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Tokens</Text>
        <Row label="Prompt" value={fmtTokens(tokens.prompt)} />
        <Row label="Reply" value={fmtTokens(tokens.completion)} />
        <Row label="Total" value={fmtTokens(tokens.total)} />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Stats</Text>
        <Row label="Tools" value={String(tools)} />
        <Row label="Cost" value={cost} color="green" />
        {elapsed > 0 && <Row label="Time" value={`${elapsed.toFixed(1)}s`} />}
        {speed && speed > 0 && <Row label="Speed" value={`${speed.toFixed(0)} t/s`} />}
      </Box>
    </Box>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box>
      <Text dimColor>{label.padEnd(8)}</Text>
      <Text color={color as never}>{value}</Text>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/Sidebar.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/Sidebar.tsx src/__tests__/tui/Sidebar.test.tsx
git commit -m "feat(cli): create Sidebar component with session/token/stats info (G05)"
```

---

### Task 3: Create FocusContext for panel navigation (G07)

**Files:**
- Create: `src/tui/FocusContext.tsx`
- Test: `src/__tests__/tui/FocusContext.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/FocusContext.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { FocusProvider, useFocusPanel } from '../../tui/FocusContext.js';
import { Text } from 'ink';

function TestComponent() {
  const { activePanel } = useFocusPanel();
  return <Text>Active: {activePanel}</Text>;
}

describe('FocusContext', () => {
  it('should default to input panel', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <TestComponent />
      </FocusProvider>
    );
    expect(lastFrame()).toContain('Active: input');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/FocusContext.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// src/tui/FocusContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';

type Panel = 'input' | 'messages' | 'sidebar';

interface FocusContextValue {
  activePanel: Panel;
  setActivePanel: (panel: Panel) => void;
  nextPanel: () => void;
  previousPanel: () => void;
}

const PANEL_ORDER: Panel[] = ['input', 'messages', 'sidebar'];

const FocusCtx = createContext<FocusContextValue>({
  activePanel: 'input',
  setActivePanel: () => {},
  nextPanel: () => {},
  previousPanel: () => {},
});

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [activePanel, setActivePanel] = useState<Panel>('input');

  const nextPanel = useCallback(() => {
    setActivePanel(prev => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]!;
    });
  }, []);

  const previousPanel = useCallback(() => {
    setActivePanel(prev => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]!;
    });
  }, []);

  return (
    <FocusCtx.Provider value={{ activePanel, setActivePanel, nextPanel, previousPanel }}>
      {children}
    </FocusCtx.Provider>
  );
}

export function useFocusPanel() {
  return useContext(FocusCtx);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/FocusContext.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/FocusContext.tsx src/__tests__/tui/FocusContext.test.tsx
git commit -m "feat(cli): create FocusContext for panel navigation (G07)"
```

---

### Task 4: Add Tab key navigation between panels (G32)

**Files:**
- Modify: `src/tui/hooks/useKeyboard.ts`
- Modify: `src/tui/App.tsx`

**Step 1: Add Tab handling to keyboard hook**

```typescript
// In useKeyboard, add:
if (key.tab) {
  if (key.shift) {
    actions.onPreviousPanel?.();
  } else {
    actions.onNextPanel?.();
  }
}
```

**Step 2: Wire into App with FocusProvider**

Wrap the App component in `<FocusProvider>` and connect Tab to `nextPanel`.

**Step 3: Add visual focus indicators**

Each panel should show a highlighted border when focused:
```tsx
<Box borderColor={activePanel === 'messages' ? 'cyan' : 'gray'}>
```

**Step 4: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/tui/hooks/useKeyboard.ts src/tui/App.tsx
git commit -m "feat(cli): add Tab key navigation between panels (G32)"
```

---

### Task 5: Create ScrollView component for message history (G08)

**Files:**
- Create: `src/tui/ScrollView.tsx`
- Test: `src/__tests__/tui/ScrollView.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/ScrollView.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { ScrollView } from '../../tui/ScrollView.js';
import { Text } from 'ink';

describe('ScrollView', () => {
  it('should render visible items', () => {
    const items = Array.from({ length: 50 }, (_, i) => `Line ${i}`);
    const { lastFrame } = render(
      <ScrollView height={5}>
        {items.map((item, i) => <Text key={i}>{item}</Text>)}
      </ScrollView>
    );
    // Should only show last items (auto-scroll to bottom)
    expect(lastFrame()).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/ScrollView.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// src/tui/ScrollView.tsx
import React, { useState, useEffect, type ReactNode } from 'react';
import { Box, useInput } from 'ink';

interface ScrollViewProps {
  children: ReactNode;
  height: number;
  autoScroll?: boolean;
  focusable?: boolean;
}

export function ScrollView({
  children,
  height,
  autoScroll = true,
  focusable = false,
}: ScrollViewProps) {
  const childArray = React.Children.toArray(children);
  const totalItems = childArray.length;
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll to bottom when new items added
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(Math.max(0, totalItems - height));
    }
  }, [totalItems, height, autoScroll]);

  // Keyboard scroll when focused
  useInput((input, key) => {
    if (!focusable) return;

    if (key.upArrow) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setScrollOffset(prev => Math.min(Math.max(0, totalItems - height), prev + 1));
    }
    if (key.pageUp) {
      setScrollOffset(prev => Math.max(0, prev - height));
    }
    if (key.pageDown) {
      setScrollOffset(prev => Math.min(Math.max(0, totalItems - height), prev + height));
    }
  });

  const visibleItems = childArray.slice(scrollOffset, scrollOffset + height);
  const showScrollbar = totalItems > height;
  const scrollbarPos = totalItems > height
    ? Math.round((scrollOffset / (totalItems - height)) * (height - 1))
    : 0;

  return (
    <Box flexDirection="row" height={height}>
      <Box flexDirection="column" flexGrow={1}>
        {visibleItems}
      </Box>
      {showScrollbar && (
        <Box flexDirection="column" width={1}>
          {Array.from({ length: height }, (_, i) => (
            <Box key={i}>
              {i === scrollbarPos ? (
                <Box><Text>█</Text></Box>
              ) : (
                <Box><Text dimColor>░</Text></Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Need to import Text
import { Text } from 'ink';
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/ScrollView.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/ScrollView.tsx src/__tests__/tui/ScrollView.test.tsx
git commit -m "feat(cli): create ScrollView component with auto-scroll and scrollbar (G08)"
```

---

### Task 6: Wire ScrollView into MessageList

**Files:**
- Modify: `src/tui/MessageList.tsx`
- Modify: `src/tui/App.tsx`

**Step 1: Wrap messages in ScrollView**

```tsx
// In MessageList:
import { ScrollView } from './ScrollView.js';

export function MessageList({ messages, height }: MessageListProps & { height: number }) {
  return (
    <ScrollView height={height} autoScroll={true}>
      {messages.map((msg, i) => (
        <MessageRow key={i} message={msg} />
      ))}
    </ScrollView>
  );
}
```

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/tui/MessageList.tsx src/tui/App.tsx
git commit -m "feat(cli): wire ScrollView into MessageList for scrollable history (G08)"
```

---

### Task 7: Wire SplitPane + Sidebar into App

**Files:**
- Modify: `src/tui/App.tsx`

**Step 1: Add sidebar toggle and SplitPane layout**

```tsx
// In App component:
const [sidebarVisible, setSidebarVisible] = useState(true);

// Ctrl+B toggles sidebar
// In keyboard handler:
if (key.ctrl && input === 'b') {
  setSidebarVisible(prev => !prev);
}

// In render:
<SplitPane
  main={
    <>
      <MessageList messages={messages} height={messageAreaHeight} />
      <InputBox onSubmit={handleSubmit} mode={mode} isLoading={isLoading} />
    </>
  }
  sidebar={
    <Sidebar
      model={model}
      sessionId={sessionId}
      tokens={{ prompt: promptTokens, completion: completionTokens, total: tokens }}
      tools={tools}
      cost="$0.00"
      mode={mode}
      elapsed={elapsed}
    />
  }
  sidebarWidth={28}
  sidebarVisible={sidebarVisible}
/>
```

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(cli): wire SplitPane and Sidebar into App layout (G03, G05)"
```

---

### Task 8: Create keybinding configuration system (G31)

**Files:**
- Create: `src/tui/keybindings.ts`
- Test: `src/__tests__/tui/keybindings.test.ts`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/keybindings.test.ts
import { describe, it, expect } from 'vitest';
import { KeybindingConfig, getKeybinding, defaultKeybindings } from '../../tui/keybindings.js';

describe('keybindings', () => {
  it('should have default keybindings', () => {
    const bindings = defaultKeybindings();
    expect(bindings.exit).toBeDefined();
    expect(bindings.toggleSidebar).toBeDefined();
    expect(bindings.nextPanel).toBeDefined();
  });

  it('should resolve keybinding', () => {
    const binding = getKeybinding('exit');
    expect(binding).toBeDefined();
    expect(binding.key).toBeDefined();
    expect(binding.description).toBeDefined();
  });

  it('should allow custom overrides', () => {
    const custom = { exit: { key: 'ctrl+q', description: 'Quit' } };
    const binding = getKeybinding('exit', custom);
    expect(binding.key).toBe('ctrl+q');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/keybindings.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/tui/keybindings.ts
export interface KeyBinding {
  key: string;
  description: string;
}

export interface KeybindingConfig {
  exit: KeyBinding;
  toggleSidebar: KeyBinding;
  nextPanel: KeyBinding;
  previousPanel: KeyBinding;
  scrollUp: KeyBinding;
  scrollDown: KeyBinding;
  help: KeyBinding;
  clear: KeyBinding;
  slashMenu: KeyBinding;
  expandThinking: KeyBinding;
}

export function defaultKeybindings(): KeybindingConfig {
  return {
    exit: { key: 'ctrl+c', description: 'Exit Opta' },
    toggleSidebar: { key: 'ctrl+b', description: 'Toggle sidebar' },
    nextPanel: { key: 'tab', description: 'Next panel' },
    previousPanel: { key: 'shift+tab', description: 'Previous panel' },
    scrollUp: { key: 'up', description: 'Scroll up' },
    scrollDown: { key: 'down', description: 'Scroll down' },
    help: { key: 'ctrl+/', description: 'Show help' },
    clear: { key: 'ctrl+l', description: 'Clear screen' },
    slashMenu: { key: 'escape', description: 'Open command menu' },
    expandThinking: { key: 'ctrl+t', description: 'Toggle thinking' },
  };
}

export function getKeybinding(
  action: keyof KeybindingConfig,
  overrides?: Partial<Record<string, KeyBinding>>
): KeyBinding {
  const defaults = defaultKeybindings();
  if (overrides && overrides[action]) {
    return overrides[action]!;
  }
  return defaults[action];
}

export async function loadKeybindings(): Promise<Partial<Record<string, KeyBinding>>> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const configPath = join(process.cwd(), '.opta', 'keybindings.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/keybindings.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/keybindings.ts src/__tests__/tui/keybindings.test.ts
git commit -m "feat(cli): create configurable keybinding system (G31)"
```

---

### Task 9: Wire keybindings into keyboard hook

**Files:**
- Modify: `src/tui/hooks/useKeyboard.ts`

**Step 1: Load keybindings and use them for all shortcuts**

Replace hardcoded key checks with keybinding config lookups.

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/tui/hooks/useKeyboard.ts
git commit -m "feat(cli): wire configurable keybindings into keyboard hook (G31)"
```

---

### Task 10: Add /keybindings slash command

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add /keybindings command to show current bindings**

```typescript
case '/keys':
case '/keybindings': {
  const { defaultKeybindings } = await import('../tui/keybindings.js');
  const bindings = defaultKeybindings();
  const lines = Object.entries(bindings).map(([action, binding]) =>
    kv(binding.key.padEnd(14), `${binding.description} (${action})`, 14)
  );
  console.log('\n' + box('Keybindings', lines));
  console.log(chalk.dim('  Customize: .opta/keybindings.json\n'));
  return 'handled';
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add /keybindings command (G31)"
```

---

### Task 11: Add visual focus indicators to panels

**Files:**
- Modify: `src/tui/App.tsx`

**Step 1: Show active panel with highlighted border**

Use the FocusContext to highlight the currently focused panel:

```tsx
const { activePanel } = useFocusPanel();

// Messages panel
<Box borderColor={activePanel === 'messages' ? 'cyan' : 'gray'}>

// Input panel
<Box borderColor={activePanel === 'input' ? 'cyan' : 'gray'}>

// Sidebar
<Box borderColor={activePanel === 'sidebar' ? 'cyan' : 'gray'}>
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(cli): add visual focus indicators to panels (G07)"
```

---

### Task 12: Add keyboard scroll when messages panel focused

**Files:**
- Modify: `src/tui/ScrollView.tsx`
- Modify: `src/tui/App.tsx`

**Step 1: Enable keyboard scrolling when messages panel is focused**

Pass `focusable={activePanel === 'messages'}` to ScrollView:

```tsx
<ScrollView height={messageAreaHeight} autoScroll focusable={activePanel === 'messages'}>
```

When focused, Up/Down arrows scroll the message history instead of navigating input history.

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/tui/ScrollView.tsx src/tui/App.tsx
git commit -m "feat(cli): enable keyboard scroll in messages panel when focused (G08)"
```

---

### Task 13: Add /sidebar toggle slash command

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add /sidebar command**

```typescript
case '/sidebar': {
  // Toggle sidebar visibility (TUI mode only)
  console.log(chalk.dim('  Sidebar toggle: Ctrl+B in TUI mode'));
  return 'handled';
}
```

**Step 2: Commit**

```bash
git add src/commands/chat.ts
git commit -m "feat(cli): add /sidebar command hint"
```

---

### Task 14: Run full test suite and final verification

**Step 1: Run all checks**

Run: `npm run typecheck && npm test && npm run build && npm run lint`
Expected: All pass

**Step 2: Manual verification**

Run: `npm run dev -- chat --tui`
Expected:
- Full-screen TUI with header, messages, input, status bar
- Sidebar visible with session/token/stats info
- Tab switches focus between panels (visible highlight)
- Ctrl+B toggles sidebar
- Up/Down scrolls messages when messages panel focused
- All slash commands work
- Ctrl+C exits cleanly to normal terminal

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(cli): complete Phase 3 — split panes, sidebar, focus, scrolling, keybindings (G03, G05, G07, G08, G31, G32)"
```

---

## Summary

| Task | Gap | What It Does |
|------|-----|-------------|
| 1 | G03 | SplitPane layout component |
| 2 | G05 | Sidebar component with session/token/stats |
| 3 | G07 | FocusContext provider for panel management |
| 4 | G32 | Tab key navigation between panels |
| 5 | G08 | ScrollView component with auto-scroll |
| 6 | G08 | Wire ScrollView into MessageList |
| 7 | G03, G05 | Wire SplitPane + Sidebar into App |
| 8 | G31 | Keybinding configuration system |
| 9 | G31 | Wire keybindings into keyboard hook |
| 10 | G31 | /keybindings slash command |
| 11 | G07 | Visual focus indicators on panels |
| 12 | G08 | Keyboard scroll when messages focused |
| 13 | — | /sidebar toggle command |
| 14 | — | Full test suite verification |

**Total:** 14 tasks, 6 gaps closed (G03, G05, G07, G08, G31, G32)

---

## Full Roadmap Complete

With Phase 3 done, all 33 gaps from the Detailed UX Comparison Table are addressed:

| Phase | Gaps | Status |
|-------|------|--------|
| P1A: Input & Editor | G09-G16, G29, G33 | 10 gaps |
| P1B: Rendering | G17-G21 | 5 gaps |
| P1C: Session & Workflow | G22-G28, G30 | 8 gaps |
| P2: Ink Migration | G01, G02, G04, G06 | 4 gaps |
| P3: Advanced TUI | G03, G05, G07, G08, G31, G32 | 6 gaps |
| **Total** | **G01-G33** | **33/33** |
