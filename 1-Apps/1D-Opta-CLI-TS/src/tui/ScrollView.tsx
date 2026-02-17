import React, { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

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
    const marginBottom = (props.marginBottom as number) ?? 0;

    let lines = 0;
    if (inner !== undefined) {
      if (Array.isArray(inner)) {
        for (const c of inner) {
          lines += estimateChildLines(c, availableWidth);
        }
      } else {
        lines += estimateChildLines(inner, availableWidth);
      }
    }

    // Every element is at least 1 line if it has any content
    lines = Math.max(lines, 1);
    lines += marginBottom;
    return lines;
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
  const safeWidth = Math.max(width, 10);
  const lines = text.split('\n');
  let total = 0;
  for (const line of lines) {
    total += Math.max(1, Math.ceil(line.length / safeWidth));
  }
  return total;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScrollView({
  children,
  height,
  autoScroll = true,
  focusable = false,
  contentWidth = 80,
}: ScrollViewProps) {
  const childArray = React.Children.toArray(children);

  // ── Line estimation for each child ──
  // Subtract 1 for the scrollbar column
  const estimationWidth = Math.max(contentWidth - 1, 20);
  const childLineEstimates = childArray.map(c => estimateChildLines(c, estimationWidth));
  const totalLines = childLineEstimates.reduce((sum, n) => sum + n, 0);
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
    visibleItems.push(childArray[i]);
    linesRemaining -= childLineEstimates[i]!;
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
    <Box flexDirection="column">
      <Box flexDirection="row" height={height}>
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
                    <Text>{'█'}</Text>
                  ) : (
                    <Text dimColor>{'░'}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      {showNewLinesIndicator && (
        <Box justifyContent="flex-end" paddingRight={2}>
          <Text color="yellow" bold>{'\u2193'} {newLinesSinceScroll} new line{newLinesSinceScroll !== 1 ? 's' : ''}</Text>
        </Box>
      )}
      {showLineCount && !showNewLinesIndicator && (
        <Box justifyContent="flex-end" paddingRight={2}>
          <Text dimColor>{scrollOffset + height}/{totalLines} lines</Text>
        </Box>
      )}
    </Box>
  );
}

// ─── Exports for testing ──────────────────────────────────────────────────────

export { estimateChildLines, estimateTextLines };
