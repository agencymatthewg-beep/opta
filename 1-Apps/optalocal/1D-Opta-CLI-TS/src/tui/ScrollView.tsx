import React, { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';
import { sanitizeTerminalText } from '../utils/text.js';
import { estimateWrappedLines } from '../utils/terminal-layout.js';
import { TUI_COLORS } from './palette.js';

export function computeEstimationWidth(contentWidth: number): number {
  return Math.max(contentWidth - 1, 1);
}

/**
 * Estimate the number of terminal lines a React child will occupy.
 *
 * Ink does not expose actual rendered heights, so we walk the React element tree
 * and accumulate text content, then divide by the available width. This is
 * intentionally approximate — an estimate that accounts for text wrapping is
 * far more useful than the previous "1 item = 1 line" approach.
 */
function estimateChildLines(child: ReactNode, availableWidth: number): number {
  if (child == null || typeof child === 'boolean') return 0;

  // Plain string / number
  if (typeof child === 'string' || typeof child === 'number') {
    const text = String(child);
    return estimateTextLines(text, availableWidth);
  }

  // React element — recurse into children and sum up
  if (React.isValidElement(child)) {
    const props = child.props as Record<string, unknown>;
    const inner = props.children as ReactNode | undefined;
    const textProp = typeof props.text === 'string' ? props.text : undefined;
    const estimatedTextProp = typeof props.estimatedText === 'string' ? props.estimatedText : undefined;
    const estimatedLinesProp = typeof props.estimatedLines === 'number' && Number.isFinite(props.estimatedLines)
      ? Math.max(0, Math.floor(props.estimatedLines))
      : undefined;
    const widthProp = typeof props.width === 'number' && Number.isFinite(props.width)
      ? Math.max(1, Math.floor(props.width))
      : undefined;
    const toNum = (v: unknown): number => typeof v === 'number' ? v : 0;

    const marginTop = toNum(props.marginTop) + toNum(props.marginY) + toNum(props.margin);
    const marginBottom = toNum(props.marginBottom) + toNum(props.marginY) + toNum(props.margin);
    const paddingTop = toNum(props.paddingTop) + toNum(props.paddingY) + toNum(props.padding);
    const paddingBottom = toNum(props.paddingBottom) + toNum(props.paddingY) + toNum(props.padding);
    const paddingLeft = toNum(props.paddingLeft) + toNum(props.paddingX) + toNum(props.padding);
    const paddingRight = toNum(props.paddingRight) + toNum(props.paddingX) + toNum(props.padding);

    const hasBorder = !!props.borderStyle;
    const borderRows = hasBorder ? 2 : 0;
    const borderCols = hasBorder ? 2 : 0;
    const flexDirection = props.flexDirection === 'row' ? 'row' : 'column';
    const innerWidth = Math.max(availableWidth - borderCols - paddingLeft - paddingRight, 1);

    let childLines = estimatedLinesProp ?? 0;
    if (inner !== undefined) {
      if (Array.isArray(inner)) {
        const measured = inner.map(c => estimateChildLines(c, innerWidth));
        childLines = flexDirection === 'row'
          ? measured.reduce((mx, n) => Math.max(mx, n), 0)
          : measured.reduce((sum, n) => sum + n, 0);
      } else {
        childLines = estimateChildLines(inner, innerWidth);
      }
    } else if (estimatedLinesProp === undefined && (estimatedTextProp !== undefined || textProp !== undefined)) {
      childLines = estimateTextLines(
        estimatedTextProp ?? textProp ?? '',
        Math.min(widthProp ?? innerWidth, innerWidth),
      );
    }

    const hasOwnContent =
      (inner !== undefined && inner !== null && inner !== false) ||
      textProp !== undefined || estimatedTextProp !== undefined;
    const baseContentRows = hasOwnContent ? Math.max(childLines, 1) : 0;

    return (
      baseContentRows +
      paddingTop +
      paddingBottom +
      marginTop +
      marginBottom +
      borderRows
    );
  }

  // Array of children
  if (Array.isArray(child)) {
    let total = 0;
    for (const c of child) {
      total += estimateChildLines(c, availableWidth);
    }
    return total;
  }

  return 1; // Fallback
}

/** Estimate terminal lines from a text string, accounting for newlines and wrapping. */
function estimateTextLines(text: string, width: number): number {
  if (!text) return 0;
  return estimateWrappedLines(sanitizeTerminalText(text), Math.max(width, 1));
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Imperative handle exposed to parent via scrollRef. */
export interface ScrollViewHandle {
  scrollToBottom: () => void;
  scrollBy: (delta: number) => void;
}

interface ScrollViewProps {
  children: ReactNode;
  /** Viewport height in terminal rows. */
  height: number;
  /** When true, stay pinned to the bottom as new content arrives. */
  autoScroll?: boolean;
  /** Whether this ScrollView accepts keyboard input. */
  focusable?: boolean;
  /** Available content width (for line estimation). Defaults to 80. */
  contentWidth?: number;
  /** Optional ref for imperative scroll control from parent components. */
  scrollRef?: React.MutableRefObject<ScrollViewHandle | null>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScrollView({
  children,
  height,
  autoScroll = true,
  focusable = false,
  contentWidth = 80,
  scrollRef,
}: ScrollViewProps) {
  // ── Line estimation for each child ──
  // Subtract 1 for the scrollbar column
  const estimationWidth = computeEstimationWidth(contentWidth);
  const childArray = useMemo(() => React.Children.toArray(children), [children]);
  const childLineEstimates = useMemo(
    () => childArray.map((c) => estimateChildLines(c, estimationWidth)),
    [childArray, estimationWidth],
  );
  const totalLines = useMemo(
    () => childLineEstimates.reduce((sum, n) => sum + n, 0),
    [childLineEstimates],
  );
  const maxOffset = Math.max(0, totalLines - height);

  // ── Scroll state ──
  // Internal offset tracks where the user has scrolled to manually.
  // When auto-scroll is active, we override this with maxOffset below.
  const [internalOffset, setInternalOffset] = useState(0);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [newLinesSinceScroll, setNewLinesSinceScroll] = useState(0);
  const prevTotalLines = useRef(totalLines);

  // Derive the effective scroll offset synchronously during render.
  // This avoids the async useEffect gap that causes the initial render
  // to show offset 0 before the effect fires.
  const scrollOffset = (autoScroll && !userScrolledUp) ? maxOffset : Math.min(internalOffset, maxOffset);

  // Clamp helper (stable reference)
  const clamp = useCallback((v: number) => Math.max(0, Math.min(maxOffset, v)), [maxOffset]);

  // ── Track new lines while scrolled up ──
  useEffect(() => {
    const addedLines = totalLines - prevTotalLines.current;
    prevTotalLines.current = totalLines;

    if (autoScroll && !userScrolledUp) {
      // Keep internal offset synced to bottom
      setInternalOffset(maxOffset);
      setNewLinesSinceScroll(0);
    } else if (userScrolledUp && addedLines > 0) {
      // Track how many new lines have appeared while user is scrolled up
      setNewLinesSinceScroll(prev => prev + addedLines);
    }
  }, [totalLines, maxOffset, autoScroll, userScrolledUp]);

  // ── Scroll actions ──
  const scrollBy = useCallback((delta: number) => {
    setInternalOffset(prev => {
      const next = clamp(prev + delta);
      if (delta < 0) {
        // Scrolled up
        setUserScrolledUp(true);
      }
      if (next >= maxOffset) {
        // Reached bottom — re-enable auto-scroll
        setUserScrolledUp(false);
        setNewLinesSinceScroll(0);
      }
      return next;
    });
  }, [clamp, maxOffset]);

  const scrollToTop = useCallback(() => {
    setInternalOffset(0);
    setUserScrolledUp(true);
  }, []);

  const scrollToBottom = useCallback(() => {
    setInternalOffset(maxOffset);
    setUserScrolledUp(false);
    setNewLinesSinceScroll(0);
  }, [maxOffset]);

  // Expose imperative scroll handle to parent via scrollRef
  useEffect(() => {
    if (!scrollRef) return;
    scrollRef.current = { scrollToBottom, scrollBy };
    return () => { scrollRef.current = null; };
  }, [scrollRef, scrollToBottom, scrollBy]);

  // ── Keyboard handler ──
  useInput((input, key) => {
    if (!focusable) return;

    if (key.upArrow) {
      scrollBy(-1);
    }
    if (key.downArrow) {
      scrollBy(1);
    }
    if (key.pageUp) {
      scrollBy(-height);
    }
    if (key.pageDown) {
      scrollBy(height);
    }

    // Ctrl+D — half page down
    if (input === 'd' && key.ctrl) {
      scrollBy(Math.floor(height / 2));
    }
    // Ctrl+U — half page up
    if (input === 'u' && key.ctrl) {
      scrollBy(-Math.floor(height / 2));
    }

    // g — scroll to top (lowercase, no modifiers)
    if (input === 'g' && !key.ctrl && !key.meta && !key.shift) {
      scrollToTop();
    }
    // G — scroll to bottom (uppercase = shift+g)
    if (input === 'G' && !key.ctrl && !key.meta) {
      scrollToBottom();
    }
    // End / Ctrl+J — jump to latest output
    if ((key as Record<string, unknown>).end || (input === 'j' && key.ctrl)) {
      scrollToBottom();
    }
  });

  // ── Determine visible items based on accumulated line counts ──
  let accumulated = 0;
  let firstVisibleIdx = 0;
  // Find the first child whose cumulative lines surpass scrollOffset
  for (let i = 0; i < childLineEstimates.length; i++) {
    const lines = childLineEstimates[i]!;
    if (accumulated + lines > scrollOffset) {
      firstVisibleIdx = i;
      break;
    }
    accumulated += lines;
    // If we exhaust all children, first visible is the last one
    if (i === childLineEstimates.length - 1) {
      firstVisibleIdx = i;
    }
  }

  // Collect children that fit in the viewport.
  // Ink cannot clip partial children, so we render whole items that fall
  // within the viewport range. The line-based offset still drives the
  // scrollbar position and overall accuracy.
  const visibleItems: ReactNode[] = [];
  let linesRemaining = height;
  for (let i = firstVisibleIdx; i < childArray.length && linesRemaining > 0; i++) {
    const lines = childLineEstimates[i]!;
    // Avoid rendering a trailing item that cannot fully fit. Partial clipping
    // of bordered cards causes broken borders/artifacts in the viewport.
    if (visibleItems.length > 0 && lines > linesRemaining) {
      break;
    }
    visibleItems.push(childArray[i]);
    linesRemaining -= lines;
  }

  // ── Proportional scrollbar ──
  const showScrollbar = totalLines > height;
  const thumbSize = showScrollbar
    ? Math.max(1, Math.round((height / totalLines) * height))
    : 0;
  const thumbPos = maxOffset > 0
    ? Math.round((scrollOffset / maxOffset) * (height - thumbSize))
    : 0;

  // Show "new lines" indicator when scrolled up and new content arrives
  const showNewLinesIndicator = userScrolledUp && newLinesSinceScroll > 0;
  // Show total line count at bottom when scrolled up
  const showLineCount = userScrolledUp && totalLines > height;

  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="row" height={height} width="100%">
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {visibleItems}
        </Box>
        {showScrollbar && (
          <Box flexDirection="column" width={1}>
            {Array.from({ length: height }, (_, i) => {
              const isThumb = i >= thumbPos && i < thumbPos + thumbSize;
              return (
                <Box key={i}>
                  {isThumb ? (
                    <Text color={TUI_COLORS.accentSoft}>{'┃'}</Text>
                  ) : (
                    <Text color={TUI_COLORS.dim}>{'│'}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      {showNewLinesIndicator && (
        <Box justifyContent="flex-end" paddingRight={2}>
          <Text color={TUI_COLORS.warning} bold>{'\u2193'} {newLinesSinceScroll} new line{newLinesSinceScroll !== 1 ? 's' : ''}</Text>
          <Text color={TUI_COLORS.dim}>  (End/Ctrl+J to jump)</Text>
        </Box>
      )}
      {showLineCount && !showNewLinesIndicator && (
        <Box justifyContent="flex-end" paddingRight={2}>
          <Text color={TUI_COLORS.dim}>{scrollOffset + height}/{totalLines} lines</Text>
        </Box>
      )}
    </Box>
  );
}

// ─── Exports for testing ──────────────────────────────────────────────────────

export { estimateChildLines, estimateTextLines };
