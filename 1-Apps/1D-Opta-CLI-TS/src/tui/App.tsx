import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Box, Text, useApp } from 'ink';
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
import { PermissionPrompt } from './PermissionPrompt.js';
import { HelpOverlay } from './HelpOverlay.js';
import { estimateTokens } from '../utils/tokens.js';
import type { TuiEmitter, TurnStats, PermissionRequest } from './adapter.js';
import type { PermissionDecision } from './PermissionPrompt.js';
import type { ConnectionState } from './utils.js';
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
  /** Number of images attached to this message (for visual indicator). */
  imageCount?: number;
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
  /** Initial session title (for resumed sessions). New session titles arrive via emitter 'title' event. */
  title?: string;
}

function AppInner({
  model: initialModel,
  sessionId,
  connectionStatus = true,
  onMessage,
  emitter,
  onSubmit,
  onSlashCommand,
  title: initialTitle,
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
  const [showHelp, setShowHelp] = useState(false);
  const [sessionTitle, setSessionTitle] = useState(initialTitle);
  const [cost, setCost] = useState('$0.00');

  // New streaming progress state
  const [turnPhase, setTurnPhase] = useState<'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done'>('idle');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [turnElapsed, setTurnElapsed] = useState(0);
  const [firstTokenLatency, setFirstTokenLatency] = useState<number | null>(null);
  const [turnSpeed, setTurnSpeed] = useState(0);
  const [turnCompletionTokens, setTurnCompletionTokens] = useState(0);

  // Permission prompt state
  const [permissionPending, setPermissionPending] = useState<(PermissionRequest & { resolve: (decision: PermissionDecision) => void }) | null>(null);
  const [alwaysMessage, setAlwaysMessage] = useState<string | null>(null);

  // Track whether we're in streaming mode (emitter-based)
  const isStreamingMode = !!emitter;

  // Derived context usage from token counts
  const contextUsage = useMemo(() => ({
    used: promptTokens + completionTokens,
    total: 196608, // TODO: get from config/model metadata
  }), [promptTokens, completionTokens]);

  // Ref to track the current streaming assistant message index
  const streamingMsgIdx = useRef<number | null>(null);

  // Ref to accumulate thinking text during a turn
  const thinkingTextRef = useRef('');

  const handleClear = useCallback(() => setMessages([]), []);
  const handleToggleSidebar = useCallback(() => setSidebarVisible(prev => !prev), []);
  const handleExpandThinking = useCallback(() => setThinkingExpanded(prev => !prev), []);
  const handleHelp = useCallback(() => setShowHelp(prev => !prev), []);

  useKeyboard({
    onExit: exit,
    onClear: handleClear,
    onHelp: handleHelp,
    onNextPanel: nextPanel,
    onPreviousPanel: previousPanel,
    onToggleSidebar: handleToggleSidebar,
    onExpandThinking: handleExpandThinking,
  });

  // Elapsed timer -- ticks every 100ms while loading
  useEffect(() => {
    if (!isLoading) {
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setTurnElapsed((Date.now() - start) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, [isLoading]);

  // Connection check on mount
  useEffect(() => {
    if (!emitter) return;
    import('../tui/adapter.js').then(({ checkConnection: check }) => {
      // checkConnection needs config; for now emit connected since we're already in TUI mode
      // The actual checkConnection call is made from chat.ts after setting up the emitter
      void check;
      setConnectionState('connected');
    }).catch(() => {});
  }, [emitter]);

  // --- Event-driven streaming mode ---
  useEffect(() => {
    if (!emitter) return;

    // Track whether first token has been received this turn (for phase transition)
    let firstTokenReceived = false;

    const onToken = (text: string) => {
      // Transition to streaming phase on first token
      if (!firstTokenReceived) {
        firstTokenReceived = true;
        setTurnPhase('streaming');
      }

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
      setTurnPhase('tool-call');
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
      setTurnPhase('streaming');
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
      setTurnPhase('waiting');
      setFirstTokenLatency(null);
      setTurnElapsed(0);
      setTurnCompletionTokens(0);
      setTurnSpeed(0);
    };

    const onTurnEnd = (stats: TurnStats) => {
      setIsLoading(false);
      setTurnPhase('done');

      // Transition back to idle after 2 seconds
      setTimeout(() => setTurnPhase('idle'), 2000);

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
      if (stats.firstTokenLatencyMs !== null) {
        setFirstTokenLatency(stats.firstTokenLatencyMs);
      }
    };

    const onError = (msg: string) => {
      setIsLoading(false);
      streamingMsgIdx.current = null;
      thinkingTextRef.current = '';
      setMessages(prev => [...prev, { role: 'error', content: msg }]);
    };

    const onTitle = (title: string) => {
      setSessionTitle(title);
    };

    const onConnectionStatus = (status: 'checking' | 'connected' | 'disconnected' | 'error') => {
      setConnectionState(status);
    };

    const onFirstToken = (latencyMs: number) => {
      setFirstTokenLatency(latencyMs);
    };

    const onTurnProgress = (stats: { elapsed: number; speed: number; completionTokens: number }) => {
      setTurnSpeed(stats.speed);
      setTurnCompletionTokens(stats.completionTokens);
    };

    const onPermissionRequest = (request: PermissionRequest) => {
      // Create a Promise-based bridge: the resolve function is stored in state
      // so the PermissionPrompt component can call it when the user decides.
      setPermissionPending({
        ...request,
        resolve: (decision: PermissionDecision) => {
          // Send the response back to the adapter (which unblocks the agent loop)
          emitter.emit('permission:response', request.id, decision);
          setPermissionPending(null);

          // If "always" was chosen, persist the permission and show confirmation
          if (decision === 'always') {
            setAlwaysMessage(`${request.toolName} set to always allow`);
            // Clear the confirmation after 3 seconds
            setTimeout(() => setAlwaysMessage(null), 3000);
            // Persist to config asynchronously
            import('../core/config.js').then(({ saveConfig }) => {
              saveConfig({ [`permissions.${request.toolName}`]: 'allow' }).catch(() => {
                // Config save failed — non-fatal
              });
            }).catch(() => {});
          }
        },
      });
    };

    emitter.on('token', onToken);
    emitter.on('tool:start', onToolStart);
    emitter.on('tool:end', onToolEnd);
    emitter.on('thinking', onThinking);
    emitter.on('turn:start', onTurnStart);
    emitter.on('turn:end', onTurnEnd);
    emitter.on('turn:first-token', onFirstToken);
    emitter.on('turn:progress', onTurnProgress);
    emitter.on('connection:status', onConnectionStatus);
    emitter.on('error', onError);
    emitter.on('permission:request', onPermissionRequest);
    emitter.on('title', onTitle);

    return () => {
      emitter.off('token', onToken);
      emitter.off('tool:start', onToolStart);
      emitter.off('tool:end', onToolEnd);
      emitter.off('thinking', onThinking);
      emitter.off('turn:start', onTurnStart);
      emitter.off('turn:end', onTurnEnd);
      emitter.off('turn:first-token', onFirstToken);
      emitter.off('turn:progress', onTurnProgress);
      emitter.off('connection:status', onConnectionStatus);
      emitter.off('error', onError);
      emitter.off('permission:request', onPermissionRequest);
      emitter.off('title', onTitle);
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

    // Shell command execution: !command runs directly and shows output.
    // Uses execSync intentionally (not execFile) because user-typed shell commands
    // need shell features like pipes, redirects, and glob expansion — same as REPL path.
    if (text.startsWith('!')) {
      const cmd = text.slice(1).trim();
      if (!cmd) return;

      setMessages(prev => [...prev, { role: 'user', content: text }]);

      try {
        const { execSync } = await import('node:child_process');
        const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 30000 });
        const result = output.trim()
          ? `$ ${cmd}\n${output.trim()}\n\u2714 exit 0`
          : `$ ${cmd}\n\u2714 exit 0`;
        setMessages(prev => [...prev, { role: 'system', content: result }]);
      } catch (err: unknown) {
        const e = err as { status?: number; stderr?: string; stdout?: string };
        const parts: string[] = [`$ ${cmd}`];
        if (e.stdout) parts.push(e.stdout.trim());
        if (e.stderr) parts.push(e.stderr.trim());
        parts.push(`\u2718 exit ${e.status ?? 1}`);
        setMessages(prev => [...prev, { role: 'error', content: parts.join('\n') }]);
      }
      return;
    }

    // Check for @image references and show indicator
    const imagePattern = /@\S+\.(png|jpg|jpeg|gif|webp)/gi;
    const imageMatches = [...text.matchAll(imagePattern)];
    const hasImages = imageMatches.length > 0;

    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      ...(hasImages ? { imageCount: imageMatches.length } : {}),
    } as TuiMessage]);

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

  // Responsive layout: derive narrow modes from terminal width
  const narrowMode = width < 80;
  const compactMode = width < 60;

  // Auto-hide sidebar when terminal is narrow
  const effectiveSidebarVisible = narrowMode ? false : sidebarVisible;

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
        {showHelp ? (
          <HelpOverlay onClose={() => setShowHelp(false)} />
        ) : (
          <>
            <MessageList
              messages={messages}
              height={activePanel === 'messages' ? messageAreaHeight - 2 : messageAreaHeight}
              focusable={activePanel === 'messages'}
              streamingIdx={streamingMsgIdx.current}
              terminalWidth={width}
              thinkingExpanded={thinkingExpanded}
              connectionState={connectionState}
              model={currentModel}
              contextTotal={contextUsage.total}
            />
            {isLoading && (
              <StreamingIndicator
                label={streamingLabel}
                phase={turnPhase}
                elapsed={turnElapsed}
                speed={turnSpeed}
                completionTokens={turnCompletionTokens}
                firstTokenLatency={firstTokenLatency}
              />
            )}
          </>
        )}
      </Box>

      {/* Permission prompt replaces the input area when active */}
      {permissionPending ? (
        <PermissionPrompt
          toolName={permissionPending.toolName}
          args={permissionPending.args}
          onDecision={permissionPending.resolve}
        />
      ) : (
        <Box
          borderStyle={activePanel === 'input' ? 'single' : undefined}
          borderColor={activePanel === 'input' ? 'cyan' : 'gray'}
        >
          <InputBox onSubmit={handleSubmit} mode={mode} isLoading={isLoading || !!permissionPending} />
        </Box>
      )}

      {/* Brief "always allow" confirmation */}
      {alwaysMessage && (
        <Box paddingX={1}>
          <Text color="green">{'\u2714'} {alwaysMessage}</Text>
        </Box>
      )}
    </Box>
  );

  const sidebarContent = (
    <Sidebar
      model={currentModel}
      sessionId={sessionId}
      tokens={{ prompt: promptTokens, completion: completionTokens, total: tokens }}
      tools={toolCallCount}
      cost={cost}
      mode={mode}
      elapsed={elapsed}
      speed={speed}
      title={sessionTitle}
      connectionState={connectionState}
      contextUsage={contextUsage}
    />
  );

  return (
    <Box flexDirection="column" height={height} width="100%">
      <Header
        model={currentModel}
        sessionId={sessionId}
        connectionStatus={connectionStatus}
        title={sessionTitle}
        compact={compactMode}
        connectionState={connectionState}
      />

      <SplitPane
        main={mainContent}
        sidebar={sidebarContent}
        sidebarWidth={28}
        sidebarVisible={effectiveSidebarVisible}
      />

      <InkStatusBar
        model={currentModel}
        tokens={tokens}
        cost={cost}
        tools={toolCallCount}
        speed={speed}
        mode={mode}
        compact={compactMode}
        connectionState={connectionState}
        turnElapsed={turnElapsed}
        turnPhase={turnPhase}
        promptTokens={promptTokens}
        completionTokens={completionTokens}
        contextUsed={contextUsage.used}
        contextTotal={contextUsage.total}
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
