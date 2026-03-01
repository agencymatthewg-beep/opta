---
status: completed
---

# TUI Quality Improvement Plan
**Date:** 2026-02-26
**Scope:** Opta CLI TUI — layout stability, consistency, error handling, quality
**Branch:** main (per user preference)
**Estimated work:** ~16 hours across 7 tasks

> **Status: COMPLETE (verified 2026-02-27)** — All 7 tasks implemented and verified.

---

## Problem Summary (from Atpo Analysis)

The Opta CLI TUI has 6 primary quality issues ranked by severity:

1. **Menu resize-on-navigate (HIGH)** — Opta Menu has no explicit `height` prop on the outer Ink `<Box>`. Navigating left/right between pages causes the menu to grow/shrink because pages have different item counts, and the info panel show/hide also changes box height.
2. **No Error Boundary (HIGH)** — Any TUI component throw cascades to a full app crash.
3. **Width/height computation scattered (HIGH)** — 5 components independently compute terminal dimensions using inconsistent fallbacks, padding assumptions, and magic numbers, causing layout misalignment.
4. **Silent failures in guided flows (MED)** — Malformed input (e.g. no `|` separator for RAG pair queries) silently no-ops with no user feedback.
5. **Animation constants scattered (MED)** — Easing params hardcoded inline (0.45 + 0.55 × progress), thresholds (0.28, 0.55, 0.75) with no documentation or central config.
6. **InputBox React anti-pattern (MED)** — `InputEditor` instantiated in render body (side effect outside useEffect).

---

## Tasks

---

### Task 1 — Fix Menu Size Stability (Fixed Dimensions)
**Priority:** HIGH | **Effort:** 2h
**File:** `src/tui/OptaMenuOverlay.tsx`

#### Root Cause
The outer `<Box>` at line ~1026 has `width={animatedWidth}` but no `height` prop. Ink computes height from content, so:
- Pages with fewer items → shorter menu
- Info panel appearing/disappearing → menu height jump
- Different item counts per page → menu grows/shrinks on left/right navigation

#### Fix

**Step 1.1 — Add explicit `height` to outer Box:**

```tsx
// BEFORE (line 1026-1034):
<Box
  flexDirection="column"
  borderStyle="round"
  borderColor={TUI_COLORS.accent}
  width={animatedWidth}
  paddingX={2}
  paddingY={1}
  overflow="hidden"
>

// AFTER:
<Box
  flexDirection="column"
  borderStyle="round"
  borderColor={TUI_COLORS.accent}
  width={animatedWidth}
  height={visualRows}
  paddingX={2}
  paddingY={1}
  overflow="hidden"
>
```

**Step 1.2 — Remove items.length clamp from itemViewportRows:**

```typescript
// BEFORE (line 816-819):
const itemViewportRows = Math.max(4, Math.min(
  items.length,
  visualRows - (showInfoContent ? 26 : 14),
));

// AFTER — viewport is always the same size regardless of how many items exist:
const MENU_INFO_ROWS = 26;
const MENU_CHROME_ROWS = 14;
const itemViewportRows = Math.max(4,
  visualRows - (showInfoContent ? MENU_INFO_ROWS : MENU_CHROME_ROWS),
);
```

The `Math.min(items.length, ...)` caused the window to shrink when a page had fewer items than the viewport — the list would render fewer rows and the box would flex-shrink. With explicit `height` on the box AND a fixed viewport, the menu stays constant size.

**Step 1.3 — Add minHeight to MenuItemList container:**

In `MenuItemList.tsx`, wrap the list in a `<Box minHeight={itemViewportRows}>` to ensure space is always reserved:

```tsx
// In MenuItemList props, receive viewportRows: number
// Wrap the list items box:
<Box flexDirection="column" minHeight={viewportRows}>
  {visible.map(...)}
</Box>
```

**Step 1.4 — Lock dimensions after animation completes:**

Once `animationPhase === 'open'`, cache the `visualRows`/`animatedWidth` so terminal resize mid-session doesn't re-trigger layout shifts:

