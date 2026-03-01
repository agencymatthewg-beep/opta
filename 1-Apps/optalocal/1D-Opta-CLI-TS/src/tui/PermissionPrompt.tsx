/**
 * PermissionPrompt — Ink component for inline tool permission prompts.
 *
 * Renders a bordered yellow card asking the user to approve/deny a tool call.
 * Supports Y/n/a key input and a 30-second auto-deny countdown.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import { TOOL_ICONS, formatPath } from './utils.js';
import { TUI_COLORS } from './palette.js';

/** Default timeout before auto-deny (seconds). */
const AUTO_DENY_TIMEOUT = 30;

export type PermissionDecision = 'allow' | 'deny' | 'always';

export interface PermissionPromptProps {
  toolName: string;
  args: Record<string, unknown>;
  onDecision: (decision: PermissionDecision) => void;
}

/** Render tool-specific context details. */
function ToolContext({ toolName, args }: { toolName: string; args: Record<string, unknown> }) {
  switch (toolName) {
    case 'edit_file': {
      const oldText = String(args['old_text'] ?? args['old_string'] ?? '');
      const newText = String(args['new_text'] ?? args['new_string'] ?? '');
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color={TUI_COLORS.info}>File: {formatPath(args['path'])}</Text>
          {oldText && (
            <Text color={TUI_COLORS.danger}>- {oldText.slice(0, 80)}{oldText.length > 80 ? '...' : ''}</Text>
          )}
          {newText && (
            <Text color={TUI_COLORS.success}>+ {newText.slice(0, 80)}{newText.length > 80 ? '...' : ''}</Text>
          )}
        </Box>
      );
    }

    case 'multi_edit':
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color={TUI_COLORS.info}>File: {formatPath(args['path'])}</Text>
          {Array.isArray(args['edits']) && (
            <Text color={TUI_COLORS.dim}>{(args['edits'] as unknown[]).length} edit(s)</Text>
          )}
        </Box>
      );

    case 'write_file': {
      const content = String(args['content'] ?? '');
      const lineCount = content.split('\n').length;
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.info}>File: {formatPath(args['path'])}</Text>
          <Text color={TUI_COLORS.dim}> ({lineCount} line{lineCount !== 1 ? 's' : ''})</Text>
        </Box>
      );
    }

    case 'delete_file':
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.danger}>File: {formatPath(args['path'])}</Text>
        </Box>
      );

    case 'run_command':
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.warning}>$ {String(args['command'] ?? '')}</Text>
        </Box>
      );

    case 'bg_start':
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.warning}>$ {String(args['command'] ?? '')}</Text>
          {args['name'] != null && <Text color={TUI_COLORS.dim}> (name: {String(args['name'])})</Text>}
        </Box>
      );

    case 'bg_kill':
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.danger}>Kill process: {String(args['id'] ?? args['name'] ?? '')}</Text>
        </Box>
      );

    case 'browser_open': {
      const mode = String(args['mode'] ?? 'isolated');
      const spawnPrompt = args['__opta_spawn_prompt'] === true;
      const reason = typeof args['__opta_spawn_reason'] === 'string'
        ? args['__opta_spawn_reason']
        : null;
      const triggerTool = typeof args['__opta_spawn_trigger_tool'] === 'string'
        ? args['__opta_spawn_trigger_tool']
        : null;
      const scanCountRaw = args['__opta_session_scan_count'];
      const scanCount = typeof scanCountRaw === 'number' && Number.isFinite(scanCountRaw)
        ? scanCountRaw
        : null;
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color={TUI_COLORS.info}>mode: {mode}</Text>
          {spawnPrompt && (
            <Text color={TUI_COLORS.warning}>Spawn Opta Browser session before continuing.</Text>
          )}
          {reason && <Text color={TUI_COLORS.dim}>{reason}</Text>}
          {triggerTool && <Text color={TUI_COLORS.dim}>requested by: {triggerTool}</Text>}
          {scanCount !== null && (
            <Text color={TUI_COLORS.dim}>runtime scan: {scanCount} active session{scanCount === 1 ? '' : 's'}</Text>
          )}
        </Box>
      );
    }

    case 'spawn_agent':
    case 'delegate_task':
      return (
        <Box flexDirection="column" paddingLeft={2}>
          {args['task'] != null && <Text color={TUI_COLORS.dim}>Task: {String(args['task']).slice(0, 80)}</Text>}
          {args['mode'] != null && <Text color={TUI_COLORS.dim}>Mode: {String(args['mode'])}</Text>}
        </Box>
      );

    case 'lsp_rename':
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.info}>{formatPath(args['path'])}</Text>
          {args['newName'] != null && <Text color={TUI_COLORS.dim}> {'\u2192'} {String(args['newName'])}</Text>}
        </Box>
      );

    case 'git_commit':
      return (
        <Box paddingLeft={2}>
          <Text color={TUI_COLORS.dim}>Message: {String(args['message'] ?? '').slice(0, 60)}</Text>
        </Box>
      );

    default: {
      // Generic: show first 3 key-value pairs
      const entries = Object.entries(args).slice(0, 3);
      if (entries.length === 0) return null;
      return (
        <Box flexDirection="column" paddingLeft={2}>
          {entries.map(([k, v]) => (
            <Box key={k}>
              <Text color={TUI_COLORS.dim}>{k}: </Text>
              <Text>{String(v).slice(0, 60)}</Text>
            </Box>
          ))}
        </Box>
      );
    }
  }
}

export function PermissionPrompt({ toolName, args, onDecision }: PermissionPromptProps) {
  const [countdown, setCountdown] = useState(AUTO_DENY_TIMEOUT);
  const decided = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const icon = TOOL_ICONS[toolName] ?? '\u{1F527}';

  const handleDecision = useCallback((decision: PermissionDecision) => {
    if (decided.current) return;
    decided.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    onDecision(decision);
  }, [onDecision]);

  // Countdown timer
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        const next = prev - 1;
        if (next <= 0) {
          handleDecision('deny');
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [handleDecision]);

  // Key input
  useInput((input, key) => {
    if (decided.current) return;

    // y/Y or Enter -> allow
    if (input === 'y' || input === 'Y' || key.return) {
      handleDecision('allow');
      return;
    }

    // n/N -> deny
    if (input === 'n' || input === 'N') {
      handleDecision('deny');
      return;
    }

    // a/A -> always
    if (input === 'a' || input === 'A') {
      handleDecision('always');
      return;
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={TUI_COLORS.warning}
      paddingX={1}
      paddingY={0}
    >
      {/* Header */}
      <Box>
        <Text color={TUI_COLORS.warning} bold>{icon} Permission Required</Text>
      </Box>

      {/* Tool name */}
      <Box paddingLeft={2}>
        <Text bold>{toolName}</Text>
        <Text color={TUI_COLORS.dim}> wants to execute</Text>
      </Box>

      {/* Tool-specific context */}
      <ToolContext toolName={toolName} args={args} />

      {/* Prompt line */}
      <Box marginTop={1}>
        <Text color={TUI_COLORS.warning}>
          [<Text bold>Y</Text>]es / [<Text bold>n</Text>]o / [<Text bold>a</Text>]lways
        </Text>
        <Text color={TUI_COLORS.dim}>  ({countdown}s)</Text>
      </Box>
    </Box>
  );
}
