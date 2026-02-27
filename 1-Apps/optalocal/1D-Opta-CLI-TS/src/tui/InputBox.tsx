import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { InputEditor } from '../ui/input.js';
import { InputHistory } from '../ui/history.js';
import fg from 'fast-glob';
import { DEFAULT_IGNORE_GLOBS } from '../utils/ignore.js';
import { isImagePath } from '../core/fileref.js';
import { getAllCommands } from '../commands/slash/index.js';
import type { SlashCommandDef } from '../commands/slash/index.js';
import {
  buildTriggerHighlightMask,
  chunkTextByTriggerMask,
  collectTriggerHighlightMatches,
  normalizeTriggerWords,
} from './input-highlighting.js';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  mode: 'normal' | 'plan' | 'shell' | 'auto';
  isLoading?: boolean;
  history?: InputHistory;
  /** Label shown when loading (e.g. "running edit_file" instead of "thinking"). */
  loadingLabel?: string;
  workflowMode?: 'normal' | 'plan' | 'research' | 'review';
  bypassPermissions?: boolean;
  /** Minimal rendering mode for ultra-narrow terminals. */
  safeMode?: boolean;
  /**
   * Trigger words highlighted inline while typing.
   * Match is case-insensitive and whole-word only.
   */
  triggerWords?: string[];
  /** Backward-compatible alias for triggerWords. */
  browserTriggerWords?: string[];
}

/** Debounce interval for @file glob searches (ms). */
const AUTOCOMPLETE_DEBOUNCE = 200;

/** Maximum number of file suggestions to display. */
const MAX_SUGGESTIONS = 5;

/** Maximum number of slash command suggestions to display. */
const MAX_SLASH_SUGGESTIONS = 8;
const DEFAULT_BROWSER_TRIGGER_WORDS = ['browser'];

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