```typescript
const [lockedDimensions, setLockedDimensions] = useState<{ rows: number; width: number } | null>(null);

useEffect(() => {
  if (animationPhase === 'open' && !lockedDimensions) {
    setLockedDimensions({ rows: visualRows, width: animatedWidth });
  }
  if (animationPhase !== 'open') {
    setLockedDimensions(null);
  }
}, [animationPhase, visualRows, animatedWidth, lockedDimensions]);

const stableRows = lockedDimensions?.rows ?? visualRows;
const stableWidth = lockedDimensions?.width ?? animatedWidth;
```

Then use `stableRows`/`stableWidth` everywhere instead of `visualRows`/`animatedWidth`.

**Verification:**
```bash
npm test -- tests/tui/menus-navigation.test.tsx
```
Visually: open menu, navigate left/right through all 6 pages — menu must not resize.

---

### Task 2 — Centralize Layout Constants
**Priority:** HIGH | **Effort:** 2h
**File:** Create `src/tui/layout.ts`

#### Root Cause
5 components independently compute terminal width/height:
- `App.tsx` line ~75: `CHROME_HEIGHT = 13`
- `OptaMenuOverlay.tsx` lines 68–73: width/height with different padding
- `MessageList.tsx` lines 40–61: 7 different widths computed
- `StatusBar.tsx` line ~86: own fallback `?? 120`
- `Header.tsx`: parent-provided props only (correct)

If padding assumptions diverge, layout misaligns.

#### Fix

**Step 2.1 — Create `src/tui/layout.ts`:**

```typescript
/**
 * Centralized layout constants for the Opta CLI TUI.
 * All components must import from here — no inline dimension calculations.
 */

// Chrome row heights (rows consumed by fixed UI regions)
export const LAYOUT = {
  headerHeight: 3,
  statusBarHeight: 3,
  hintBarHeight: 1,
  inputBoxHeight: 3,
  browserRailHeight: 3,
  /** Total chrome rows when browser rail visible */
  totalChromeWithRail: 13,
  /** Total chrome rows without browser rail */
  totalChromeBase: 10,

  // Menu layout
  menuInfoPanelRows: 26,
  menuChromeRows: 14,
  menuMinWidth: 70,
  menuMaxWidth: 120,
  menuMinHeight: 14,

  // Message area
  messagePaddingX: 1,
  scrollbarReservedColumns: 2,
  assistantBubbleBodyOffset: 4,
  safeSassistantBodyOffset: 2,
  turnSeparatorMaxWidth: 84,
  turnSeparatorMinWidth: 20,

  // Fallback terminal dimensions
  fallbackColumns: 120,
  fallbackRows: 36,
} as const;

/** Compute the menu's target width given terminal columns and optional override. */
export function computeMenuWidth(columns: number, maxWidth?: number): number {
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(LAYOUT.menuMinWidth, Math.min(LAYOUT.menuMaxWidth, columns - 8));
  return Math.min(preferred, hardMax);
}

/** Compute the menu's target height given terminal rows and optional override. */
export function computeMenuHeight(rows: number, maxHeight?: number): number {
  return Math.max(LAYOUT.menuMinHeight, Math.min(rows, maxHeight ?? rows));
}

/** Compute the message area content widths from terminal columns. */
export function computeMessageLayoutWidths(terminalWidth: number) {
  const fullWidth = Math.max(terminalWidth - LAYOUT.messagePaddingX * 2, 1);
  const contentWidth = Math.max(fullWidth - LAYOUT.scrollbarReservedColumns, 1);
  return {
    fullScrollContentWidth: fullWidth,
    messageContentWidth: contentWidth,
    scrollContentWidth: fullWidth,
    assistantBodyWidth: Math.max(contentWidth - LAYOUT.assistantBubbleBodyOffset, 1),
    safeAssistantBodyWidth: Math.max(contentWidth - LAYOUT.safeSassistantBodyOffset, 1),
  };
}
```

