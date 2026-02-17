import React, { useState, useEffect, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';

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
                <Text>{'█'}</Text>
              ) : (
                <Text dimColor>{'░'}</Text>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
