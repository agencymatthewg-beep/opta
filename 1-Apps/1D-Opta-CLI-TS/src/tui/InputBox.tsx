import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { InputEditor } from '../ui/input.js';
import { InputHistory } from '../ui/history.js';
import fg from 'fast-glob';
import { DEFAULT_IGNORE_GLOBS } from '../utils/ignore.js';
import { isImagePath } from '../core/fileref.js';
import { getAllCommands } from '../commands/slash/index.js';
import type { SlashCommandDef } from '../commands/slash/index.js';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  mode: 'normal' | 'plan' | 'shell' | 'auto';
  isLoading?: boolean;
  history?: InputHistory;
  /** Label shown when loading (e.g. "running edit_file" instead of "thinking"). */
  loadingLabel?: string;
  workflowMode?: 'normal' | 'plan' | 'research' | 'review';
  bypassPermissions?: boolean;
}

/** Debounce interval for @file glob searches (ms). */
const AUTOCOMPLETE_DEBOUNCE = 200;

/** Maximum number of file suggestions to display. */
const MAX_SUGGESTIONS = 5;

/** Maximum number of slash command suggestions to display. */
const MAX_SLASH_SUGGESTIONS = 8;

/** All slash commands (loaded once). */
let cachedSlashCommands: SlashCommandDef[] | null = null;
function getSlashCommands(): SlashCommandDef[] {
  if (!cachedSlashCommands) {
    cachedSlashCommands = getAllCommands();
  }
  return cachedSlashCommands;
}

/**
 * Match slash commands by prefix. Input should be the partial command
 * WITHOUT the leading slash (e.g. 'he' matches 'help', 'history').
 * Returns matching commands sorted by command name.
 */
function matchSlashCommands(partial: string): SlashCommandDef[] {
  const commands = getSlashCommands();
  const lower = partial.toLowerCase();

  if (!lower) {
    // Show all commands when just "/" is typed
    return commands.slice(0, MAX_SLASH_SUGGESTIONS);
  }

  return commands
    .filter(cmd => {
      if (cmd.command.startsWith(lower)) return true;
      return cmd.aliases?.some(a => a.startsWith(lower)) ?? false;
    })
    .slice(0, MAX_SLASH_SUGGESTIONS);
}

/**
 * Extract the @-prefixed partial path from the buffer at the cursor position.
 * Returns null if the cursor is not on an @-reference.
 */
function extractAtPrefix(buffer: string, cursor: number): string | null {
  // Walk backwards from cursor to find @
  let i = cursor - 1;
  while (i >= 0) {
    const ch = buffer[i];
    if (ch === '@') {
      const prefix = buffer.slice(i + 1, cursor);
      // Only trigger if there's no space before @ (start of word)
      if (i === 0 || /\s/.test(buffer[i - 1] ?? '')) {
        return prefix.length > 0 ? prefix : null;
      }
      return null;
    }
    // Stop at whitespace — the @ must be in the current word
    if (/\s/.test(ch ?? '')) return null;
    i--;
  }
  return null;
}