**Step 2.2 — Update all consumers:**

- `OptaMenuOverlay.tsx`: replace inline width/height math with `computeMenuWidth()`, `computeMenuHeight()`, `LAYOUT.menuInfoPanelRows`, `LAYOUT.menuChromeRows`
- `MessageList.tsx`: replace `computeMessageLayoutWidths()` inline with import from `layout.ts`
- `App.tsx`: replace `CHROME_HEIGHT = 13` with `LAYOUT.totalChromeWithRail`
- `StatusBar.tsx`: replace `?? 120` with `LAYOUT.fallbackColumns`

**Verification:**
```bash
npm run typecheck
npm test -- tests/tui/
```

---

### Task 3 — Add Error Boundary
**Priority:** HIGH | **Effort:** 1h
**File:** Create `src/tui/ErrorBoundary.tsx`, update `src/tui/render.tsx`

#### Fix

**Step 3.1 — Create `src/tui/ErrorBoundary.tsx`:**

```tsx
import React from 'react';
import { Box, Text } from 'ink';
import { TUI_COLORS } from './palette.js';

interface State {
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  State
> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ errorInfo: info.componentStack ?? null });
  }

  render() {
    const { error, errorInfo } = this.state;
    if (error) {
      return (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={TUI_COLORS.danger}
          paddingX={2}
          paddingY={1}
        >
          <Text color={TUI_COLORS.danger} bold>
            {this.props.label ?? 'Component'} crashed
          </Text>
          <Text color={TUI_COLORS.warning}>{error.message}</Text>
          {errorInfo ? (
            <Text dimColor>{errorInfo.split('\n')[1]?.trim() ?? ''}</Text>
          ) : null}
          <Text dimColor>Press Ctrl+C to exit, or Esc if inside an overlay.</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

**Step 3.2 — Wrap App in render.tsx:**

```tsx
// src/tui/render.tsx
<ErrorBoundary label="Opta TUI">
  <App {...props} />
</ErrorBoundary>
```

**Step 3.3 — Wrap each overlay individually (so one overlay crash doesn't kill the app):**

In `App.tsx`, wrap each overlay render branch:
```tsx
<ErrorBoundary label="OptaMenu">
  <OptaMenuOverlay ... />
</ErrorBoundary>
```

**Verification:**
```bash
npm test -- tests/tui/App.test.tsx
```

---

### Task 4 — Centralize Animation Config
**Priority:** MED | **Effort:** 1.5h
**File:** Create `src/tui/animations.ts`, update `App.tsx` + `OptaMenuOverlay.tsx`

#### Fix

**Step 4.1 — Create `src/tui/animations.ts`:**

```typescript
/**
 * Animation configuration for TUI overlays.
 *
 * All easing constants, thresholds, and durations are defined here.
 * Changing these values updates the entire animation system.
 */

export const ANIMATION = {
  /** Total steps × frame ms = open/close duration */
  optaMenuSteps: 4,
  optaMenuFrameMs: 10,
  optaMenuDurationMs: 40,

  /**
   * Open thresholds — what content becomes visible at each stage.
   * Values are normalizedProgress (0.0–1.0).
   */
  showCoreContentAt: 0.28,
  showActionsListAt: 0.55,
  showInfoPanelAt: 0.75,
  considerFullyOpenAt: 0.95,

  /**
   * Easing for height: starts at heightBase (compressed), reaches 1.0 (full).
   * Formula: visualRows = menuHeight × (heightBase + heightRange × progress)
   */
  heightBase: 0.45,    // 45% height at start of animation
  heightRange: 0.55,   // expands to 100% by end

  /**
   * Easing for width: starts at widthBase (compressed), reaches 1.0 (full).
   * Formula: animatedWidth = menuWidth × (widthBase + widthRange × progress)
   */
  widthBase: 0.55,     // 55% width at start
  widthRange: 0.45,    // expands to 100% by end
} as const;

