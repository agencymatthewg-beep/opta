import { Box, Text } from 'ink';
import { TUI_COLORS } from '../palette.js';
import type { MenuItem, MenuPageId } from './types.js';

export interface MenuItemListProps {
  items: MenuItem[];
  selectedPage: MenuPageId;
  selectedIndex: number;
  pendingCommand: string | null;
  itemWindow: { start: number; end: number };
  transitionGlyph: string;
  showActionsList: boolean;
  viewportRows: number;
}

export function MenuItemList({
  items,
  selectedPage,
  selectedIndex,
  pendingCommand,
  itemWindow,
  transitionGlyph,
  showActionsList,
  viewportRows,
}: MenuItemListProps) {
  if (!showActionsList) {
    return (
      <Box marginTop={1}>
        <Text dimColor>{transitionGlyph} Loading actions list...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" minHeight={viewportRows}>
      {itemWindow.start > 0 ? (
        <Text dimColor>… {itemWindow.start} actions above …</Text>
      ) : null}

      {items.slice(itemWindow.start, itemWindow.end).map((item, idx) => {
        const absolute = itemWindow.start + idx;
        const active = absolute === selectedIndex;
        const recommended = item.recommended === true;
        return (
          <Box key={`${selectedPage}:${absolute}:${item.action}:${item.command ?? item.label}`}>
            <Box width={3}>
              <Text color={active ? '#ffffff' : TUI_COLORS.dim}>{active ? ' ▶ ' : '   '}</Text>
            </Box>
            <Box width={26}>
              <Text color={active ? '#ffffff' : TUI_COLORS.dim} bold={active}>
                {item.label}
              </Text>
            </Box>
            <Box flexGrow={1}>
              <Text color={active ? '#d1d5db' : TUI_COLORS.borderSoft}>│ </Text>
              <Text color={active ? '#e5e7eb' : TUI_COLORS.dim}>{item.description}</Text>
              {recommended ? <Text color={active ? '#f59e0b' : '#d97706'}> (recommended)</Text> : null}
              {pendingCommand && item.command === pendingCommand ? (
                <Text color="#22d3ee"> (running)</Text>
              ) : null}
            </Box>
          </Box>
        );
      })}

      {itemWindow.end < items.length ? (
        <Text dimColor>… {items.length - itemWindow.end} actions below …</Text>
      ) : null}
    </Box>
  );
}
