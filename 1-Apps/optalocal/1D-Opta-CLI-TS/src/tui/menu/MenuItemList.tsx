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
            <Text color={active ? TUI_COLORS.accentSoft : undefined}>{active ? '▶ ' : '  '}</Text>
            <Text color={active ? (item.color ?? TUI_COLORS.accentSoft) : undefined} bold={active}>
              {item.label}
            </Text>
            {recommended ? <Text color="#f59e0b"> (recommended)</Text> : null}
            {pendingCommand && item.command === pendingCommand ? (
              <Text color="#22d3ee"> (running)</Text>
            ) : null}
            <Text color={active ? '#38bdf8' : '#0ea5e9'}> [i]</Text>
            {item.learnMoreCommand ? <Text color={active ? '#f59e0b' : '#d97706'}> [I]</Text> : null}
            <Text dimColor>  {item.description}</Text>
          </Box>
        );
      })}

      {itemWindow.end < items.length ? (
        <Text dimColor>… {items.length - itemWindow.end} actions below …</Text>
      ) : null}
    </Box>
  );
}