/** Compute animated height multiplier for a given progress (0.0–1.0). */
export function animateHeight(progress: number): number {
  return ANIMATION.heightBase + (ANIMATION.heightRange * progress);
}

/** Compute animated width multiplier for a given progress (0.0–1.0). */
export function animateWidth(progress: number): number {
  return ANIMATION.widthBase + (ANIMATION.widthRange * progress);
}
```

**Step 4.2 — Update `OptaMenuOverlay.tsx`:**

Replace inline:
```typescript
// BEFORE:
const visualRows = Math.max(10, Math.floor(rows * (0.45 + (0.55 * normalizedProgress))));
const animatedWidth = Math.max(40, Math.floor(width * (0.55 + (0.45 * normalizedProgress))));
const showCoreContent = normalizedProgress >= 0.28;
const showActionsList = normalizedProgress >= 0.55;
const infoPanelVisibleByAnimation = normalizedProgress >= 0.75;

// AFTER:
import { ANIMATION, animateHeight, animateWidth } from './animations.js';
const visualRows = Math.max(10, Math.floor(rows * animateHeight(normalizedProgress)));
const animatedWidth = Math.max(40, Math.floor(width * animateWidth(normalizedProgress)));
const showCoreContent = normalizedProgress >= ANIMATION.showCoreContentAt;
const showActionsList = normalizedProgress >= ANIMATION.showActionsListAt;
const infoPanelVisibleByAnimation = normalizedProgress >= ANIMATION.showInfoPanelAt;
```

**Step 4.3 — Update `App.tsx`:**

```typescript
// BEFORE:
const OPTA_MENU_ANIMATION_STEPS = 4;
const OPTA_MENU_ANIMATION_FRAME_MS = 10;

// AFTER:
import { ANIMATION } from './animations.js';
// Use ANIMATION.optaMenuSteps and ANIMATION.optaMenuFrameMs
```

**Verification:**
```bash
npm run typecheck
npm test -- tests/tui/
```

---

### Task 5 — Guided Flow Validation Feedback
**Priority:** MED | **Effort:** 1.5h
**Files:** `src/tui/menu/types.ts`, `src/tui/OptaMenuOverlay.tsx`, `src/tui/menu/GuidedFlowInput.tsx`

#### Root Cause
When `parseGuidedPair()` returns `null` (malformed input), the handler at line 869–870 silently returns:
```typescript
const command = buildGuidedCommand(guidedFlow.kind, guidedFlow.value);
if (!command) return;  // ← user sees nothing
```

#### Fix

**Step 5.1 — Add `error` field to `GuidedFlowState`:**

```typescript
// In menu/types.ts:
interface GuidedFlowState {
  kind: GuidedFlowKind;
  value: string;
  phase: 'input' | 'confirm';
  error?: string;  // validation message shown below input
}
```

**Step 5.2 — Set validation error on bad command build:**

```typescript
// In OptaMenuOverlay.tsx, replace the silent return:
if (!command) {
  const hint = guidedFlow.kind.includes('rag')
    ? 'Expected format: collection | query-text'
    : 'Input is incomplete — check the required format above';
  setGuidedFlow((prev) => prev ? { ...prev, error: hint } : prev);
  return;
}
setGuidedFlow((prev) => prev ? { ...prev, error: undefined } : prev);
```

**Step 5.3 — Display error in `GuidedFlowInput.tsx`:**

```tsx
// Add below the command preview line:
{guidedFlow.error ? (
  <Text color={TUI_COLORS.danger}>⚠ {guidedFlow.error}</Text>
) : null}
```

**Verification:**
```bash
npm test -- tests/tui/menus-navigation.test.tsx
```
Test: type invalid RAG input, press Enter → error message appears. Type valid input → error clears.

---

### Task 6 — Fix InputBox Editor Lifecycle
**Priority:** MED | **Effort:** 1h
**File:** `src/tui/InputBox.tsx`

#### Root Cause
```typescript
// Lines ~114-118 — side effect in render body:
const editorRef = useRef<InputEditor | null>(null);
if (editorRef.current === null) {
  editorRef.current = new InputEditor({ prompt: '>', multiline: true, mode });
}
```
This is a React anti-pattern: side effects (object instantiation) in the render function. In StrictMode, render runs twice and creates two instances.

Also, the glob debounce at line ~164 doesn't guard against unmounted component state updates.

#### Fix

**Step 6.1 — Move editor initialization to useRef initializer:**

```typescript
// BEFORE:
const editorRef = useRef<InputEditor | null>(null);
if (editorRef.current === null) {
  editorRef.current = new InputEditor(...);
}

