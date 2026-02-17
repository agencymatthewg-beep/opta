import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, useApp } from 'ink';
import { Header } from './Header.js';
import { MessageList } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { InkStatusBar } from './StatusBar.js';
import { SplitPane } from './SplitPane.js';
import { Sidebar } from './Sidebar.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { StreamingIndicator } from './StreamingIndicator.js';
import { FocusProvider, useFocusPanel } from './FocusContext.js';
import { estimateTokens } from '../utils/tokens.js';
import type { TuiEmitter, TurnStats } from './adapter.js';
import type { SlashResult } from '../commands/slash/index.js';

/** Max characters of a tool result displayed in the message list. */
const TOOL_RESULT_PREVIEW_LENGTH = 200;

/** Minimum rows reserved for the message area even on tiny terminals. */
const MIN_MESSAGE_AREA_HEIGHT = 10;

/** Rows consumed by header, status bar, and input (not message area). */
const CHROME_HEIGHT = 6;

export interface TuiMessage {
  role: string;
  content: string;
  toolName?: string;
  toolId?: string;
  toolStatus?: 'running' | 'done' | 'error';
  toolArgs?: Record<string, unknown>;
  toolCalls?: number;
  thinkingTokens?: number;
  /** Accumulated thinking/reasoning content from the model. */
  thinking?: { text: string; tokens: number };
}

/** Result from dispatching a slash command in TUI mode. */
export interface SlashCommandResult {
  /** The SlashResult from the handler. */
  result: SlashResult;
  /** Captured console output from the command handler. */
  output: string;
  /** Updated model name, if model was switched. */
  newModel?: string;
}

interface AppProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  /** Legacy callback mode — waits for full response before display. */
  onMessage?: (text: string) => Promise<string>;
  /** Event-driven streaming mode — real-time token/tool display. */
  emitter?: TuiEmitter;
  /** Called when user submits input in streaming mode. */
  onSubmit?: (text: string) => void;
  /** Called when user types a slash command. Dispatches through the slash registry. */
  onSlashCommand?: (input: string) => Promise<SlashCommandResult>;
}

