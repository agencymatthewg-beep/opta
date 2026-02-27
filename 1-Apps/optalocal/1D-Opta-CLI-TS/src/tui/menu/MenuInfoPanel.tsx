import { Box, Text } from 'ink';
import { TUI_COLORS } from '../palette.js';
import type { MenuItem, MenuPage, OptaMenuResultEntry } from './types.js';
import type { ActionEventStatus } from '../activity.js';

function resultStatusColor(status: ActionEventStatus): string {
  if (status === 'ok') return '#10b981';
  if (status === 'error') return '#ef4444';
  if (status === 'running') return '#22d3ee';
  return '#a78bfa';
}

export interface MenuInfoPanelProps {
  selectedItem: MenuItem | undefined;
  pageMeta: MenuPage | undefined;
  showInfoContent: boolean;
  compactLayout: boolean;
  pendingCommand: string | null;
  selectedCommandResult: OptaMenuResultEntry | null;
  selectedResultPreview: string[];
  latestMenuResults: OptaMenuResultEntry[];
}

export function MenuInfoPanel({
  selectedItem,
  pageMeta,
  showInfoContent,
  compactLayout,
  pendingCommand,
  selectedCommandResult,
  selectedResultPreview,
  latestMenuResults,
}: MenuInfoPanelProps) {
  return (
    <Box
      marginTop={1}
      flexDirection="column"
      borderStyle="round"
      borderColor={showInfoContent ? (pageMeta?.color ?? TUI_COLORS.accent) : TUI_COLORS.border}
      paddingX={1}
    >
      {showInfoContent ? (
        <>
          <Text color={pageMeta?.color ?? TUI_COLORS.accent} bold>
            Info: {selectedItem?.infoTitle ?? selectedItem?.label ?? 'Action'}
          </Text>
          <Text>
            {selectedItem?.infoBody ?? selectedItem?.description ?? 'Select an item to see educational guidance.'}
          </Text>
          <Text dimColor>
            {selectedItem?.learnMoreCommand
              ? `Shift+I runs: ${selectedItem.learnMoreCommand}`
              : 'No learn-more command for this item. Use Enter to run the selected action.'}
          </Text>
          {pendingCommand ? (
            <Text color="#22d3ee">Running: {pendingCommand}</Text>
          ) : null}
          {selectedCommandResult ? (
            <Box marginTop={1} flexDirection="column">
              <Text color={resultStatusColor(selectedCommandResult.status)} bold>
                Latest Result: {selectedCommandResult.summary}
              </Text>
              {selectedResultPreview.map((line, idx) => (
                <Text key={`selected-preview-${idx}`} dimColor>{line}</Text>
              ))}
            </Box>
          ) : null}
          {latestMenuResults.length > 0 ? (
            <Box marginTop={1} flexDirection="column">
              <Text color={TUI_COLORS.accentSoft} bold>Recent Scans + Benchmarks</Text>
              {latestMenuResults.map((entry) => (
                <Text key={entry.id} dimColor>
                  <Text color={resultStatusColor(entry.status)}>{entry.status === 'ok' ? '●' : entry.status === 'error' ? '✖' : entry.status === 'running' ? '◔' : '○'}</Text>{' '}
                  {entry.summary}
                </Text>
              ))}
            </Box>
          ) : null}
        </>
      ) : (
        <Text dimColor>
          {compactLayout
            ? 'Compact viewport: info panel auto-collapsed to keep navigation visible.'
            : 'Info panel hidden. Press i or ? to show educational guidance for the selected menu item.'}
        </Text>
      )}
    </Box>
  );
}