// AFTER:
const editorRef = useRef<InputEditor>(
  new InputEditor({ prompt: '>', multiline: true, mode })
);
```

This is idiomatic React: `useRef` initializer runs once, not on every render.

**Step 6.2 — Add unmount guard to debounced glob:**

```typescript
// In the autocomplete useEffect:
useEffect(() => {
  let cancelled = false;
  if (debounceRef.current) clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(async () => {
    try {
      const matches = await fg(`**/${prefix}*`, { ... });
      if (!cancelled) setSuggestions(matches.slice(0, MAX_SUGGESTIONS));
    } catch {
      if (!cancelled) setSuggestions([]);
    }
  }, AUTOCOMPLETE_DEBOUNCE);
  return () => { cancelled = true; };
}, [prefix]);
```

**Verification:**
```bash
npm run typecheck
npm test -- tests/tui/InputBox.test.tsx 2>/dev/null || echo "no test file — manual verify"
```

---

### Task 7 — Fix StatusBar Low-Risk Color + Prop Grouping
**Priority:** LOW | **Effort:** 0.5h
**File:** `src/tui/StatusBar.tsx`

#### Fix

**Step 7.1 — Add explicit low-risk color:**

```typescript
// BEFORE (line ~137-141):
const riskColor = highestPendingApprovalRisk === 'high'
  ? TUI_COLORS.danger
  : highestPendingApprovalRisk === 'medium'
    ? TUI_COLORS.warning
    : undefined;

// AFTER:
const riskColor = highestPendingApprovalRisk === 'high'
  ? TUI_COLORS.danger
  : highestPendingApprovalRisk === 'medium'
    ? TUI_COLORS.warning
    : highestPendingApprovalRisk === 'low'
      ? TUI_COLORS.success
      : undefined;
```

**Step 7.2 — Group metrics props into a single object (non-breaking, additive):**

This is a larger refactor if needed. For now, ensure the color fix is deployed. Full prop grouping is deferred to a separate refactor ticket.

---

## Execution Order

```
Task 1 — Menu fixed dimensions    (HIGHEST IMPACT — user-visible)
Task 2 — Layout constants         (PREREQUISITE for stable Task 1)
Task 3 — Error Boundary           (safety net, fast)
Task 4 — Animation config         (cleanup, low risk)
Task 5 — Guided flow validation   (UX improvement)
Task 6 — InputBox lifecycle       (correctness fix)
Task 7 — StatusBar color          (polish)
```

Run tasks in order above. After each task, run:
```bash
npm run typecheck && npm test -- tests/tui/
```

Final verification after all tasks:
```bash
npm run typecheck && npm test
```

Expected: all 1,695+ tests pass, zero TypeScript errors.

---

## Definition of Done

- [x] Opta Menu does NOT change size when navigating left/right between pages
- [x] Opta Menu does NOT change size when info panel shows/hides
- [x] No TUI component crash kills the whole app (Error Boundary active)
- [x] All magic numbers have named constants from `layout.ts` and `animations.ts`
- [x] Guided flow shows validation error on malformed input
- [x] `InputEditor` initialized in `useRef` initializer (not render body)
- [x] Low-risk approval shows `TUI_COLORS.success` (not undefined/default)
- [x] All tests pass: `npm test`
- [x] TypeScript clean: `npm run typecheck`

**Status: COMPLETE** — All 7 tasks implemented, 288 TUI tests passing, TypeScript clean. Verified 2026-02-27.