function AppInner({
  model: initialModel,
  sessionId,
  connectionStatus = true,
  onMessage,
  emitter,
  onSubmit,
  onSlashCommand,
}: AppProps) {
  const { exit } = useApp();
  const { width, height } = useTerminalSize();
  const { activePanel, nextPanel, previousPanel } = useFocusPanel();

  const [messages, setMessages] = useState<TuiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'normal' | 'plan' | 'shell' | 'auto'>('normal');
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [tokens, setTokens] = useState(0);
  const [promptTokens, setPromptTokens] = useState(0);
  const [completionTokens, setCompletionTokens] = useState(0);
  const [toolCallCount, setToolCallCount] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [streamingLabel, setStreamingLabel] = useState('thinking');
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  // Track whether we're in streaming mode (emitter-based)
  const isStreamingMode = !!emitter;

  // Ref to track the current streaming assistant message index
  const streamingMsgIdx = useRef<number | null>(null);

  // Ref to accumulate thinking text during a turn
  const thinkingTextRef = useRef('');

  const handleClear = useCallback(() => setMessages([]), []);
  const handleToggleSidebar = useCallback(() => setSidebarVisible(prev => !prev), []);
  const handleExpandThinking = useCallback(() => setThinkingExpanded(prev => !prev), []);

  useKeyboard({
    onExit: exit,
    onClear: handleClear,
    onNextPanel: nextPanel,
    onPreviousPanel: previousPanel,
    onToggleSidebar: handleToggleSidebar,
    onExpandThinking: handleExpandThinking,
  });

  // --- Event-driven streaming mode ---
  useEffect(() => {
    if (!emitter) return;

    const onToken = (text: string) => {
      setMessages(prev => {
        const idx = streamingMsgIdx.current;
        if (idx !== null && idx < prev.length) {
          // Append to existing streaming assistant message
          const updated = [...prev];
          const msg = updated[idx]!;
          updated[idx] = { ...msg, content: msg.content + text };
          return updated;
        }
        // Create new assistant message and track its index
        const newIdx = prev.length;
        streamingMsgIdx.current = newIdx;
        return [...prev, { role: 'assistant', content: text }];
      });
    };

    const onToolStart = (name: string, id: string, argsJson: string) => {
      setStreamingLabel(`running ${name}`);
      let parsedArgs: Record<string, unknown> | undefined;
      try {
        parsedArgs = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        // args may not be valid JSON; leave undefined
      }
      setMessages(prev => [
        ...prev,
        { role: 'tool', content: 'running...', toolName: name, toolId: id, toolStatus: 'running', toolArgs: parsedArgs },
      ]);
    };

    const onToolEnd = (name: string, id: string, result: string) => {
      setStreamingLabel('thinking');
      setMessages(prev => {
        const updated = [...prev];
        // Find the matching tool:start message and update it
        const idx = updated.findIndex(
          m => m.role === 'tool' && m.toolId === id && m.toolStatus === 'running'
        );
        if (idx !== -1) {
          const truncated = result.length > TOOL_RESULT_PREVIEW_LENGTH
            ? result.slice(0, TOOL_RESULT_PREVIEW_LENGTH) + '...'
            : result;
          updated[idx] = {
            ...updated[idx]!,
            content: truncated,
            toolStatus: 'done',
          };
        }
        return updated;
      });
      setToolCallCount(prev => prev + 1);
    };

    const onThinking = (text: string) => {
      thinkingTextRef.current += text;
      setStreamingLabel('thinking deeply');
    };

    const onTurnStart = () => {
      setIsLoading(true);
      streamingMsgIdx.current = null;
      thinkingTextRef.current = '';
      setStreamingLabel('thinking');
    };

    const onTurnEnd = (stats: TurnStats) => {
      setIsLoading(false);

      // Attach accumulated thinking to the assistant message
      if (thinkingTextRef.current && streamingMsgIdx.current !== null) {
        const thinkText = thinkingTextRef.current;
        const thinkTokens = estimateTokens(thinkText);
        setMessages(prev => {
          const idx = streamingMsgIdx.current;
          if (idx !== null && idx < prev.length) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx]!,
              thinking: { text: thinkText, tokens: thinkTokens },
            };
            return updated;
          }
          return prev;
        });
      }

      streamingMsgIdx.current = null;
      thinkingTextRef.current = '';
      setTokens(prev => prev + stats.tokens);
      setCompletionTokens(prev => prev + stats.completionTokens);
      setPromptTokens(prev => prev + stats.promptTokens);
      setElapsed(stats.elapsed);
      setSpeed(stats.speed);
    };

    const onError = (msg: string) => {
      setIsLoading(false);
      streamingMsgIdx.current = null;
      thinkingTextRef.current = '';
      setMessages(prev => [...prev, { role: 'error', content: msg }]);
    };

    emitter.on('token', onToken);
    emitter.on('tool:start', onToolStart);
    emitter.on('tool:end', onToolEnd);
    emitter.on('thinking', onThinking);
    emitter.on('turn:start', onTurnStart);
    emitter.on('turn:end', onTurnEnd);
    emitter.on('error', onError);

    return () => {
      emitter.off('token', onToken);
      emitter.off('tool:start', onToolStart);
      emitter.off('tool:end', onToolEnd);
      emitter.off('thinking', onThinking);
      emitter.off('turn:start', onTurnStart);
      emitter.off('turn:end', onTurnEnd);
      emitter.off('error', onError);
    };
  }, [emitter]);

  // --- Submit handler ---
  const handleSubmit = useCallback(async (text: string) => {
    // Route slash commands through the registry
    if (text.startsWith('/')) {
      if (onSlashCommand) {
        try {
          const cmdResult = await onSlashCommand(text);

          // Show captured output as a system message
          if (cmdResult.output.trim()) {
            setMessages(prev => [...prev, { role: 'system', content: cmdResult.output.trim() }]);
          }

          if (cmdResult.result === 'exit') {
            exit();
            return;
          }
          if (cmdResult.result === 'model-switched' && cmdResult.newModel) {
            setCurrentModel(cmdResult.newModel);
          }
        } catch {
          setMessages(prev => [...prev, { role: 'error', content: `Slash command failed: ${text}` }]);
        }
        return;
      }

      // Fallback: handle /exit and /quit directly if no onSlashCommand callback
      if (text === '/exit' || text === '/quit') {
        exit();
        return;
      }
    }

    // Handle shell mode
    if (text.startsWith('!')) {
      setMode('shell');
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);

    if (isStreamingMode && onSubmit) {
      // Streaming mode: emitter events will update messages
      onSubmit(text);
    } else if (onMessage) {
      // Legacy mode: wait for full response
      setIsLoading(true);
      const startTime = Date.now();
      const response = await onMessage(text);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setElapsed((Date.now() - startTime) / 1000);
      setIsLoading(false);
    }

    setMode('normal');
  }, [onMessage, onSubmit, onSlashCommand, isStreamingMode, exit]);

  const messageAreaHeight = Math.max(height - CHROME_HEIGHT, MIN_MESSAGE_AREA_HEIGHT);

  const mainContent = (
    <Box flexDirection="column" flexGrow={1}>
      <Box
        flexDirection="column"
        height={messageAreaHeight}
        overflow="hidden"
        borderStyle={activePanel === 'messages' ? 'single' : undefined}
        borderColor={activePanel === 'messages' ? 'cyan' : 'gray'}
      >
        <MessageList messages={messages} height={activePanel === 'messages' ? messageAreaHeight - 2 : messageAreaHeight} focusable={activePanel === 'messages'} streamingIdx={streamingMsgIdx.current} terminalWidth={width} thinkingExpanded={thinkingExpanded} />
        {isLoading && <StreamingIndicator label={streamingLabel} />}
      </Box>

      <Box
        borderStyle={activePanel === 'input' ? 'single' : undefined}
        borderColor={activePanel === 'input' ? 'cyan' : 'gray'}
      >
        <InputBox onSubmit={handleSubmit} mode={mode} isLoading={isLoading} />
      </Box>
    </Box>
  );

  const sidebarContent = (
    <Sidebar
      model={currentModel}
      sessionId={sessionId}
      tokens={{ prompt: promptTokens, completion: completionTokens, total: tokens }}
      tools={toolCallCount}
      cost="$0.00"
      mode={mode}
      elapsed={elapsed}
      speed={speed}
    />
  );

  return (
    <Box flexDirection="column" height={height} width="100%">
      <Header
        model={currentModel}
        sessionId={sessionId}
        connectionStatus={connectionStatus}
      />

      <SplitPane
        main={mainContent}
        sidebar={sidebarContent}
        sidebarWidth={28}
        sidebarVisible={sidebarVisible}
      />

      <InkStatusBar
        model={currentModel}
        tokens={tokens}
        cost="$0.00"
        tools={toolCallCount}
        speed={speed}
        mode={mode}
      />
    </Box>
  );
}

export function App(props: AppProps) {
  return (
    <FocusProvider>
      <AppInner {...props} />
    </FocusProvider>
  );
}