export function InputBox({
  onSubmit,
  mode,
  isLoading,
  history: historyProp,
  loadingLabel,
  workflowMode,
  bypassPermissions,
  safeMode = false,
  triggerWords,
  browserTriggerWords = DEFAULT_BROWSER_TRIGGER_WORDS,
}: InputBoxProps) {
  const editorRef = useRef<InputEditor>(
    new InputEditor({ prompt: '>', multiline: true, mode })
  );
  const editor = editorRef.current;
  const history = useMemo(() => historyProp ?? new InputHistory(), [historyProp]);
  const normalizedTriggerWords = useMemo(
    () => normalizeTriggerWords(triggerWords ?? browserTriggerWords),
    [browserTriggerWords, triggerWords],
  );

  // Force re-render on every keystroke
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick(t => t + 1), []);

  // Track whether we're navigating history (to know when to call startNavigation)
  const navigatingHistory = useRef(false);

  // @file autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slash command autocomplete state
  const [slashSuggestions, setSlashSuggestions] = useState<SlashCommandDef[]>([]);
  const [selectedSlash, setSelectedSlash] = useState(0);

  // Keep editor mode in sync with prop
  useEffect(() => {
    editor.setMode(mode);
  }, [mode, editor]);

  // Bracketed paste detection — listen for raw stdin escape sequences
  const { stdin } = useStdin();
  const pasteBufferRef = useRef<string | null>(null);

  useEffect(() => {
    if (!stdin || isLoading) return;

    // Enable bracketed paste mode
    const PASTE_START = '\x1b[200~';
    const PASTE_END = '\x1b[201~';
    process.stdout.write('\x1b[?2004h');

    const onData = (data: Buffer) => {
      const str = data.toString('utf-8');

      // Start of paste sequence
      if (str.includes(PASTE_START)) {
        const afterStart = str.split(PASTE_START).slice(1).join(PASTE_START);
        // Check if end marker is also in this chunk
        if (afterStart.includes(PASTE_END)) {
          const pastedText = afterStart.split(PASTE_END)[0] ?? '';
          editor.handlePaste(pastedText);
          rerender();
        } else {
          pasteBufferRef.current = afterStart;
        }
        return;
      }

      // Accumulating paste content
      if (pasteBufferRef.current !== null) {
        if (str.includes(PASTE_END)) {
          const beforeEnd = str.split(PASTE_END)[0] ?? '';
          const fullPaste = pasteBufferRef.current + beforeEnd;
          pasteBufferRef.current = null;
          editor.handlePaste(fullPaste);
          rerender();
        } else {
          pasteBufferRef.current += str;
        }
        return;
      }
      // Non-paste data is handled by Ink's useInput
    };

    stdin.on('data', onData);
    return () => {
      stdin.off('data', onData);
      process.stdout.write('\x1b[?2004l');
    };
  }, [stdin, isLoading, editor, rerender]);

  // Update slash command suggestions (synchronous — no debounce needed)
  const updateSlashSuggestions = useCallback((buffer: string) => {
    // Only show slash suggestions when: buffer starts with `/`, is a single word (no spaces after command)
    if (buffer.startsWith('/') && !buffer.includes(' ')) {
      const partial = buffer.slice(1); // Remove leading /
      const matches = matchSlashCommands(partial);
      setSlashSuggestions(matches);
      setSelectedSlash(0);
    } else {
      setSlashSuggestions([]);
      setSelectedSlash(0);
    }
  }, []);

  // Debounced @file search
  const updateSuggestions = useCallback((buffer: string, cursor: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const prefix = extractAtPrefix(buffer, cursor);
    if (!prefix) {
      setSuggestions([]);
      setSelectedSuggestion(0);
      return;
    }
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      try {
        const matches = await fg(`**/${prefix}*`, {
          cwd: process.cwd(),
          onlyFiles: true,
          ignore: [...DEFAULT_IGNORE_GLOBS],
          deep: 5,
        });
        if (!cancelled) {
          setSuggestions(matches.slice(0, MAX_SUGGESTIONS));
          setSelectedSuggestion(0);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setSelectedSuggestion(0);
        }
      }
    }, AUTOCOMPLETE_DEBOUNCE);
    return () => { cancelled = true; };
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

    // Escape — dismiss suggestions first, then clear buffer on second press
    if (key.escape) {
      if (slashSuggestions.length > 0 || suggestions.length > 0) {
        setSuggestions([]);
        setSelectedSuggestion(0);
        setSlashSuggestions([]);
        setSelectedSlash(0);
        rerender();
        return;
      }
      editor.handleEscape();
      navigatingHistory.current = false;
      setSuggestions([]);
      setSlashSuggestions([]);
      rerender();
      return;
    }

    // Tab — accept selected slash command or @file suggestion; Shift+Tab cycles backward
    if (key.tab) {
      const hasSuggestions = slashSuggestions.length > 0 || suggestions.length > 0;
      if (hasSuggestions && key.shift) {
        // Shift+Tab — cycle selection backward
        if (slashSuggestions.length > 0) {
          setSelectedSlash(prev => (prev - 1 + slashSuggestions.length) % slashSuggestions.length);
        } else if (suggestions.length > 0) {
          setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
        }
        rerender();
        return;
      }

      // Slash command completion takes priority
      if (slashSuggestions.length > 0) {
        const idx = Math.min(selectedSlash, slashSuggestions.length - 1);
        const cmd = `/${slashSuggestions[idx]!.command} `;
        editor.setBuffer(cmd);
        setSlashSuggestions([]);
        setSelectedSlash(0);
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
          // Replace @prefix with selected suggestion
          const idx = Math.min(selectedSuggestion, suggestions.length - 1);
          const replacement = `@${suggestions[idx]}`;
          const newBuffer = buffer.slice(0, atPos) + replacement + buffer.slice(cursor);
          editor.setBuffer(newBuffer);
          const newCursorPos = atPos + replacement.length;
          editor.setBuffer(newBuffer.slice(0, newCursorPos) + newBuffer.slice(newCursorPos));
          setSuggestions([]);
          setSelectedSuggestion(0);
          rerender();
          return;
        }
      }
    }

    // Up arrow — navigate suggestions (if visible) or history
    if (key.upArrow) {
      if (slashSuggestions.length > 0) {
        setSelectedSlash(prev => (prev - 1 + slashSuggestions.length) % slashSuggestions.length);
        rerender();
        return;
      }
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
        rerender();
        return;
      }
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

    // Down arrow — navigate suggestions (if visible) or history
    if (key.downArrow) {
      if (slashSuggestions.length > 0) {
        setSelectedSlash(prev => (prev + 1) % slashSuggestions.length);
        rerender();
        return;
      }
      if (suggestions.length > 0) {
        setSelectedSuggestion(prev => (prev + 1) % suggestions.length);
        rerender();
        return;
      }
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
    return bypassPermissions && !safeMode ? (
      <Box borderStyle="single" borderColor="red">{loadingContent}</Box>
    ) : loadingContent;
  }

  // Render the buffer with a cursor indicator
  const displayLines = buffer.split('\n');
  const cursorLine = editor.getCursorLine();
  const cursorCol = editor.getCursorCol();

  const renderHighlightedText = (line: string, startIndex = 0) => {
    if (!line) return null;
    const matches = collectTriggerHighlightMatches(line, normalizedTriggerWords);
    const mask = buildTriggerHighlightMask(line.length, matches);
    const chunks = chunkTextByTriggerMask(line, startIndex, mask);

    return (
      <>
        {chunks.map((chunk, index) => (
          <Text
            key={`chunk-${startIndex}-${index}`}
            color={chunk.highlighted ? 'cyan' : undefined}
            bold={chunk.highlighted}
          >
            {chunk.text}
          </Text>
        ))}
      </>
    );
  };

  // Helper: render a line with cursor at the given column, while preserving trigger highlighting.
  const renderLineWithCursor = (line: string, col: number) => {
    const matches = collectTriggerHighlightMatches(line, normalizedTriggerWords);
    const mask = buildTriggerHighlightMask(line.length, matches);
    const before = line.slice(0, col);
    const cursorChar = col < line.length ? line[col] : '\u2588';
    const after = col < line.length ? line.slice(col + 1) : '';
    const beforeChunks = chunkTextByTriggerMask(before, 0, mask);
    const afterChunks = chunkTextByTriggerMask(after, col + 1, mask);
    const cursorHighlighted = col < line.length ? Boolean(mask[col]) : false;

    return (
      <>
        {beforeChunks.map((chunk, index) => (
          <Text
            key={`before-${col}-${index}`}
            color={chunk.highlighted ? 'cyan' : undefined}
            bold={chunk.highlighted}
          >
            {chunk.text}
          </Text>
        ))}
        <Text color={cursorHighlighted ? 'cyan' : undefined} bold={cursorHighlighted} inverse>
          {cursorChar}
        </Text>
        {afterChunks.map((chunk, index) => (
          <Text
            key={`after-${col}-${index}`}
            color={chunk.highlighted ? 'cyan' : undefined}
            bold={chunk.highlighted}
          >
            {chunk.text}
          </Text>
        ))}
      </>
    );
  };

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
            : renderHighlightedText(displayLines[0]!, 0)
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
            {isCurrentLine ? renderLineWithCursor(line, cursorCol) : renderHighlightedText(line, 0)}
          </Box>
        );
      })}

      {/* Slash command autocomplete suggestions — selected item highlighted */}
      {slashSuggestions.length > 0 && (
        <Box flexDirection="column" paddingLeft={modeDisplay ? 4 : 2}>
          {slashSuggestions.map((cmd, i) => {
            const isSelected = i === selectedSlash;
            return (
              <Text key={cmd.command} dimColor={!isSelected} color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {isSelected ? '▸ ' : '  '}/{cmd.command.padEnd(14)} {cmd.description}
              </Text>
            );
          })}
          <Text dimColor>  ↑↓ navigate  Tab accept  Esc dismiss</Text>
        </Box>
      )}

      {/* @file autocomplete suggestions — selected item highlighted */}
      {suggestions.length > 0 && slashSuggestions.length === 0 && (
        <Box flexDirection="column" paddingLeft={modeDisplay ? 4 : 2}>
          {suggestions.map((s, i) => {
            const isSelected = i === selectedSuggestion;
            return (
              <Text key={s} dimColor={!isSelected} color={isSelected ? 'cyan' : undefined} bold={isSelected}>
                {isSelected ? '▸ ' : '  '}{s}{isImagePath(s) ? ' [image]' : ''}
              </Text>
            );
          })}
          <Text dimColor>  ↑↓ navigate  Tab accept  Esc dismiss</Text>
        </Box>
      )}
    </Box>
  );

  return bypassPermissions && !safeMode ? (
    <Box borderStyle="single" borderColor="red">{inputContent}</Box>
  ) : inputContent;
}