export function InputBox({ onSubmit, mode, isLoading, history: historyProp, loadingLabel, workflowMode, bypassPermissions }: InputBoxProps) {
  const editor = useMemo(() => new InputEditor({ prompt: '>', multiline: true, mode }), []);
  const history = useMemo(() => historyProp ?? new InputHistory(), [historyProp]);

  // Force re-render on every keystroke
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(t => t + 1), []);

  // Track whether we're navigating history (to know when to call startNavigation)
  const navigatingHistory = useRef(false);

  // @file autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slash command autocomplete state
  const [slashSuggestions, setSlashSuggestions] = useState<SlashCommandDef[]>([]);

  // Keep editor mode in sync with prop
  useEffect(() => {
    editor.setMode(mode);
  }, [mode, editor]);

  // Update slash command suggestions (synchronous — no debounce needed)
  const updateSlashSuggestions = useCallback((buffer: string) => {
    // Only show slash suggestions when: buffer starts with `/`, is a single word (no spaces after command)
    if (buffer.startsWith('/') && !buffer.includes(' ')) {
      const partial = buffer.slice(1); // Remove leading /
      const matches = matchSlashCommands(partial);
      setSlashSuggestions(matches);
    } else {
      setSlashSuggestions([]);
    }
  }, []);

  // Debounced @file search
  const updateSuggestions = useCallback((buffer: string, cursor: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const prefix = extractAtPrefix(buffer, cursor);
    if (!prefix) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await fg(`**/${prefix}*`, {
          cwd: process.cwd(),
          onlyFiles: true,
          ignore: [...DEFAULT_IGNORE_GLOBS],
          deep: 5,
        });
        setSuggestions(matches.slice(0, MAX_SUGGESTIONS));
      } catch {
        setSuggestions([]);
      }
    }, AUTOCOMPLETE_DEBOUNCE);
  }, []);

  useInput((input, key) => {
    if (isLoading) return;

    // Meta+Return (Alt+Enter) — insert newline
    // Detection: either ink parses it as meta+return, or the terminal sends \x1B\r
    // as a combined chunk where parseKeypress yields input='\r' with return=false.
    if ((key.return && key.meta) || (input === '\r' && !key.return)) {
      editor.insertNewline();
      navigatingHistory.current = false;
      rerender();
      const buf = editor.getBuffer();
      updateSuggestions(buf, editor.getCursor());
      updateSlashSuggestions(buf);
      return;
    }

    // Return — submit
    if (key.return) {
      const text = editor.getSubmitText();
      if (!text.trim()) return;
      history.push(text);
      onSubmit(text);
      editor.clear();
      navigatingHistory.current = false;
      setSuggestions([]);
      setSlashSuggestions([]);
      rerender();
      return;
    }

    // Escape — clear buffer
    if (key.escape) {
      editor.handleEscape();
      navigatingHistory.current = false;
      setSuggestions([]);
      setSlashSuggestions([]);
      rerender();
      return;
    }

    // Tab — accept first slash command or @file suggestion
    if (key.tab) {
      // Slash command completion takes priority
      if (slashSuggestions.length > 0) {
        const cmd = `/${slashSuggestions[0]!.command} `;
        editor.setBuffer(cmd);
        setSlashSuggestions([]);
        setSuggestions([]);
        rerender();
        return;
      }

      // @file completion
      if (suggestions.length > 0) {
        const buffer = editor.getBuffer();
        const cursor = editor.getCursor();
        const prefix = extractAtPrefix(buffer, cursor);
        if (prefix !== null) {
          // Find the @ position
          let atPos = cursor - 1;
          while (atPos >= 0 && buffer[atPos] !== '@') atPos--;
          // Replace @prefix with @suggestion
          const replacement = `@${suggestions[0]}`;
          const newBuffer = buffer.slice(0, atPos) + replacement + buffer.slice(cursor);
          editor.setBuffer(newBuffer);
          // Place cursor after the replacement (not at end of full buffer)
          // setBuffer puts cursor at end, but we need it after the replacement
          const newCursorPos = atPos + replacement.length;
          editor.setBuffer(newBuffer.slice(0, newCursorPos) + newBuffer.slice(newCursorPos));
          setSuggestions([]);
          rerender();
          return;
        }
      }
    }

    // Up arrow — history previous
    if (key.upArrow) {
      if (!navigatingHistory.current) {
        history.startNavigation();
        navigatingHistory.current = true;
      }
      const prev = history.previous();
      editor.setBuffer(prev);
      setSuggestions([]);
      setSlashSuggestions([]);
      rerender();
      return;
    }

    // Down arrow — history next
    if (key.downArrow) {
      if (navigatingHistory.current) {
        const next = history.next();
        editor.setBuffer(next);
        setSuggestions([]);
        setSlashSuggestions([]);
        rerender();
        return;
      }
    }

    // Backspace — delete char before cursor
    if (key.backspace || key.delete) {
      editor.deleteBackward();
      navigatingHistory.current = false;
      rerender();
      const buf = editor.getBuffer();
      updateSuggestions(buf, editor.getCursor());
      updateSlashSuggestions(buf);
      return;
    }

    // Left arrow — move cursor left
    if (key.leftArrow) {
      editor.moveLeft();
      rerender();
      return;
    }

    // Right arrow — move cursor right
    if (key.rightArrow) {
      editor.moveRight();
      rerender();
      return;
    }

    // Ctrl+A / Home — move to start of line
    if (input === 'a' && key.ctrl) {
      editor.moveToStart();
      rerender();
      return;
    }

    // Ctrl+E / End — move to end of line
    if (input === 'e' && key.ctrl) {
      editor.moveToEnd();
      rerender();
      return;
    }

    // Ctrl+D — delete forward
    if (input === 'd' && key.ctrl) {
      editor.deleteForward();
      navigatingHistory.current = false;
      rerender();
      const buf = editor.getBuffer();
      updateSuggestions(buf, editor.getCursor());
      updateSlashSuggestions(buf);
      return;
    }

    // Ctrl+U — clear line
    if (input === 'u' && key.ctrl) {
      editor.clear();
      navigatingHistory.current = false;
      setSuggestions([]);
      setSlashSuggestions([]);
      rerender();
      return;
    }

    // Regular character input (ignore control sequences)
    if (input && !key.ctrl && !key.meta) {
      editor.insertText(input);
      navigatingHistory.current = false;
      rerender();
      const buf = editor.getBuffer();
      updateSuggestions(buf, editor.getCursor());
      updateSlashSuggestions(buf);
      return;
    }
  }, { isActive: !isLoading });

  // Build the displayed text with cursor
  const buffer = editor.getBuffer();
  const cursor = editor.getCursor();
  const lineCount = editor.getLineCount();

  const modeDisplay = (() => {
    // Bypass indicator takes visual priority — red ! prefix
    const bypassIndicator = bypassPermissions ? (
      <Text color="red" bold>! </Text>
    ) : null;

    const wfMode = workflowMode ?? 'normal';
    switch (wfMode) {
      case 'plan':
        return <><Text color="magenta" bold>[Plan] </Text>{bypassIndicator}</>;
      case 'research':
        return <><Text color="yellow" bold>[Research] </Text>{bypassIndicator}</>;
      case 'review':
        return <><Text color="blue" bold>[Review] </Text>{bypassIndicator}</>;
      default: // normal/code
        return bypassIndicator ? <><Text color="cyan" bold>[Code] </Text>{bypassIndicator}</> : null;
    }
  })();

  if (isLoading) {
    const loadingContent = (
      <Box paddingX={1}>
        {modeDisplay}
        <Text color="cyan">⠋</Text>
        <Text dimColor> {loadingLabel || 'thinking'}...</Text>
      </Box>
    );
    return bypassPermissions ? (
      <Box borderStyle="single" borderColor="red">{loadingContent}</Box>
    ) : loadingContent;
  }

  // Render the buffer with a cursor indicator
  const displayLines = buffer.split('\n');
  const cursorLine = editor.getCursorLine();
  const cursorCol = editor.getCursorCol();

  // Helper: render a line with cursor at the given column, using sibling <Text> elements
  const renderLineWithCursor = (line: string, col: number) => (
    <>
      <Text>{line.slice(0, col)}</Text>
      <Text inverse>{col < line.length ? line[col] : '\u2588'}</Text>
      {col < line.length && <Text>{line.slice(col + 1)}</Text>}
    </>
  );

  const inputContent = (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        {modeDisplay && <>{modeDisplay}</>}
        <Text color="cyan">&gt;</Text>
        <Text> </Text>
        {displayLines.length === 1 ? (
          // Single line: render inline with cursor using sibling Texts
          renderLineWithCursor(buffer, cursor)
        ) : (
          // First line of multiline
          cursorLine === 0
            ? renderLineWithCursor(displayLines[0]!, cursorCol)
            : <Text>{displayLines[0]}</Text>
        )}
        {lineCount > 1 && (
          <Text dimColor> [{lineCount} lines]</Text>
        )}
      </Box>

      {/* Additional lines for multiline input */}
      {displayLines.length > 1 && displayLines.slice(1).map((line, idx) => {
        const lineIdx = idx + 1;
        const isCurrentLine = lineIdx === cursorLine;
        return (
          <Box key={lineIdx} paddingLeft={modeDisplay ? 4 : 2}>
            <Text dimColor>{'  '}</Text>
            {isCurrentLine ? renderLineWithCursor(line, cursorCol) : <Text>{line}</Text>}
          </Box>
        );
      })}

      {/* Slash command autocomplete suggestions */}
      {slashSuggestions.length > 0 && (
        <Box flexDirection="column" paddingLeft={modeDisplay ? 4 : 2}>
          {slashSuggestions.map((cmd, i) => (
            <Text key={cmd.command} dimColor>
              {i === 0 ? 'Tab> ' : '     '}/{cmd.command.padEnd(14)} {cmd.description}
            </Text>
          ))}
        </Box>
      )}

      {/* @file autocomplete suggestions (images shown with indicator) */}
      {suggestions.length > 0 && slashSuggestions.length === 0 && (
        <Box flexDirection="column" paddingLeft={modeDisplay ? 4 : 2}>
          {suggestions.map((s, i) => (
            <Text key={s} dimColor>
              {i === 0 ? 'Tab> ' : '     '}{s}{isImagePath(s) ? ' [image]' : ''}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );

  return bypassPermissions ? (
    <Box borderStyle="single" borderColor="red">{inputContent}</Box>
  ) : inputContent;
}
