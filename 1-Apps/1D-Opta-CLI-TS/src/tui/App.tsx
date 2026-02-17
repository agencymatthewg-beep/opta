import React, { useState, useCallback } from 'react';
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

interface AppProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  onMessage?: (text: string) => Promise<string>;
}

function AppInner({ model, sessionId, connectionStatus = true, onMessage }: AppProps) {
  const { exit } = useApp();
  const { height } = useTerminalSize();
  const { activePanel, nextPanel, previousPanel } = useFocusPanel();

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'normal' | 'plan' | 'shell' | 'auto'>('normal');
  const [tokens, setTokens] = useState(0);
  const [promptTokens, setPromptTokens] = useState(0);
  const [completionTokens, setCompletionTokens] = useState(0);
  const [tools, setTools] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useKeyboard({
    onExit: () => exit(),
    onClear: () => setMessages([]),
    onNextPanel: nextPanel,
    onPreviousPanel: previousPanel,
    onToggleSidebar: () => setSidebarVisible(prev => !prev),
  });

  const handleSubmit = useCallback(async (text: string) => {
    // Handle slash commands
    if (text === '/exit' || text === '/quit') {
      exit();
      return;
    }

    // Handle shell mode
    if (text.startsWith('!')) {
      setMode('shell');
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    const startTime = Date.now();
    if (onMessage) {
      const response = await onMessage(text);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setElapsed((Date.now() - startTime) / 1000);
    }

    setIsLoading(false);
    setMode('normal');
  }, [onMessage, exit]);

  // Calculate message area height (total - header - statusbar - input)
  const messageAreaHeight = Math.max(height - 6, 10);

  const mainContent = (
    <Box flexDirection="column" flexGrow={1}>
      <Box
        flexDirection="column"
        height={messageAreaHeight}
        overflow="hidden"
        borderStyle={activePanel === 'messages' ? 'single' : undefined}
        borderColor={activePanel === 'messages' ? 'cyan' : 'gray'}
      >
        <MessageList messages={messages} height={activePanel === 'messages' ? messageAreaHeight - 2 : messageAreaHeight} />
        {isLoading && <StreamingIndicator />}
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
      model={model}
      sessionId={sessionId}
      tokens={{ prompt: promptTokens, completion: completionTokens, total: tokens }}
      tools={tools}
      cost="$0.00"
      mode={mode}
      elapsed={elapsed}
    />
  );

  return (
    <Box flexDirection="column" height={height} width="100%">
      <Header
        model={model}
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
        model={model}
        tokens={tokens}
        cost="$0.00"
        tools={tools}
        speed={0}
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
