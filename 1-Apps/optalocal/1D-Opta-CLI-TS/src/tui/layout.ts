/**
 * Centralized layout constants for the Opta CLI TUI.
 *
 * All components must derive dimensions from here — no inline magic numbers
 * or independent terminal-width fallbacks. This is the single source of truth
 * for padding, chrome heights, menu sizing, and message area geometry.
 */

// ---------------------------------------------------------------------------
// Chrome heights (rows consumed by fixed UI regions)
// ---------------------------------------------------------------------------

export const LAYOUT = {
  /** Height of the header bar (title + session ID). */
  headerHeight: 3,
  /** Height of the status bar (model, tokens, connection). */
  statusBarHeight: 3,
  /** Height of the hint bar (keyboard shortcut footer). */
  hintBarHeight: 1,
  /** Height of the input box (prompt + editor). */
  inputBoxHeight: 3,
  /** Height of the browser manager rail (active session indicators). */
  browserRailHeight: 3,
  /** Height of the agent swarm rail (live sub-agent indicators). */
  agentSwarmRailHeight: 3,
  /** Total chrome rows when browser rail is visible. */
  totalChromeWithRail: 13,
  /** Total chrome rows when browser rail is hidden. */
  totalChromeBase: 10,

  // ---------------------------------------------------------------------------
  // Menu dimensions
  // ---------------------------------------------------------------------------

  /**
   * Rows consumed by the info panel section when visible.
   * Used in: visualRows - LAYOUT.menuInfoPanelRows = item viewport height.
   */
  menuInfoPanelRows: 26,
  /**
   * Rows consumed by menu chrome (title, hints, page tabs, header info) when
   * info panel is hidden. Item viewport = visualRows - LAYOUT.menuChromeRows.
   */
  menuChromeRows: 14,
  /** Minimum menu width in columns. */
  menuMinWidth: 70,
  /** Maximum menu width in columns. */
  menuMaxWidth: 120,
  /** Minimum menu height in rows. */
  menuMinHeight: 14,

  // ---------------------------------------------------------------------------
  // Message area
  // ---------------------------------------------------------------------------

  /** Horizontal padding applied on each side of the scroll content area. */
  messagePaddingX: 1,
  /** Columns reserved for the scrollbar. */
  scrollbarReservedColumns: 1,
  /** Extra column offset for the assistant bubble body indent. */
  assistantBubbleBodyOffset: 5,
  /** Smaller offset used in safe/compact assistant body rendering. */
  safeAssistantBodyOffset: 2,
  /** Maximum width for turn separator lines. */
  turnSeparatorMaxWidth: 84,
  /** Minimum width for turn separator lines. */
  turnSeparatorMinWidth: 20,

  /** Maximum width for markdown render to keep text readable on ultra-wide terminals. */
  maxMarkdownRenderWidth: 128,

  // ---------------------------------------------------------------------------
  // Fallback terminal dimensions (used when stdout.columns/rows unavailable)
  // ---------------------------------------------------------------------------

  fallbackColumns: 120,
  fallbackRows: 36,
} as const;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

/**
 * Compute the Opta Menu's target width given terminal columns.
 *
 * @param columns  Current terminal column count.
 * @param maxWidth Optional prop override from parent layout.
 */
export function computeMenuWidth(columns: number, maxWidth?: number): number {
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(LAYOUT.menuMinWidth, Math.min(LAYOUT.menuMaxWidth, columns - 8));
  return Math.min(preferred, hardMax);
}

/**
 * Compute the Opta Menu's target height given terminal rows.
 *
 * @param rows      Current terminal row count.
 * @param maxHeight Optional prop override from parent layout.
 */
export function computeMenuHeight(rows: number, maxHeight?: number): number {
  return Math.max(LAYOUT.menuMinHeight, Math.min(rows, maxHeight ?? rows));
}

export interface MessageLayoutWidths {
  /**
   * Width budget used by ScrollView for line estimation.
   * This includes one reserved scrollbar column so estimation and rendering align.
   */
  scrollContentWidth: number;
  /** Width budget for visible message content area (scrollbar already reserved). */
  messageContentWidth: number;
  assistantBodyWidth: number;
  safeAssistantBodyWidth: number;
}

/**
 * Centralized layout widths so bordered bubbles, streaming rows, and scroll
 * estimation all agree on the same available columns.
 */
export function computeMessageLayoutWidths(terminalWidth: number): MessageLayoutWidths {
  const fullScrollContentWidth = Math.max(terminalWidth - LAYOUT.messagePaddingX * 2, 1);
  const messageContentWidth = Math.max(
    fullScrollContentWidth - LAYOUT.scrollbarReservedColumns,
    1,
  );
  const scrollContentWidth = fullScrollContentWidth;
  const assistantBodyWidth = Math.max(messageContentWidth - LAYOUT.assistantBubbleBodyOffset, 1);
  const safeAssistantBodyWidth = Math.max(messageContentWidth - LAYOUT.safeAssistantBodyOffset, 1);
  return {
    scrollContentWidth,
    messageContentWidth,
    assistantBodyWidth: Math.min(assistantBodyWidth, LAYOUT.maxMarkdownRenderWidth),
    safeAssistantBodyWidth: Math.min(safeAssistantBodyWidth, LAYOUT.maxMarkdownRenderWidth),
  };
}
