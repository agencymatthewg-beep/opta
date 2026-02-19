import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { TOOL_ICONS, formatPath } from './utils.js';

/** Status indicators for tool call states. */
const STATUS = {
  running: { icon: '*', color: 'yellow' as const, label: 'running...' },
  done: { icon: '\u2714', color: 'green' as const, label: '' },
  error: { icon: '\u2718', color: 'red' as const, label: 'error' },
};

/** Max lines shown when the tool result is collapsed. */
const COLLAPSED_LINES = 3;

/** Max characters per line in result preview. */
const MAX_LINE_WIDTH = 80;

// --- Arg formatting helpers ---

export interface ToolCardProps {
  name: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  result?: string;
  collapsed?: boolean;
  compact?: boolean;
}

/**
 * CompactToolItem — minimal single-line tool call display.
 * Used for live activity rendering in the message list.
 */
export function CompactToolItem({ name, status, args }: { name: string; status: 'running' | 'done' | 'error'; args?: Record<string, unknown> }) {
  const icon = TOOL_ICONS[name] ?? '';
  const symbol = status === 'running' ? '↻' : status === 'done' ? '✔' : '✗';
  const color = status === 'running' ? 'cyan' : status === 'done' ? 'green' : 'red';

  // Get the most important argument
  let argStr = '';
  if (args) {
    const path = args['path'] ?? args['file_path'] ?? args['command'] ?? args['pattern'] ?? args['glob'] ?? args['question'];
    if (path) argStr = String(path).slice(0, 50);
  }

  return (
    <Box paddingLeft={2} marginBottom={0}>
      <Text color={color}>{symbol} </Text>
      <Text dimColor>{icon} </Text>
      <Text>{name}</Text>
      {argStr && <Text dimColor> {argStr}</Text>}
    </Box>
  );
}

function countLines(content: unknown): number {
  return String(content ?? '').split('\n').length;
}

/** Renders tool-specific argument summary below the tool name. */
function ToolArgs({ name, args }: { name: string; args: Record<string, unknown> }) {
  switch (name) {
    case 'read_file':
      return (
        <Box paddingLeft={2}>
          <Text color="cyan">{formatPath(args.path)}</Text>
          {(args.offset || args.limit) ? (
            <Text dimColor> lines {String(args.offset ?? 1)}-{Number(args.offset ?? 0) + Number(args.limit ?? 0)}</Text>
          ) : null}
        </Box>
      );

    case 'write_file': {
      const lines = countLines(args.content);
      return (
        <Box paddingLeft={2}>
          <Text color="cyan">{formatPath(args.path)}</Text>
          <Text dimColor> ({lines} line{lines !== 1 ? 's' : ''})</Text>
        </Box>
      );
    }

    case 'edit_file': {
      const oldText = String(args.old_text ?? '');
      const newText = String(args.new_text ?? '');
      const oldLines = oldText ? oldText.split('\n').length : 0;
      const newLines = newText ? newText.split('\n').length : 0;
      return (
        <Box flexDirection="column">
          <Box paddingLeft={2}>
            <Text color="cyan">{formatPath(args.path)}</Text>
          </Box>
          {(oldLines > 0 || newLines > 0) ? (
            <Box paddingLeft={2}>
              <Text color="red">-{oldLines} line{oldLines !== 1 ? 's' : ''}</Text>
              <Text dimColor> {'\u2192'} </Text>
              <Text color="green">+{newLines} line{newLines !== 1 ? 's' : ''}</Text>
            </Box>
          ) : null}
        </Box>
      );
    }

    case 'run_command':
      return (
        <Box paddingLeft={2}>
          <Text color="yellow">$ {String(args.command ?? '')}</Text>
        </Box>
      );

    case 'search_files':
      return (
        <Box flexDirection="column">
          <Box paddingLeft={2}>
            <Text color="yellow">/{String(args.pattern ?? '')}/</Text>
          </Box>
          {args.path ? (
            <Box paddingLeft={2}>
              <Text dimColor>in {String(args.path)}</Text>
            </Box>
          ) : null}
        </Box>
      );

    case 'find_files':
      return (
        <Box paddingLeft={2}>
          <Text color="yellow">{String(args.pattern ?? args.glob ?? '')}</Text>
          {args.path ? <Text dimColor> in {String(args.path)}</Text> : null}
        </Box>
      );

    case 'list_dir':
      return (
        <Box paddingLeft={2}>
          <Text color="cyan">{formatPath(args.path || '.')}</Text>
        </Box>
      );

    case 'ask_user':
      return (
        <Box paddingLeft={2}>
          <Text italic>{String(args.question ?? '').slice(0, 60)}</Text>
        </Box>
      );

    default: {
      // Generic key: value display
      const entries = Object.entries(args).slice(0, 4);
      if (entries.length === 0) return null;
      return (
        <Box flexDirection="column">
          {entries.map(([k, v]) => (
            <Box key={k} paddingLeft={2}>
              <Text dimColor>{k}: </Text>
              <Text>{String(v).slice(0, 50)}</Text>
            </Box>
          ))}
        </Box>
      );
    }
  }
}

/** Renders the tool result, truncated when collapsed. */
function ToolResult({ result, collapsed }: { result: string; collapsed: boolean }) {
  if (!result) return null;

  const lines = result.split('\n');
  const displayLines = collapsed ? lines.slice(0, COLLAPSED_LINES) : lines;
  const truncated = collapsed && lines.length > COLLAPSED_LINES;

  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={0}>
      {displayLines.map((line, i) => (
        <Text key={i} dimColor wrap="truncate">
          {line.slice(0, MAX_LINE_WIDTH)}
        </Text>
      ))}
      {truncated ? (
        <Text dimColor italic>  ... {lines.length - COLLAPSED_LINES} more line{lines.length - COLLAPSED_LINES !== 1 ? 's' : ''}</Text>
      ) : null}
    </Box>
  );
}

/**
 * ToolCard — Rich Ink component for tool call visualization.
 *
 * Replaces the minimal `renderToolMessage` with a bordered card showing
 * tool icon, name, status, formatted arguments, and collapsible results.
 */
export const ToolCard = memo(function ToolCard({
  name,
  status,
  args,
  result,
  collapsed = true,
  compact = false,
}: ToolCardProps) {
  if (compact) {
    return <CompactToolItem name={name} status={status} args={args} />;
  }

  const statusInfo = STATUS[status];
  const icon = TOOL_ICONS[name] ?? '\u{1F527}';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={statusInfo.color}
      paddingX={1}
      marginBottom={0}
      marginLeft={1}
    >
      {/* Header: icon + tool name + status */}
      <Box>
        <Text>{icon} </Text>
        <Text bold>{name}</Text>
        <Text color={statusInfo.color}>
          {' '}{statusInfo.icon} {statusInfo.label}
        </Text>
      </Box>

      {/* Tool-specific arguments */}
      {args && Object.keys(args).length > 0 ? (
        <ToolArgs name={name} args={args} />
      ) : null}

      {/* Result (only when done or error) */}
      {status !== 'running' && result ? (
        <ToolResult result={result} collapsed={collapsed} />
      ) : null}
    </Box>
  );
});
